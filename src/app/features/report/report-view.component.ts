import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReportService, ReportConfig, ReportConfigItem } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { AnalysisEntry, AnalysisJob, Variant, JobComment } from '../../core/models/analysis.model';
import { ReportReadEntry, ProcessedReportItem } from './models/report.models';
import { AnalysisService } from '../../core/services/analysis.service';
import { ReportVariantBlockComponent } from './components/report-variant-block/report-variant-block.component';

/**
 * Component for viewing and exporting analysis reports.
 * It aggregates analysis results for selected variants across multiple reads.
 */
@Component({
    selector: 'app-report-view',
    standalone: true,
    imports: [CommonModule, ReportVariantBlockComponent],
    templateUrl: './report-view.component.html',
    styleUrl: './report-view.component.css'
})
export class ReportViewComponent implements OnInit {
    /** Service for report configuration management */
    private reportService = inject(ReportService);
    /** Router for navigation */
    private router = inject(Router);
    /** Service for showing toast notifications */
    private toastService = inject(ToastService);
    /** Service for analysis data retrieval and processing */
    public analysisService = inject(AnalysisService);

    /** Current report configuration */
    config = signal<ReportConfig | null>(null);
    /** Full job data associated with the report */
    readonly job = signal<AnalysisJob | null>(null);
    /** Raw analysis results from the backend */
    readonly analysisResults = signal<any[] | null>(null);
    /** Comments from the job, indexed by variant position */
    readonly comments = signal<Record<string, JobComment[]>>({});
    /** Reference sequence trace for comparison */
    readonly referenceTrace = signal<AnalysisEntry | undefined>(undefined);
    /** Current date for the report header */
    currentDate = new Date();

    /**
     * Sets up a mock analysis entry for the reference sequence.
     * @param sequence The DNA sequence string
     */
    async setReferenceTrace(sequence: string) {
        const entry: AnalysisEntry = {
            patient: { id: 'Reference', name: 'Reference', reads: [] },
            readId: 'Reference',
            readName: 'Reference',
            result: {
                variants: { columns: [], rows: [] },
                consensusAlign: Array.from(sequence).reduce((acc, char, i) => {
                    const refPos = i + 1;
                    acc[refPos] = {
                        refPos,
                        cons: [char.toUpperCase()],
                        sangerPos1: [i],
                        alt1: [],
                        alt2: []
                    };
                    return acc;
                }, {} as Record<number, any>),
                alignment: { refStart: 0, refForward: 1 },
                trace: { traceA: [], traceC: [], traceG: [], traceT: [], peakLocations: [] }
            }
        }
        this.referenceTrace.set(entry);
    }

    /**
     * Computed items to be displayed in the report.
     * Transforms raw results into structured ProcessedReportItem objects.
     */
    reportItems = computed<ProcessedReportItem[]>(() => {
        const cfg = this.config();
        const results = this.analysisResults();

        if (!cfg || !results) return [];

        return cfg.items.map((item: ReportConfigItem) => {
            let variantDetail: Variant | undefined;
            const readEntries: ReportReadEntry[] = [];
            const currentJobComments = this.comments()[item.variantPosition.toString()] || [];

            item.selectedReadIds.forEach((readId: string) => {
                const res = results.find((r: any) => r.readId === readId || r.readPath === readId || r.file === readId);

                if (res && res.alignment && res.alignment.trace) {
                    const patientObj = this.job()?.patients?.find((p: any) => p.id === res.patientId);
                    const patientName = patientObj?.name || res.patientName || 'Patient';
                    const patient = { id: res.patientId, name: patientName, reads: [] };

                    const entry = this.analysisService.createAnalysisEntry(patient, res.readId || res.readPath, res.alignment);

                    const vars = this.analysisService.mapVariantData(res.alignment.variants);
                    const enhancedVars = vars.map(v => this.analysisService.enhanceVariant(v, patient.name, patient.id, this.job()));
                    const v = enhancedVars.find((v: Variant) => v.position === item.variantPosition);

                    if (v && !variantDetail) {
                        variantDetail = v;
                    }

                    readEntries.push({
                        readId: readId.split('/').pop() || readId,
                        trace: entry,
                        variant: v
                    });
                }
            });

            return {
                config: item,
                variant: variantDetail || { position: item.variantPosition, ref: '?', alt: '?', type: 'Unknown', qual: 0, patient: 'Unknown' } as Variant,
                hgvs: variantDetail ? (this.getHgvs(variantDetail)[0] || '') : '',
                jobComments: currentJobComments,
                reads: readEntries
            };
        });
    });

    /**
     * Extracts HGVS nomenclature strings from a variant.
     * @param v The variant object
     * @returns Array of HGVS strings
     */
    getHgvs(v: Variant): string[] {
        const hgvs = v['hgvs'];
        if (!hgvs) return [];
        if (Array.isArray(hgvs)) return hgvs.map(h => h.toString());
        return [hgvs.toString()];
    }

    /**
     * Angular lifecycle hook: initializes the component by loading report configuration and job data.
     */
    async ngOnInit() {
        const cfg = this.reportService.currentReportConfig();
        if (!cfg) {
            this.router.navigate(['/']);
            return;
        }
        this.config.set(cfg);

        // Load job data if we have a jobId
        if (cfg.jobId) {
            try {
                const jobData = await this.analysisService.getJob(cfg.jobId);
                this.job.set(jobData);
                this.analysisResults.set(jobData.results || null);
                if (jobData.comments) {
                    this.comments.set(jobData.comments);
                }
                if (jobData.reference_sequence) {
                    this.setReferenceTrace(jobData.reference_sequence);
                }
            } catch (e) {
                console.error("Failed to load job for report", e);
            }
        }
    }

    /**
     * Standard browser print functionality.
     */
    print() {
        window.print();
    }

    /**
     * Generates and downloads an HTML version of the report, embedding canvas elements as images.
     */
    async exportHtml() {
        try {
            this.toastService.show('Generating HTML...', 'info');

            const container = document.querySelector('.report-container');
            if (!container) throw new Error('Report container not found');

            const clone = container.cloneNode(true) as HTMLElement;

            // Clean up UI-only elements
            const noPrintElements = clone.querySelectorAll('.no-print');
            noPrintElements.forEach(el => el.remove());

            // Convert canvases to images for static HTML export
            const originalCanvases = container.querySelectorAll('canvas');
            const clonedCanvases = clone.querySelectorAll('canvas');

            for (let i = 0; i < originalCanvases.length; i++) {
                const dataUrl = originalCanvases[i].toDataURL('image/png');
                const img = document.createElement('img');
                img.src = dataUrl;
                img.style.width = originalCanvases[i].style.width || '100%';
                img.style.height = originalCanvases[i].style.height || 'auto';

                clonedCanvases[i].parentNode?.replaceChild(img, clonedCanvases[i]);
            }

            const headContent = this.getGlobalStyles();
            const htmlContent = this.assembleFullHtml(clone.outerHTML, headContent);

            this.downloadFile(htmlContent, `Report_${this.config()?.jobName || 'Analysis'}.html`, 'text/html');

            this.toastService.show('HTML Report downloaded successfully', 'success');
        } catch (err) {
            console.error('Export failed:', err);
            this.toastService.show('Failed to generate HTML report', 'error');
        }
    }

    /**
     * Collects all current style and link tags from the document.
     */
    private getGlobalStyles(): string {
        const styleElements = Array.from(document.querySelectorAll('style'));
        const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

        return [
            ...linkElements.map(el => el.outerHTML),
            ...styleElements.map(el => el.outerHTML)
        ].join('\n');
    }

    /**
     * Assembles the full HTML document for export.
     */
    private assembleFullHtml(bodyHtml: string, headHtml: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Analysis Report - ${this.config()?.jobName || 'Export'}</title>
    ${headHtml}
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #fff;
            color: #333;
            margin: 0;
            padding: 2rem;
        }
        .report-container {
            max-width: 100%;
            margin: 0 auto;
        }
        .no-print { display: none !important; }
        @media print {
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    ${bodyHtml}
</body>
</html>`;
    }

    /**
     * Triggers a browser download for a blob.
     */
    private downloadFile(content: string, filename: string, type: string) {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Navigates back to the job view or home.
     */
    back() {
        const jobId = this.config()?.jobId;
        if (jobId) {
            this.router.navigate(['/analysis', jobId]);
        } else {
            this.router.navigate(['/']);
        }
    }
}

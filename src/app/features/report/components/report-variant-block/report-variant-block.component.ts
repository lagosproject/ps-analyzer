import { Component, OnInit, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineService } from '../../../../core/services/timeline.service';
import { SangerChartComponent } from '../../../analysis/components/sanger-chart/sanger-chart';
import { AnalysisService } from '../../../../core/services/analysis.service';
import { GroupNucleotideRows } from '../../../analysis/components/group-nucleotide-rows/group-nucleotide-rows';
import { AnalysisEntry } from '../../../../core/models/analysis.model';
import { ProcessedReportItem } from '../../models/report.models';

/**
 * Component for displaying a single variant block in the report.
 * It shows the Sanger charts and nucleotide alignment for the selected reads.
 */
@Component({
    selector: 'app-report-variant-block',
    standalone: true,
    imports: [CommonModule, SangerChartComponent, GroupNucleotideRows],
    providers: [TimelineService],
    templateUrl: './report-variant-block.component.html',
    styleUrl: './report-variant-block.component.css'
})
export class ReportVariantBlockComponent implements OnInit {
    /** The processed report item to display */
    readonly item = input.required<ProcessedReportItem>();
    /** The reference sequence trace for the background */
    readonly referenceTrace = input<AnalysisEntry | undefined>(undefined);

    /** Service for managing the timeline view (zoom, scroll, highlight) */
    public readonly timelineService = inject(TimelineService);
    /** Service for analysis data processing */
    public readonly analysisService = inject(AnalysisService);

    /** Traces to be displayed in the Sanger charts */
    public readonly traces = computed<AnalysisEntry[]>(() => {
        const reads = this.item()?.reads || [];
        return reads.map(r => r.trace);
    });

    /** 
     * Map of reference positions to the maximum depth (number of calls) found at that position.
     * Used for layout calculations in the alignment view.
     */
    public readonly alignmentDepthMap = computed<Map<number, number>>(() => {
        const depthMap = new Map<number, number>();
        const item = this.item();
        const reads = item?.reads || [];
        const reference = this.referenceTrace();

        const tracesToProcess = reference ? [reference, ...reads.map(r => r.trace)] : reads.map(r => r.trace);

        for (const trace of tracesToProcess) {
            if (!trace?.result?.consensusAlign) continue;

            for (const pos in trace.result.consensusAlign) {
                const refPos = parseInt(pos, 10);
                const currentMax = depthMap.get(refPos) || 0;
                const consLength = trace.result.consensusAlign[pos].cons?.length || 0;
                depthMap.set(refPos, Math.max(currentMax, consLength));
            }
        }
        return depthMap;
    });

    /**
     * Total length of the reference sequence or the alignment window.
     */
    public readonly totalLength = computed<number>(() => {
        const reference = this.referenceTrace();
        if (reference?.result?.consensusAlign) {
            return Object.keys(reference.result.consensusAlign).length;
        }

        // Fallback: find max refPos from depth map
        let max = 0;
        this.alignmentDepthMap().forEach((_, pos) => {
            if (pos > max) max = pos;
        });
        return max || 2000;
    });

    /**
     * Angular lifecycle hook: initializes the timeline view centered on the variant position.
     */
    ngOnInit() {
        const item = this.item();
        const pos = item.config.variantPosition;
        const DEFAULT_ZOOM = 40;

        // Ensure maxPosition is set before setting range/highlight
        this.timelineService.setMaxPosition(this.totalLength());

        // Center on variant (Timeline position is 0-based start of window)
        const start = Math.max(0, pos - 1 - DEFAULT_ZOOM / 2);
        this.timelineService.setRange(start, start + DEFAULT_ZOOM);

        // Highlight the variant (0-based reference index)
        const globalIndex = pos - 1;
        this.timelineService.setHighlight(globalIndex, globalIndex);
    }

    /**
     * Handles nucleotide selection in the alignment view to sync the highlight.
     */
    onNucleotideSelected(event: { readId: string, refPos: number, isInsertion?: boolean }) {
        const globalIndex = event.refPos - 1;
        this.timelineService.setHighlight(globalIndex, globalIndex);
    }
}

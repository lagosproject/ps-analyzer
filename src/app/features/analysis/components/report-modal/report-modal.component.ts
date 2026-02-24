import { Component, input, output, signal, computed, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Variant } from '../../../../core/models/analysis.model';
import { ReportService, ReportConfig, ReportConfigItem } from '../../../../core/services/report.service';

@Component({
    selector: 'app-report-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './report-modal.component.html',
    styleUrl: './report-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportModalComponent {
    isVisible = input(false);
    isVisibleChange = output<boolean>();
    generate = output<ReportConfig>();

    jobId = input('');
    jobName = input('');
    allVariants = input<Variant[]>([]);
    patients = input<{ id: string, name: string, reads: any[] }[]>([]);

    private reportService = inject(ReportService);

    // Configuration Item Interface local to component state
    // We need to map variants to a config object
    configItems = signal<ReportConfigItem[]>([]);

    readonly markedVariants = computed(() => {
        const jobId = this.jobId();
        if (!jobId || !this.isVisible()) return [];

        const markedPos = this.reportService.getMarkedVariants(jobId);

        // Filter allVariants to find matches
        // Note: allVariants might contain multiple entries for same position (different patients)
        // We want to group by position
        const variantsAtPos = this.allVariants().filter(v => markedPos.includes(v.position));

        // Group by position
        const grouped = new Map<number, Variant[]>();
        for (const v of variantsAtPos) {
            if (!grouped.has(v.position)) {
                grouped.set(v.position, []);
            }
            grouped.get(v.position)!.push(v);
        }

        return Array.from(grouped.entries()).map(([position, variants]) => ({
            position,
            variants, // All variant entries at this position
            ref: variants[0].ref,
            alt: variants[0].alt
        })).sort((a, b) => a.position - b.position);
    });

    constructor() {
        effect(() => {
            if (this.isVisible()) {
                this.initializeConfig();
            }
        });
    }

    // Initialize config when modal opens
    initializeConfig() {
        const currentItems = this.markedVariants().map(v => {
            // Simpler approach: Pre-select all reads from patients that have the variant call.
            const patientIdsWithVariant = new Set(v.variants.map(varItem => varItem.patientId));

            // Let's find all read IDs for these patients
            const preSelectedReads: string[] = [];
            this.patients().forEach(p => {
                if (patientIdsWithVariant.has(p.id)) {
                    p.reads.forEach(r => preSelectedReads.push(r.id || r.file));
                }
            });

            return {
                variantPosition: v.position,
                selectedReadIds: preSelectedReads,
                includeReference: true,
                comments: ''
            } as ReportConfigItem;
        });

        this.configItems.set(currentItems);
    }

    // Helper to get available reads for selection
    getAvailableReads(variantPosition: number) {
        // Return all reads from all patients, formatted for selection
        return this.patients().flatMap(p => p.reads.map(r => ({
            id: r.file || r.id, // Usually the backend uses `r.file` as the readId in analysis traces
            name: r.file?.split('/').pop() || r.id,
            patientName: p.name
        })));
    }

    confirm() {
        const config: ReportConfig = {
            jobId: this.jobId(),
            jobName: this.jobName(),
            items: this.configItems()
        };
        this.generate.emit(config);
        this.close();
    }

    close() {
        this.isVisibleChange.emit(false);
    }

    // Update item in signal
    updateItem(index: number, changes: Partial<ReportConfigItem>) {
        this.configItems.update(items => {
            const newItems = [...items];
            newItems[index] = { ...newItems[index], ...changes };
            return newItems;
        });
    }

    toggleReadSelection(itemIndex: number, readId: string) {
        this.configItems.update(items => {
            const newItems = [...items];
            const item = newItems[itemIndex];
            const selected = new Set(item.selectedReadIds);
            if (selected.has(readId)) {
                selected.delete(readId);
            } else {
                selected.add(readId);
            }
            newItems[itemIndex] = { ...item, selectedReadIds: Array.from(selected) };
            return newItems;
        });
    }

    isReadSelected(itemIndex: number, readId: string): boolean {
        const item = this.configItems()[itemIndex];
        if (!item) return false;
        return item.selectedReadIds.includes(readId);
    }
}

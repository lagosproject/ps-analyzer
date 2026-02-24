import { Component, inject, signal, input, output, ChangeDetectionStrategy, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SangerChartComponent } from '../../../features/analysis/components/sanger-chart/sanger-chart';
import { AnalysisService, AnalysisResult } from '../../../core/services/analysis.service';

@Component({
    selector: 'app-read-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, SangerChartComponent],
    templateUrl: './read-settings.html',
    styleUrl: './read-settings.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReadSettingsComponent {
    protected readonly analysisService = inject(AnalysisService);

    // Inputs
    /** Path of the read file. */
    readonly filePath = input.required<string>();

    /** Initial left trim value in bases. */
    readonly initialTrimLeft = input<number>(50);

    /** Initial right trim value in bases. */
    readonly initialTrimRight = input<number>(50);

    /** Emits the user-selected trim values when saved. */
    readonly save = output<{ trimLeft: number, trimRight: number }>();

    /** Emits when the modal is requested to be closed. */
    readonly close = output<void>();

    // State
    readonly trimLeft = signal<number>(50);
    readonly trimRight = signal<number>(50);
    readonly loading = signal<boolean>(true);
    readonly error = signal<string | null>(null);

    // Preview Data
    readonly previewTrace = signal<AnalysisResult['trace'] | undefined>(undefined);
    readonly previewSequenceLength = signal<number>(0);

    // Zoom and Panning State
    readonly startViewRange = computed(() => ({
        start: 0,
        end: Math.max(100, this.trimLeft() * 1.25)
    }));

    readonly endViewRange = computed(() => {
        const len = this.previewSequenceLength();
        const rangeWidth = Math.max(100, this.trimRight() * 1.25);
        return {
            start: Math.max(0, len - rangeWidth),
            end: len
        };
    });

    constructor() {
        // Initialize signals from inputs when available
        effect(() => {
            this.trimLeft.set(this.initialTrimLeft());
            this.trimRight.set(this.initialTrimRight());
            this.loadPreview();
        });
    }

    async loadPreview() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const data = await this.analysisService.getReadPreview(this.filePath());
            this.previewTrace.set(data);
            if (data && data.peakLocations) {
                this.previewSequenceLength.set(data.peakLocations.length);
            }
        } catch (e: unknown) {
            this.error.set(e instanceof Error ? e.message : "Failed to load preview.");
        } finally {
            this.loading.set(false);
        }
    }

    onSave() {
        this.save.emit({
            trimLeft: this.trimLeft(),
            trimRight: this.trimRight()
        });
    }

    onClose() {
        this.close.emit();
    }
}

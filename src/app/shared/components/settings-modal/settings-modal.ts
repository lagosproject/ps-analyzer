import { Component, ChangeDetectionStrategy, signal, model, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TracyConfig, HGVSConfig } from '../../../core/models/analysis.model';

@Component({
    selector: 'app-settings-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-modal.html',
    styleUrl: './settings-modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsModalComponent {
    /** Controls the visibility of the modal. */
    isVisible = model<boolean>(false);

    /** Current Tracy alignment/trimming configuration. */
    tracyConfig = input.required<TracyConfig>();

    /** Current HGVS annotation configuration. */
    hgvsConfig = input.required<HGVSConfig>();

    /** If true, disables editing of config inputs. */
    readOnly = input<boolean>(false);

    /** Related NCBI reference ID, if applicable. */
    ncbiId = input<string | null>(null);

    /** If true, indicates a local reference file is used instead of NCBI. */
    useLocalRef = input<boolean>(false);

    /** Emits when the user requests to reset configurations to default results. */
    reset = output<void>();

    /** Currently active tab in the settings sidebar. */
    activeTab = signal<string>('Generic');

    isHgvsActive = computed(() => {
        const config = this.hgvsConfig();
        return !!config.transcript && config.transcript.length > 0;
    });

    /**
     * Updates the active tab.
     * @param tab The name of the tab to activate.
     */
    setActiveTab(tab: string) {
        this.activeTab.set(tab);
    }

    /**
     * Closes the settings modal.
     */
    close() {
        this.isVisible.set(false);
    }


}

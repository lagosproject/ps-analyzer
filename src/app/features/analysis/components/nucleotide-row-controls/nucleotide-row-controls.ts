import { Component, ChangeDetectionStrategy, inject, input, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimelineService } from '../../../../core/services/timeline.service';
import { AnalysisEntry } from '../../../../core/models/analysis.model';

@Component({
    selector: 'app-nucleotide-row-controls',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './nucleotide-row-controls.html',
    styleUrl: './nucleotide-row-controls.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NucleotideRowControlsComponent {
    protected readonly timelineService = inject(TimelineService);

    readonly referenceTrace = input<AnalysisEntry | undefined>(undefined);

    readonly searchQuery = signal<string>('');
    readonly searchResults = signal<number[]>([]);
    readonly currentMatchIndex = signal<number>(-1);

    constructor() {
        // React to search query changes
        effect(() => {
            this.performSearch();
        });
    }

    updateZoom(direction: number) {
        const current = this.timelineService.zoom();
        const factor = 1.2;
        let newZoom: number;

        if (direction > 0) {
            newZoom = Math.max(current + 1, Math.round(current * factor));
        } else {
            newZoom = Math.min(current - 1, Math.round(current / factor));
        }

        this.timelineService.setZoom(newZoom);
    }

    updateCursor(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = Math.max(1, Number(target.value)) - 1;
        this.timelineService.setPosition(value);
    }

    moveTimeline(direction: number) {
        const step = Math.max(1, Math.round(this.timelineService.zoom() * 0.1));
        this.timelineService.moveBy(direction * step);
    }

    scrollToBoundary(toEnd: boolean) {
        this.timelineService.scrollToBoundary(toEnd);
    }

    private performSearch() {
        const query = this.searchQuery().trim().toUpperCase();
        const ref = this.referenceTrace();

        if (!query || !ref || !ref.result.consensusAlign) {
            this.searchResults.set([]);
            this.currentMatchIndex.set(-1);
            return;
        }

        // Construct sequence string from consensusAlign
        // consensusAlign is Record<number, ...>
        // We need to efficiently search it. 
        // Since it's a map, maybe we should construct the string once or memoize it if possible.
        // For now, let's reconstruct it.

        // Determine max length to iterate
        const len = this.timelineService.maxPosition();
        let sequence = '';

        // NOTE: consensusAlign is 1-based index in keys
        for (let i = 1; i <= len; i++) {
            const item = ref.result.consensusAlign[i];
            if (item && item.cons && item.cons.length > 0) {
                sequence += item.cons[0];
            } else {
                sequence += '-'; // or space?
            }
        }

        const matches: number[] = [];
        let pos = sequence.indexOf(query);
        while (pos !== -1) {
            matches.push(pos); // 0-based index from our constructed string, matches 0-based visualization index
            pos = sequence.indexOf(query, pos + 1);
        }

        this.searchResults.set(matches);
        this.currentMatchIndex.set(matches.length > 0 ? 0 : -1);

        if (matches.length > 0) {
            this.timelineService.setPosition(matches[0]);
        }
    }

    nextMatch() {
        const matches = this.searchResults();
        if (matches.length === 0) return;

        let nextIndex = this.currentMatchIndex() + 1;
        if (nextIndex >= matches.length) {
            nextIndex = 0; // Wrap around
        }

        this.currentMatchIndex.set(nextIndex);
        this.timelineService.setPosition(matches[nextIndex]);
    }

    prevMatch() {
        const matches = this.searchResults();
        if (matches.length === 0) return;

        let prevIndex = this.currentMatchIndex() - 1;
        if (prevIndex < 0) {
            prevIndex = matches.length - 1; // Wrap around
        }

        this.currentMatchIndex.set(prevIndex);
        this.timelineService.setPosition(matches[prevIndex]);
    }
}

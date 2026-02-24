import { Injectable, signal, computed } from '@angular/core';

/**
 * State representing the current view window of a sequence timeline.
 */
export interface TimelineState {
    /** Number of nucleotides visible in the viewport at once */
    zoom: number;
    /** Current starting position of the viewport (0-indexed) */
    position: number;
    /** The absolute maximum position (boundary) of the timeline sequence */
    maxPosition: number;
}

@Injectable({
    providedIn: 'root'
})
export class TimelineService {
    /** 
     * Internal state of the timeline visualization.
     */
    private state = signal<TimelineState>({
        zoom: 100, // Default: 100 nucleotides visible
        position: 0,
        maxPosition: Infinity // Default to Infinity until initialized with sequence length
    });

    /** Current zoom level (number of bases visible) */
    readonly zoom = computed(() => this.state().zoom);
    /** Current starting position in the sequence */
    readonly position = computed(() => this.state().position);
    /** Total length of the sequence being visualized */
    readonly maxPosition = computed(() => this.state().maxPosition);

    /** 
     * Computed range object for use in templates and logic.
     */
    readonly viewRange = computed(() => {
        const s = this.state();
        return {
            start: s.position,
            end: s.position + s.zoom
        };
    });

    // --- Actions ---

    /**
     * Sets the sequence length boundary.
     * Often called from components after sequence data is loaded.
     * @param max - Total number of nucleotides in the sequence
     */
    setMaxPosition(max: number) {
        if (max <= 0) {
            return;
        }
        this.state.update(s => ({ ...s, maxPosition: max }));
        // Ensure current position isn't now out of bounds
        this.setPosition(this.state().position);
    }

    /**
     * Updates the number of bases shown in the viewport.
     * @param zoom - Number of nucleotides
     */
    setZoom(zoom: number) {
        this.state.update(s => ({ ...s, zoom: Math.max(1, zoom) }));
        // Re-validate position because zooming out might push the "end" past maxPosition
        this.setPosition(this.state().position);
    }

    /**
     * Sets the starting position of the viewport.
     * Automatically clamps to valid boundaries [0, maxPosition - zoom].
     * @param position - Genomic or relative sequence position
     */
    setPosition(position: number) {
        this.state.update(s => {
            const viewportInBases = s.zoom;
            // The furthest we can go is maxPosition minus the width of the view
            const maxAllowedStart = Math.max(0, s.maxPosition - viewportInBases);

            // Clamp between 0 and the maxAllowedStart
            const clampedPosition = Math.min(Math.max(0, position), maxAllowedStart);

            return { ...s, position: clampedPosition };
        });
    }

    /**
     * Simultaneously sets the start and end of the visible range.
     * @param start - Start position
     * @param end - End position
     */
    setRange(start: number, end: number) {
        const rangeSize = Math.max(1, end - start);

        this.state.update(s => ({
            ...s,
            zoom: rangeSize,
            position: start
        }));

        // Final pass to ensure the requested range respects maxPosition
        this.setPosition(this.state().position);
    }

    /**
     * Moves the viewport by a relative amount of bases.
     * @param bases - Positive to scroll right, negative to scroll left
     */
    moveBy(bases: number) {
        this.setPosition(this.state().position + bases);
    }

    /**
     * Scrolls the viewport to the very beginning or the very end of the sequence.
     */
    scrollToBoundary(toEnd: boolean) {
        if (toEnd) {
            this.setPosition(this.state().maxPosition);
        } else {
            this.setPosition(0);
        }
    }

    // --- Highlighting Support ---

    /** Current highlighted range for specific UI focus */
    readonly highlightedRange = signal<{ start: number; end: number } | null>(null);

    /**
     * Sets a specific sequence range to be highlighted/focused.
     */
    setHighlight(start: number, end: number) {
        this.highlightedRange.set({ start, end });
    }

    /**
     * Clears any active highlight.
     */
    clearHighlight() {
        this.highlightedRange.set(null);
    }
}
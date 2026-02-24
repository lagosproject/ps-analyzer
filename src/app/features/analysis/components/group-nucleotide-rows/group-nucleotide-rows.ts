import { Component, ChangeDetectionStrategy, input, signal, output, inject, computed, HostListener } from '@angular/core';
import { NucleotideRow } from "../nucleotide-row/nucleotide-row";
import { SignalPopupComponent } from "../../../../shared/components/signal-popup/signal-popup";
import { AnalysisEntry } from '../../../../core/models/analysis.model';
import { TimelineService } from '../../../../core/services/timeline.service';
import { ToastService } from '../../../../core/services/toast.service';

/**
 * Component that groups and manages multiple nucleotide rows (reference and reads).
 * Handles global interactions like selection spanning, context menus, and row expansion.
 */
@Component({
    selector: 'app-group-nucleotide-rows',
    standalone: true,
    imports: [NucleotideRow, SignalPopupComponent],
    templateUrl: './group-nucleotide-rows.html',
    styleUrl: './group-nucleotide-rows.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupNucleotideRows {
    private readonly timelineService = inject(TimelineService);
    private readonly toastService = inject(ToastService);
    private ignoreNextClick = false;

    /** The artificial trace generated for the reference sequence */
    readonly referenceTrace = input<AnalysisEntry | undefined>(undefined);
    /** List of all read traces in the current job */
    readonly traces = input.required<AnalysisEntry[]>();
    /** Map of base pair position to read depth coverage */
    readonly alignmentDepthMap = input.required<Map<number, number>>();

    /** Emitted when a read row wrapper is clicked */
    readonly rowClick = output<string>();
    /** Emitted when a specific nucleotide is clicked */
    readonly nucleotideSelected = output<{ readId: string, refPos: number, isInsertion?: boolean }>();

    /** Tracks which read rows have their allele split view expanded */
    readonly expandedRows = signal<Set<string>>(new Set());

    /** Data model for the right-click context menu / signal popup */
    readonly contextMenuData = signal<{
        readId: string,
        refPos: number,
        sangerPos: number[],
        signals: { a: number, c: number, g: number, t: number }[]
    } | null>(null);
    /** Position in screen coordinates for the context menu */
    readonly contextMenuPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });

    // Selection State
    /** Indicates if the user is currently dragging to select multiple nucleotides */
    readonly isSelecting = signal<boolean>(false);
    /** The index where the drag selection started */
    readonly selectionStart = signal<number | null>(null);
    /** The ID of the read row where the selection is occurring */
    readonly selectingRowId = signal<string | null>(null);
    /** The specific allele index being selected in an expanded row */
    readonly selectingAlleleIndex = signal<number | null>(null);

    /** UI state for the copy selection popup */
    readonly selectionPopUpVisible = signal<boolean>(false);
    /** Screen coordinates for the selection popup */
    readonly selectionPopUpPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });
    private readonly previousSingleHighlight = signal<{ start: number, end: number } | null>(null);

    // Info Tooltip State
    /** The read trace currently being hovered over for info */
    readonly hoveredTrace = signal<AnalysisEntry | null>(null);
    /** Screen coordinates for the trace info tooltip */
    readonly infoTooltipPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });

    /** Triggers the display of the read info tooltip */
    showInfoTooltip(event: MouseEvent, trace: AnalysisEntry) {
        // Position below or above the icon depending on viewport
        const iconRect = (event.target as HTMLElement).getBoundingClientRect();
        this.infoTooltipPosition.set({
            x: iconRect.left + iconRect.width / 2,
            y: iconRect.bottom + 5
        });
        this.hoveredTrace.set(trace);
    }

    /** Hides the read info tooltip */
    hideInfoTooltip() {
        this.hoveredTrace.set(null);
    }


    /** Computes the total length of the reference consensus alignment */
    readonly consensusLength = computed(() => {
        const align = this.referenceTrace()?.result?.consensusAlign;
        return align ? Object.keys(align).length : 0;
    });

    /** Determines if an active drag selection is present */
    readonly selectionActive = computed(() => {
        const range = this.timelineService.highlightedRange();
        return range !== null && range.start !== range.end;
    });



    /** Toggles the allele expansion mode for a specific read */
    toggleRow(readId: string) {
        this.expandedRows.update(prev => {
            const next = new Set(prev);
            if (next.has(readId)) {
                next.delete(readId);
            } else {
                next.add(readId);
            }
            return next;
        });
    }

    /** Checks if a specific read row is currently expanded */
    isExpanded(readId: string): boolean {
        return this.expandedRows().has(readId);
    }

    /** Handler for when an individual nucleotide element is clicked */
    handleNucleotideClick(event: { nucleotide: string; index: number; globalIndex: number; isInsertion?: boolean }, readId?: string) {
        if (readId) {
            this.nucleotideSelected.emit({ readId, refPos: event.index, isInsertion: event.isInsertion });
        }
        // If we were selecting, the selection handles highlighting. If just clicking:
        if (!this.selectionStart()) {
            this.timelineService.setHighlight(event.globalIndex, event.globalIndex);
        }
    }

    /** Starts a drag selection over nucleotides */
    handleMouseDown(event: { index: number; globalIndex: number; alleleIndex: number }, readId: string) {
        const currentHighlight = this.timelineService.highlightedRange();
        if (currentHighlight && currentHighlight.start === currentHighlight.end) {
            this.previousSingleHighlight.set(currentHighlight);
        } else {
            this.previousSingleHighlight.set(null);
        }

        this.isSelecting.set(true);
        this.selectionStart.set(event.globalIndex);
        this.selectingRowId.set(readId);
        this.selectingAlleleIndex.set(event.alleleIndex);
        this.timelineService.setHighlight(event.globalIndex, event.globalIndex);
    }

    /** Updates the drag selection range while moving the mouse over nucleotides */
    handleMouseEnter(event: { index: number; globalIndex: number; alleleIndex: number }, readId: string) {
        if (!this.isSelecting()) return;

        const start = this.selectionStart();
        if (start !== null) {
            const min = Math.min(start, event.globalIndex);
            const max = Math.max(start, event.globalIndex);
            this.timelineService.setHighlight(min, max);
        }
    }

    /** Finalizes a drag selection if the mouse is released anywhere on the document */
    @HostListener('document:mouseup', ['$event'])
    stopSelecting(event: MouseEvent) {
        if (this.isSelecting()) {
            if (this.selectionActive()) {
                const popUpWidth = 150; // Estimated width
                const popUpHeight = 40; // Estimated height

                let x = event.clientX + 5;
                let y = event.clientY + 5;

                // Bound check - Right
                if (x + popUpWidth > window.innerWidth) {
                    x = event.clientX - popUpWidth - 5;
                }

                // Bound check - Bottom
                if (y + popUpHeight > window.innerHeight) {
                    y = event.clientY - popUpHeight - 5;
                }

                this.selectionPopUpVisible.set(true);
                this.selectionPopUpPosition.set({ x, y });
                this.ignoreNextClick = true;
            }
            this.isSelecting.set(false);
        }
    }

    /**
     * Handles right-clicks on a nucleotide to show the chromatogram signal popup.
     */
    handleContextMenu(eventData: { event: MouseEvent, nucleotide: string, index: number, globalIndex: number, isInsertion?: boolean, sangerPos1?: number[], sangerPos2?: number[] }, readId?: string) {
        const traces = this.traces();
        const refTrace = this.referenceTrace();

        let traceEntry: AnalysisEntry | undefined;
        if (readId === 'Reference') {
            traceEntry = refTrace;
        } else {
            traceEntry = traces.find(t => t.readId === readId);
        }

        if (!traceEntry || !traceEntry.result.trace) return;

        const { traceA, traceC, traceG, traceT, peakLocations } = traceEntry.result.trace;
        const sangerPositions: number[] = [];
        if (eventData.sangerPos1) sangerPositions.push(...eventData.sangerPos1);
        if (eventData.sangerPos2) sangerPositions.push(...eventData.sangerPos2);

        const signalValues = sangerPositions.map(pos => {
            const scanIndex = peakLocations[pos - 1];

            return {
                a: traceA[scanIndex] || 0,
                c: traceC[scanIndex] || 0,
                g: traceG[scanIndex] || 0,
                t: traceT[scanIndex] || 0
            };
        });

        // Add a small offset to avoid the cursor being directly over the popover content
        this.contextMenuPosition.set({ x: eventData.event.clientX + 5, y: eventData.event.clientY + 5 });
        this.contextMenuData.set({
            readId: readId || 'Unknown',
            refPos: eventData.index,
            sangerPos: sangerPositions,
            signals: signalValues
        });
    }

    /**
     * Initiates the copy-to-clipboard functionality for a selected sequence range.
     * @param allele The sequence strand to copy ('cons', 'alt1', 'alt2')
     */
    async copySequence(allele: 'cons' | 'alt1' | 'alt2') {
        const data = this.contextMenuData();
        const rowId = data ? data.readId : this.selectingRowId();

        if (!rowId) return;

        const traces = this.traces();
        const refTrace = this.referenceTrace();

        let traceEntry: AnalysisEntry | undefined;
        if (rowId === 'Reference') {
            traceEntry = refTrace;
        } else {
            traceEntry = traces.find(t => t.readId === rowId);
        }

        if (!traceEntry || !traceEntry.result.consensusAlign) {
            this.toastService.show('Sequence data not found', 'error');
            return;
        }

        const align = traceEntry.result.consensusAlign;
        const range = this.timelineService.highlightedRange();

        const sortedKeys = Object.keys(align).sort((a, b) => parseInt(a) - parseInt(b));

        let fullSequence = '';
        for (const key of sortedKeys) {
            const globalIndex = parseInt(key) - 1; // Assuming 1-based refPos maps to index 0

            // If we have a range, filter by it
            if (range && (globalIndex < range.start || globalIndex > range.end)) {
                continue;
            }

            const item = align[key];
            const chars = item[allele];
            if (chars) {
                fullSequence += chars.join('').replace(/-/g, '');
            }
        }

        if (!fullSequence) {
            this.toastService.show('Sequence is empty', 'info');
            return;
        }

        try {
            await navigator.clipboard.writeText(fullSequence);
            this.toastService.show('Sequence copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy: ', err);
            this.toastService.show('Failed to copy sequence', 'error');
        } finally {
            this.closeContextMenu();
        }
    }

    @HostListener('document:click')
    @HostListener('document:contextmenu')
    closeContextMenu() {
        if (this.ignoreNextClick) {
            this.ignoreNextClick = false;
            return;
        }

        if (this.contextMenuData()) {
            this.contextMenuData.set(null);
        }
        if (this.selectionPopUpVisible()) {
            this.selectionPopUpVisible.set(false);

            // Restore previous highlight if we were in a multi-selection
            const prev = this.previousSingleHighlight();
            if (prev) {
                this.timelineService.setHighlight(prev.start, prev.end);
                this.previousSingleHighlight.set(null);
            } else {
                this.timelineService.clearHighlight();
            }
        }
    }
}

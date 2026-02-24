import { Component, ChangeDetectionStrategy, output, input, inject, computed, signal } from '@angular/core';
import { AnalysisEntry } from '../../../../core/models/analysis.model';
import { TimelineService } from '../../../../core/services/timeline.service';

@Component({
    selector: 'app-nucleotide-row',
    standalone: true,
    imports: [],
    templateUrl: './nucleotide-row.html',
    styleUrl: './nucleotide-row.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NucleotideRow {
    protected readonly timelineService = inject(TimelineService);

    // Modern Signal Inputs
    readonly trace = input<AnalysisEntry | undefined>(undefined);

    readonly alignmentDepthMap = input.required<Map<number, number>>();

    // Modern Signal Output
    readonly nucleotideClicked = output<{ nucleotide: string; index: number; globalIndex: number; isInsertion?: boolean }>();
    readonly nucleotideRightClicked = output<{ event: MouseEvent, nucleotide: string; index: number; globalIndex: number; isInsertion?: boolean, sangerPos1?: number[], sangerPos2?: number[] }>();
    readonly nucleotideMouseDown = output<{ index: number; globalIndex: number; alleleIndex: number }>();
    readonly nucleotideMouseEnter = output<{ index: number; globalIndex: number; alleleIndex: number }>();

    // Colors for bases
    private readonly colors = {
        'A': '#32CD32', // Green
        'C': '#0000FF', // Blue
        'G': '#000000', // Black
        'T': '#FF0000', // Red
        'R': '#808000', // Olive (A or G)
        'Y': '#800080', // Purple (C or T)
        'S': '#008080', // Teal (G or C)
        'W': '#808080', // Gray (A or T)
        'K': '#404000', // Darker (G or T)
        'M': '#004040', // Darker (A or C)
        'N': '#D3D3D3', // Light Gray (Any)
        '-': '#D3D3D3'  // Gap
    };


    readonly expanded = input<boolean>(false);
    readonly isSelectedRow = input<boolean>(false);
    readonly showAllBases = input<boolean>(false);

    readonly hasMultipleAlleles = computed(() => {
        const trace = this.trace();
        if (!trace?.result.consensusAlign) return false;
        return Object.values(trace.result.consensusAlign).some(item => item.alt1.length > 0 || item.alt2.length > 0);
    });

    // Item types for the template
    readonly visibleAlleles = computed(() => {
        const trace = this.trace();
        if (!trace || !trace.result.consensusAlign) return [];

        const consensusAlign = trace.result.consensusAlign;
        const isExp = this.expanded();
        const depthMap = this.alignmentDepthMap();

        // Map for fast lookup: refPos -> Item
        // optimization: if consensusAlign is sorted by refPos, we could use binary search or just map.
        // For array size ~1000-10000, Map is fine. 
        // We can cache this map if performance is an issue, but computed() memoizes result until dependency changes.
        // However, converting to Map every time zoom changes (view changes) might be expensive if dependent on view?
        // Wait, visibleAlleles depends on `timelineService.viewRange()`. 
        // We should create the Map outside the view loop if possible, but we can't inside computed easily without another signal.
        // Let's build the map for the *visible range only*? No, we need to find items by refPos.
        // Better: Just build a Map of the whole alignment once? 
        // Or just map it every time. Javascript is fast.

        const view = this.timelineService.viewRange();
        const highlight = this.timelineService.highlightedRange();

        const viewStart = Math.floor(view.start);
        const viewEnd = Math.ceil(view.end);
        const totalCells = viewEnd - viewStart;

        // Rows content
        const rows: any[][] = [[], [], []]; // 0: Cons, 1: Alt1, 2: Alt2

        for (let i = 0; i < totalCells; i++) {
            const currentGlobalIndex = viewStart + i;
            // refPos is 1-based, matching currentGlobalIndex? 
            // In analysis.ts we set refPos = i + 1 for reference.
            // If viewStart=0, refPos=1.
            const refPos = currentGlobalIndex + 1; // Assuming 0-based view, 1-based refPos

            const item = consensusAlign[refPos.toString()];
            // Get max depth at this position from the global map, default to 1
            const maxDepth = depthMap.get(refPos) || 1;

            // Determine if highlighted
            let isHighlighted = false;
            if (highlight) {
                if (currentGlobalIndex >= highlight.start && currentGlobalIndex <= highlight.end) {
                    isHighlighted = true;
                }
            }

            // Iterate through the depth "slots" at this position
            // For example if maxDepth is 2 (one insertion), we render 2 columns for this refPos?
            // Wait, no. The user wants "space". 
            // If the user meant horizontal space: we need to render multiple items for the SAME refPos.
            // So if refPos 10 has depth 3 (A, - , - in one read; A, T, C in another), 
            // we need to render 3 cells for refPos 10. 
            // BUT: The view logic (totalCells) iterates over global visual blocks.
            // If we want to show gaps, we need the "global index" to expand to cover these gaps.
            // The problem is `timelineService` manages the X axis. If refPos 10 needs 3 slots, 
            // then refPos 11 implies the previous ones took 3 slots?
            // This implies the X axis is not linear 1-1 with refPos anymore if we "insert" visual gaps.
            // Or does "keep that space" mean just render multiple items in the same cell?
            // "if there are many letters in alt1 or alt2 is becouse are additions, keep that space on reference"
            // This usually implies fitting multiple letters in one box, OR expanding the reference with gaps.

            // Re-reading: "use it to shoe the overall" (show the overall).
            // "keep that space on reference".
            // If I render multiple items for one `refPos`, I break the 1-1 mapping with the X axis (unless I change the width).
            // BUT currently the view iterates `currentGlobalIndex`. 
            // If `TimelineService` assumes 1 unit = 1 base, then expanding reference means reference needs padding.

            // Alternative interpretation: 
            // Just render the items. If refPos 10 has 3 items, render 3 buttons.
            // If refPos 11 follows, it will be placed after those 3.
            // The `globalIndex` logic in the loop `viewStart + i` assumes 1 item per loop.
            // If we render multiple items per loop iteration, we are compressing them into one "view unit" visually? 
            // No, the HTML is `display: flex`. They will just lay out.
            // If I emit 3 buttons for one loop iteration, the row becomes wider than expected for the viewport.
            // This might look okay if all rows do it consistently (which they will, using `maxDepth`).

            // So, for each `refPos`, we Loop `k` from 0 to `maxDepth - 1`.

            for (let k = 0; k < maxDepth; k++) {
                // For consensus row
                let consChar = '-';
                // If item exists, check if it has a char at k.
                // item.cons is array.
                if (item && k < item.cons.length) {
                    consChar = item.cons[k];
                } else if (item && item.cons.length > 0 && k >= item.cons.length) {
                    // Gap filler for reference/consensus if it's shorter than max depth
                    consChar = '-';
                } else if (!item) {
                    // No item at this refPos at all? Spacer/Gap.
                    consChar = '-'; // Or just spacer?
                }

                rows[0].push({
                    type: 'nucleotide',
                    char: consChar,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: false, // Consensus row is reference, don't hide
                    isHighlighted,
                    showAlways: true, // Reference row should always show bases
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });

                // Row 1: Alt1
                let alt1Char = '-';
                if (item && k < item.alt1.length) {
                    alt1Char = item.alt1[k];
                }

                rows[1].push({
                    type: 'nucleotide',
                    char: alt1Char,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: alt1Char === consChar,
                    isInsertion: alt1Char !== '-' && consChar === '-',
                    isHighlighted,
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });

                // Row 2: Alt2
                let alt2Char = '-';
                if (item && k < item.alt2.length) {
                    alt2Char = item.alt2[k];
                }

                rows[2].push({
                    type: 'nucleotide',
                    char: alt2Char,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: alt2Char === consChar,
                    isInsertion: alt2Char !== '-' && consChar === '-',
                    isHighlighted,
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });
            }
        }

        // Filter rows based on expansion
        if (!isExp) {
            return [rows[0]];
        }

        return rows;
    });

    getColorForNucleotide(nucleotide: string): string {
        return this.colors[nucleotide as keyof typeof this.colors] || '#999999';
    }

    onNucleotideClick(nucleotide: string, index: number, globalIndex: number, isInsertion?: boolean): void {
        this.nucleotideClicked.emit({ nucleotide, index, globalIndex, isInsertion });
    }

    onContextMenu(event: MouseEvent, nucleotide: string, index: number, globalIndex: number, isInsertion?: boolean, sangerPos1?: number[], sangerPos2?: number[]): void {
        event.preventDefault();
        event.stopPropagation();
        this.nucleotideRightClicked.emit({ event, nucleotide, index, globalIndex, isInsertion, sangerPos1, sangerPos2 });
    }

    onMouseDown(index: number, globalIndex: number, alleleIndex: number): void {
        this.nucleotideMouseDown.emit({ index, globalIndex, alleleIndex });
    }

    onMouseEnter(index: number, globalIndex: number, alleleIndex: number): void {
        this.nucleotideMouseEnter.emit({ index, globalIndex, alleleIndex });
    }
}

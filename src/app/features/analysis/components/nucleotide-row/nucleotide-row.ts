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
    readonly nucleotideClicked = output<{ nucleotide: string; index: number; globalIndex: number; isInsertion?: boolean, subIndex?: number }>();
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

        const view = this.timelineService.viewRange();
        const highlight = this.timelineService.highlightedRange();

        const viewStart = Math.floor(view.start);
        const viewEnd = Math.ceil(view.end);
        const totalCells = viewEnd - viewStart;

        // Rows content
        const rows: any[][] = [[], [], []]; // 0: Cons, 1: Alt1, 2: Alt2

        for (let i = 0; i < totalCells; i++) {
            const currentGlobalIndex = viewStart + i;
            const refPos = currentGlobalIndex + 1;

            const item = consensusAlign[refPos.toString()];
            const maxDepth = depthMap.get(refPos) || 1;

            let isHighlighted = false;
            if (highlight) {
                if (currentGlobalIndex >= highlight.start && currentGlobalIndex <= highlight.end) {
                    isHighlighted = true;
                }
            }

            for (let k = 0; k < maxDepth; k++) {
                let consChar = '-';
                if (item && k < item.cons.length) {
                    consChar = item.cons[k];
                } else if (item && item.cons.length > 0 && k >= item.cons.length) {
                    consChar = '-';
                } else if (!item) {
                    consChar = '-';
                }

                rows[0].push({
                    type: 'nucleotide',
                    char: consChar,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: false,
                    isHighlighted,
                    showAlways: true,
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });

                // Row 1: Alt1
                let alt1Char = '-';
                if (item && k < item.alt1.length) {
                    alt1Char = item.alt1[k];
                }

                // Row 2: Alt2
                let alt2Char = '-';
                if (item && k < item.alt2.length) {
                    alt2Char = item.alt2[k];
                }

                // If one allele is a deletion and the other is not, we show both even if one matches consensus
                const isHetDeletion = (alt1Char !== alt2Char) && (alt1Char === '-' || alt2Char === '-');

                rows[1].push({
                    type: 'nucleotide',
                    char: alt1Char,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: isHetDeletion ? false : (alt1Char === consChar),
                    isInsertion: alt1Char !== '-' && consChar === '-',
                    isHighlighted,
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });

                rows[2].push({
                    type: 'nucleotide',
                    char: alt2Char,
                    index: refPos,
                    subIndex: k,
                    globalIndex: currentGlobalIndex,
                    isMatch: isHetDeletion ? false : (alt2Char === consChar),
                    isInsertion: alt2Char !== '-' && consChar === '-',
                    isHighlighted,
                    isSequenceSelection: isHighlighted && this.isSelectedRow(),
                    sangerPos1: item?.sangerPos1,
                    sangerPos2: item?.sangerPos2
                });
            }
        }

        if (!isExp) {
            return [rows[0]];
        }

        return rows;
    });

    getColorForNucleotide(nucleotide: string): string {
        return this.colors[nucleotide as keyof typeof this.colors] || '#999999';
    }

    onNucleotideClick(nucleotide: string, index: number, globalIndex: number, isInsertion?: boolean, subIndex?: number): void {
        this.nucleotideClicked.emit({ nucleotide, index, globalIndex, isInsertion, subIndex });
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

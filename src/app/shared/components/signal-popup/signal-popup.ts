import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/**
 * Data structure for the signal popup displaying nucleotide details.
 */
export interface SignalPopupData {
    /** Identifier of the read or reference. */
    readId: string;
    /** Position in the reference sequence. */
    refPos: number;
    /** Custom label for the position (default: "Ref Pos"). */
    posLabel?: string;
    /** Related positions in the Sanger sequence. */
    sangerPos: number[];
    /** Signal intensities for each base (A, C, G, T) at the related Sanger positions. */
    signals: { a: number, c: number, g: number, t: number }[];
}

@Component({
    selector: 'app-signal-popup',
    standalone: true,
    imports: [],
    templateUrl: './signal-popup.html',
    styleUrl: './signal-popup.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalPopupComponent {
    /** The data to be displayed in the popup. */
    readonly data = input.required<SignalPopupData>();

    /** The absolute screen position for the popup. */
    readonly position = input.required<{ x: number, y: number }>();

    /** Whether to show buttons for copying the sequence. */
    readonly showCopyButtons = input<boolean>(true);

    /** Event emitted when a user requests to copy a specific allele sequence. */
    readonly copy = output<'cons' | 'alt1' | 'alt2'>();

    /**
     * Emits the copy event for the given allele.
     * @param allele The allele type to copy.
     */
    onCopy(allele: 'cons' | 'alt1' | 'alt2') {
        this.copy.emit(allele);
    }
}

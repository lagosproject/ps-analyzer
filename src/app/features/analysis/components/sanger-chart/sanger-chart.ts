import { Component, ElementRef, input, ChangeDetectionStrategy, signal, computed, effect, viewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalysisResult, ConsensusAlignItem, Variant } from '../../../../core/models/analysis.model';
import { SignalPopupComponent, SignalPopupData } from "../../../../shared/components/signal-popup/signal-popup";

/**
 * Component for displaying a Sanger sequencing chromatogram with associated alignments and annotations.
 */
@Component({
    selector: 'app-sanger-chart',
    standalone: true,
    imports: [CommonModule, SignalPopupComponent],
    templateUrl: './sanger-chart.html',
    styleUrl: './sanger-chart.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SangerChartComponent {
    /** The raw trace data containing signal amplitudes and peak locations */
    trace = input<AnalysisResult['trace'] | undefined>();
    /** Known variants to annotate on the chart */
    variants = input<Variant[]>([]);
    /** Patient or sample name for the overlay label */
    patientName = input<string>('');
    /** Alignment direction: 1 for Forward, 0 for Reverse */
    refForward = input<number>(1);

    /** Current visible range in reference coordinates */
    viewRange = input<{ start: number, end: number }>();

    /** Unique identifier for the read */
    readId = input.required<string>();
    /** Mapping of reference positions to sanger trace positions */
    consensusAlign = input<Record<string, ConsensusAlignItem>>({});
    /** Starting position of the alignment on the reference */
    refStart = input<number>(0);
    /** Number of base pairs trimmed from the left */
    trimLeft = input<number>(0);
    /** Number of base pairs trimmed from the right */
    trimRight = input<number>(0);
    /** Consensus sequence built from the read */
    readSeqConsensus = input<string[]>([]);
    /** Reverse complement of the consensus sequence */
    readSeqConsensusComplementary = input<string[]>([]);
    /** Reference sequence slice corresponding to the alignment */
    readSeqRef = input<string[]>([]);
    /** Height of the SVG element in pixels */
    height = input<number>(150);
    /** If true, disables panning and zooming for static rendering (e.g. reports) */
    staticMode = input<boolean>(false);

    // View Children
    scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

    // Signals for State
    zoomX = signal<number>(10); // Pixels per base/scan point - start wider
    zoomY = signal<number>(1);  // Vertical amplification

    // Popup State
    popupVisible = signal<boolean>(false);
    popupData = signal<SignalPopupData | null>(null);
    popupPosition = signal<{ x: number, y: number }>({ x: 0, y: 0 });

    // Computed Properties

    consensusBases = computed(() => {
        const t = this.trace();
        const isRev = this.isReverse();
        const consensus = isRev ? this.readSeqConsensusComplementary() : this.readSeqConsensus();
        if (!t || !t.peakLocations || !consensus || consensus.length === 0) return [];

        const zX = this.zoomX();
        const locs = t.peakLocations;

        return consensus.map((base: string, i: number) => {
            if (i >= locs.length) return null;
            return {
                base,
                index: i,
                x: locs[i] * zX
            };
        }).filter((b: { base: string, index: number, x: number } | null) => b !== null) as { base: string, index: number, x: number }[];
    });

    referenceBases = computed(() => {
        const t = this.trace();
        const refSeq = this.readSeqRef();

        if (!t || !t.peakLocations || !refSeq || refSeq.length === 0) return [];

        const zX = this.zoomX();
        const locs = t.peakLocations;

        const seqArray = (typeof refSeq === 'string' ? Array.from(refSeq) : refSeq) as string[];

        return seqArray.map((base: string, i: number) => {
            if (i >= locs.length) return null;
            const x = locs[i] * zX;

            return {
                base,
                index: i,
                x
            };
        }).filter((b: { base: string, index: number, x: number } | null) => b !== null) as { base: string, index: number, x: number }[];
    });

    // Max value in all traces for normalization
    maxAmplitude = computed(() => {
        const t = this.trace();
        if (!t) return 100;
        const maxA = Math.max(...t.traceA);
        const maxC = Math.max(...t.traceC);
        const maxG = Math.max(...t.traceG);
        const maxT = Math.max(...t.traceT);
        return Math.max(maxA, maxC, maxG, maxT, 10); // Minimum 10 to avoid div by zero
    });

    constructor() {
        effect(() => {
            const range = this.viewRange();
            const container = this.scrollContainer()?.nativeElement;
            const t = this.trace();
            const align = this.consensusAlign();

            if (range && container && t && t.peakLocations && align) {
                const locs = t.peakLocations;

                // Map reference range to sanger indices
                const startItem = align[range.start.toString()];
                const endItem = align[range.end.toString()];

                let sangerStartIdx = startItem?.sangerPos1?.[0] ?? (range.start - this.refStart());
                let sangerEndIdx = endItem?.sangerPos1?.[0] ?? (range.end - this.refStart());

                // Ensure bounds
                sangerStartIdx = Math.max(0, Math.min(sangerStartIdx, locs.length - 1));
                sangerEndIdx = Math.max(0, Math.min(sangerEndIdx, locs.length - 1));

                const startScan = locs[sangerStartIdx];
                const endScan = locs[sangerEndIdx];
                const scansInRange = endScan - startScan;

                if (scansInRange > 0) {
                    const newZoom = container.clientWidth / scansInRange;

                    // Avoid infinite loops or crazy values
                    if (newZoom > 0 && isFinite(newZoom)) {
                        this.zoomX.set(newZoom);
                        setTimeout(() => {
                            const currentContainer = this.scrollContainer()?.nativeElement;
                            if (currentContainer && !this.staticMode()) {
                                currentContainer.scrollLeft = startScan * newZoom;
                            }
                        }, 0);
                    }
                }
            }
        });
    }

    /** State flag for displaying the reverse complement chromatogram */
    isReverse = signal<boolean>(false);

    /** Toggles the view between forward and reverse complement */
    toggleReverse() {
        // Block reverse for original forward sequences
        if (this.refForward() === 1) return;
        this.isReverse.update((v: boolean) => !v);
    }

    onBaseClick(event: MouseEvent, index: number) {
        event.stopPropagation();
        const t = this.trace();
        if (!t || !t.peakLocations) return;

        const scanIndex = t.peakLocations[index];
        const signals = {
            a: t.traceA[scanIndex] || 0,
            c: t.traceC[scanIndex] || 0,
            g: t.traceG[scanIndex] || 0,
            t: t.traceT[scanIndex] || 0
        };

        this.popupData.set({
            readId: this.readId(),
            refPos: index + 1, // Use scanIndex as requested
            posLabel: 'Sanger Pos', // Custom label
            sangerPos: [index + 1],
            signals: [signals]
        });

        // Position popup near the click
        this.popupPosition.set({
            x: event.clientX,
            y: event.clientY
        });

        this.popupVisible.set(true);
    }

    closePopup() {
        this.popupVisible.set(false);
        this.popupData.set(null);
    }


    // Generate SVG Paths
    tracePaths = computed(() => {
        const t = this.trace();
        if (!t) return { a: '', c: '', g: '', t: '' };

        const zX = this.zoomX();
        const zY = this.zoomY();
        const maxAmp = this.maxAmplitude();
        const h = this.height();
        const reverse = this.isReverse();

        // Helper to generate path d attribute
        const makePath = (data: number[]) => {
            return data.map((val: number, i: number) => {
                const x = i * zX; // index * zoomX 

                const axisHeight = 50;
                const graphHeight = h - axisHeight;

                const normalizedY = (val / maxAmp) * zY;

                // Y calculation:
                // 0 val -> graphHeight (bottom of graph area)

                const y = graphHeight - (normalizedY * graphHeight);

                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }).join(' ');
        };

        // If reverse is true, we swap the CHANNELS but keep the order/positions same.
        // A (Green) <-> T (Red)
        // C (Blue) <-> G (Black)

        // tracePaths returns { a, c, g, t } which correspond to the SVG paths:
        // .trace-a -> stroke: green
        // .trace-c -> stroke: blue
        // .trace-g -> stroke: black
        // .trace-t -> stroke: red

        if (reverse) {
            return {
                a: makePath(t.traceT), // Show T data in Green channel
                c: makePath(t.traceG), // Show G data in Blue channel
                g: makePath(t.traceC), // Show C data in Black channel
                t: makePath(t.traceA)  // Show A data in Red channel
            };
        }

        return {
            a: makePath(t.traceA),
            c: makePath(t.traceC),
            g: makePath(t.traceG),
            t: makePath(t.traceT)
        };
    });

    staticViewBox = computed(() => {
        if (!this.staticMode()) return null;
        const range = this.viewRange();
        const t = this.trace();
        const align = this.consensusAlign();
        if (!range || !t || !t.peakLocations || !align) return null;

        // Try to map refPos to sangerPos
        // Range is given in refPos (e.g., variant pos +/- 25)
        const startItem = align[range.start.toString()];
        const endItem = align[range.end.toString()];

        // SangerPos in alignment is 1-based, peakLocations is 0-based
        let sangerStartIdx = (startItem?.sangerPos1?.[0] ? startItem.sangerPos1[0] - 1 : (range.start - this.refStart()));
        let sangerEndIdx = (endItem?.sangerPos1?.[0] ? endItem.sangerPos1[0] - 1 : (range.end - this.refStart()));

        // Ensure bounds
        sangerStartIdx = Math.max(0, Math.min(sangerStartIdx, t.peakLocations.length - 1));
        sangerEndIdx = Math.max(0, Math.min(sangerEndIdx, t.peakLocations.length - 1));

        if (sangerStartIdx > sangerEndIdx) {
            const temp = sangerStartIdx;
            sangerStartIdx = sangerEndIdx;
            sangerEndIdx = temp;
        }

        const locs = t.peakLocations;
        const startScan = locs[sangerStartIdx] || 0;
        const endScan = locs[sangerEndIdx] || 0;

        const zX = this.zoomX();
        // Add a bit of padding (e.g., 50 pixels)
        const padding = 50;
        const startX = Math.max(0, (startScan * zX) - padding);
        const width = Math.max(100, ((endScan - startScan) * zX) + (padding * 2));

        return `${startX} 0 ${width} ${this.height()}`;
    });

    // Determine total width based on trace length
    totalWidth = computed(() => {
        const t = this.trace();
        if (!t || !t.traceA || t.traceA.length === 0) return 0;
        return t.traceA.length * this.zoomX();
    });

    // Generate ticks and grid lines
    // We want ticks every 5 nucleotides.
    ticks = computed(() => {
        const t = this.trace();
        if (!t) return [];

        const zX = this.zoomX();
        const locs = t.peakLocations;
        const ticks: { x: number, label: number }[] = [];

        // Let's iterate through peakLocations
        locs.forEach((scanIndex: number, baseIndex: number) => {
            // baseIndex is 0-based index of the base in the read
            // We want every 5th base
            if ((baseIndex + 1) % 5 === 0) {
                const x = scanIndex * zX;
                ticks.push({ x, label: baseIndex + 1 });
            }
        });
        return ticks;
    });

    // Horizontal grid lines for height intervals (e.g., 25%, 50%, 75%, 100% of max view)
    gridLines = computed(() => {
        const h = this.height();
        const axisHeight = 50; // Must match tracePaths
        const graphHeight = h - axisHeight;

        // Fixed lines at 25%, 50%, 75% of GRAPH height
        return [0.25, 0.5, 0.75].map(ratio => graphHeight - (ratio * graphHeight));
    });


    deletionMarkers = computed(() => {
        const variants = this.variants();
        const zX = this.zoomX();

        if (!variants || variants.length === 0) return [];

        const markers: { x: number, label: string, tooltip: string }[] = [];

        for (const v of variants) {
            const isDeletion = v.ref.length > v.alt.length;

            if (isDeletion) {
                const sp = v['signalpos'];
                const genotype = v['genotype'] || '';
                const genotypeShort = genotype === 'hom. ALT' ? 'hom' : (genotype === 'het.' ? 'het' : '');
                const label = genotypeShort ? `DEL (${genotypeShort})` : 'DEL';

                if (sp !== undefined && sp !== null) {
                    const commonPrefixLen = this.getCommonPrefixLength(v.ref, v.alt);
                    const displayedDeleted = v.ref.substring(commonPrefixLen);

                    markers.push({
                        x: sp * zX,
                        label: label,
                        tooltip: `Deletion: ${displayedDeleted}\nGenotype: ${genotype}\nRef: ${v.ref}\nRead: ${v.alt}`
                    });
                }
            }
        }
        return markers;
    });

    trimOverlay = computed(() => {
        const t = this.trace();
        const zX = this.zoomX();
        const tL = this.trimLeft();
        const tR = this.trimRight();

        if (!t || !t.peakLocations) return { leftWidth: 0, rightX: 0, rightWidth: 0 };

        const locs = t.peakLocations;
        const totalLen = t.traceA.length;

        // Left trim boundary in scan points
        const leftBoundaryIndex = Math.min(tL, locs.length - 1);
        const leftX = (leftBoundaryIndex > 0 ? locs[leftBoundaryIndex - 1] : 0) * zX;

        // Right trim boundary in scan points
        const rightBoundaryIndex = Math.max(0, locs.length - tR);
        const rightX = (rightBoundaryIndex < locs.length ? locs[rightBoundaryIndex] : totalLen) * zX;
        const totalWidth = totalLen * zX;

        return {
            leftWidth: leftX,
            rightX: rightX,
            rightWidth: Math.max(0, totalWidth - rightX)
        };
    });

    snvMarkers = computed(() => {
        const variants = this.variants();
        const zX = this.zoomX();

        if (!variants || variants.length === 0) return [];

        const markers: { x: number, label: string, tooltip: string }[] = [];

        for (const v of variants) {
            // SNV Definition: Ref length 1, Alt length 1, and they are different (implied by being a variant)
            const isSNV = v.ref.length === 1 && v.alt.length === 1;

            if (isSNV) {
                const sp = v['signalpos'];
                const genotype = v['genotype'] || '';
                const genotypeShort = genotype === 'hom. ALT' ? 'hom' : (genotype === 'het.' ? 'het' : '');
                const label = genotypeShort ? `SNV (${genotypeShort})` : 'SNV';

                if (sp !== undefined && sp !== null) {
                    markers.push({
                        x: sp * zX,
                        label: label,
                        tooltip: `SNV: ${v.ref} -> ${v.alt}\nGenotype: ${genotype}\nPosition: ${v.position}`
                    });
                }
            }
        }
        return markers;
    });

    private getCommonPrefixLength(s1: string, s2: string): number {
        let i = 0;
        while (i < s1.length && i < s2.length && s1[i] === s2[i]) i++;
        return i;
    }

    // Highlights
    private highlightConfigs = signal<{ pos: number, color: string, label?: string }[]>([]);

    highlights = computed(() => {
        const t = this.trace();
        if (!t) return [];
        const zX = this.zoomX();
        return this.highlightConfigs().map((hc: { pos: number, color: string, label?: string }) => ({
            x: t.peakLocations[hc.pos - 1] * zX,
            color: hc.color,
            label: hc.label
        }));
    });

    highlightIndices(indices: { pos: number, color: string, label?: string }[]) {
        this.highlightConfigs.set(indices);

        if (indices.length > 0) {
            const t = this.trace();
            if (t) {
                const x = t.peakLocations[indices[0].pos - 1] * this.zoomX();
                this.centerOnX(x);
            }
        }
    }

    centerOnX(x: number) {
        if (this.staticMode()) return;
        const container = this.scrollContainer()?.nativeElement;
        if (container) {
            const containerWidth = container.clientWidth;
            container.scrollTo({
                left: x - (containerWidth / 2),
                behavior: 'smooth'
            });
        }
    }

    private pendingZoomFactor = 1;
    private zoomFrameRequested = false;
    private lastFocalX: number | undefined = undefined;

    zoomInX() {
        this.requestZoomX(1.5);
    }

    zoomOutX() {
        this.requestZoomX(1 / 1.5);
    }

    private requestZoomX(factor: number, focalX?: number) {
        if (this.staticMode()) return;
        this.pendingZoomFactor *= factor;
        this.lastFocalX = focalX;

        if (!this.zoomFrameRequested) {
            this.zoomFrameRequested = true;
            requestAnimationFrame(() => {
                this.applyZoomX(this.pendingZoomFactor, this.lastFocalX);
                this.pendingZoomFactor = 1;
                this.zoomFrameRequested = false;
            });
        }
    }

    private applyZoomX(factor: number, focalPointCanvasX?: number) {
        const container = this.scrollContainer()?.nativeElement;
        if (!container) return;

        const oldZoom = this.zoomX();
        // Cap the factor to avoid extreme jumps in a single frame
        const safeFactor = Math.max(0.1, Math.min(10, factor));
        const newZoom = Math.max(0.1, oldZoom * safeFactor);

        // Focal point relative to the container viewport
        const focalX = focalPointCanvasX ?? (container.clientWidth / 2);
        const scrollLeft = container.scrollLeft;

        // Focal point relative to the scrollable content
        const focalPointContentX = scrollLeft + focalX;

        // The logical position (e.g. scan index) at that point
        const positionAtFocalPoint = focalPointContentX / oldZoom;

        // Apply new zoom
        this.zoomX.set(newZoom);

        // Calculate expected new scroll position
        const newFocalPointContentX = positionAtFocalPoint * newZoom;
        const newScrollLeft = newFocalPointContentX - focalX;

        // CRITICAL: We MUST wait for the DOM to update (SVG width change) before setting scrollLeft
        // otherwise the browser will clamp the value to the OLD width, causing drift.
        setTimeout(() => {
            const currentContainer = this.scrollContainer()?.nativeElement;
            if (currentContainer) {
                currentContainer.scrollLeft = newScrollLeft;
            }
        }, 0);
    }

    zoomFullX() {
        if (this.staticMode()) return;
        const t = this.trace();
        const container = this.scrollContainer()?.nativeElement;
        if (!t || !container || t.traceA.length === 0) return;

        // Fit total trace width to container width
        // totalWidth = traceLen * zoomX
        const newZoom = container.clientWidth / t.traceA.length;
        this.zoomX.set(Math.max(0.01, newZoom));
    }

    zoomInY() {
        if (this.staticMode()) return;
        this.zoomY.update((z: number) => z * 1.5);
    }

    zoomOutY() {
        if (this.staticMode()) return;
        this.zoomY.update((z: number) => Math.max(0.1, z / 1.5));
    }

    zoomFullY() {
        if (this.staticMode()) return;
        this.zoomY.set(1);
    }

    // Drag Scrolling State
    isDragging = false;
    startX = 0;
    scrollLeftStart = 0;

    onMouseDown(event: MouseEvent) {
        if (this.staticMode()) return;
        // Only trigger on left click
        if (event.button !== 0) return;

        this.isDragging = true;
        this.startX = event.pageX - (this.scrollContainer()?.nativeElement.offsetLeft || 0);
        this.scrollLeftStart = this.scrollContainer()?.nativeElement.scrollLeft || 0;
    }

    onMouseLeave() {
        this.isDragging = false;
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onMouseMove(event: MouseEvent) {
        if (!this.isDragging) return;

        event.preventDefault();
        const x = event.pageX - (this.scrollContainer()?.nativeElement.offsetLeft || 0);
        const walk = (x - this.startX); // Scroll fast
        if (this.scrollContainer()?.nativeElement) {
            this.scrollContainer()!.nativeElement.scrollLeft = this.scrollLeftStart - walk;
        }
    }

    onWheel(event: WheelEvent) {
        if (this.staticMode()) return;
        if (event.ctrlKey) {
            event.preventDefault();
            // Horizontal Zoom
            const container = this.scrollContainer()?.nativeElement;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;

            // Proportional zoom factor
            const factor = Math.pow(1.1, -event.deltaY / 100);
            this.requestZoomX(factor, mouseX);
        } else if (event.shiftKey) {
            event.preventDefault();
            // Vertical Zoom
            // Shift+Wheel often maps to deltaX in browsers
            const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
            if (delta === 0) return;

            const direction = delta > 0 ? -1 : 1;
            this.zoomY.update(z => {
                const newZ = z * (direction > 0 ? 1.1 : 0.9);
                return Math.max(0.1, newZ);
            });
        } else if (event.altKey) {
            event.preventDefault();
            // Horizontal Scroll
            const container = this.scrollContainer()?.nativeElement;
            if (container) {
                container.scrollLeft += event.deltaY;
            }
        }
    }

    /**
     * Centers the chart view on a logical nucleotide index.
     * @param baseIndex 0-based nucleotide index
     */
    centerOnIndex(baseIndex: number) {
        const t = this.trace();
        if (!t) return;
        const locs = t.peakLocations;
        if (baseIndex < 0 || baseIndex >= locs.length) return;

        const scanIndex = locs[baseIndex];
        const x = scanIndex * this.zoomX();
        this.centerOnX(x);

        this.highlightConfigs.set([{ pos: baseIndex + 1, color: 'rgba(255, 255, 0, 0.5)' }]);
    }

    /**
     * Highlights standard genotype annotations along the reference position.
     * @param refPos Reference coordinate
     * @param genotype VCF/genotype string e.g. 'hom. ALT'
     */
    highlightRefPos(refPos: number, genotype?: string) {
        const item = this.consensusAlign()[refPos.toString()];
        if (!item) {
            this.highlightConfigs.set([]);
            return;
        }

        const indicesToHighlight: { pos: number, color: string, label?: string }[] = [];
        const sangerPos1 = item.sangerPos1?.[0];
        const sangerPos2 = item.sangerPos2?.[0];

        if (genotype === 'hom. ALT' || (sangerPos1 !== undefined && (sangerPos1 === sangerPos2))) {
            const purple = 'rgba(128, 0, 128, 0.8)';
            if (sangerPos1 !== undefined || sangerPos2 !== undefined) {
                indicesToHighlight.push({ pos: sangerPos1 || sangerPos2!, color: purple });
            }
        } else {
            // For het or other, use blue/red and numbers
            if (sangerPos1 !== undefined) {
                indicesToHighlight.push({ pos: sangerPos1, color: 'rgba(255, 0, 0, 0.8)', label: '1' });
            }

            if (sangerPos2 !== undefined) {
                indicesToHighlight.push({ pos: sangerPos2, color: 'rgba(0, 0, 255, 0.8)', label: '2' });
            }
        }

        if (indicesToHighlight.length > 0) {
            this.highlightIndices(indicesToHighlight);
        } else {
            this.highlightConfigs.set([]);
        }
    }
}

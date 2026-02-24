import { Component, ElementRef, ViewChild, HostListener, ChangeDetectionStrategy, signal, effect, input, output, viewChild, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeneFeature } from '../../../../core/models/analysis.model';
import { TimelineService } from '../../../../core/services/timeline.service';

/**
 * Component displaying a miniature overview of the entire sequence alignment.
 * Shows read coverage depth and annotated genomic features.
 */
@Component({
    selector: 'app-analysis-minimap',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="minimap-container" role="region" aria-label="Analysis minimap showing read coverage across the reference sequence">
      <canvas #minimapCanvas (mousedown)="onMouseDown($event)" aria-label="Interactive minimap canvas" role="button" tabindex="0"></canvas>
    </div>
  `,
    styles: [`
    :host {
      display: block;
      width: 100%;
      height: 60px;
      background: #ffffff;
      border: 1px solid #e0f2f1;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 77, 64, 0.08);
      position: relative;
    }
    .minimap-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      width: 100%;
      height: 100%;
      cursor: pointer;
      display: block;
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisMinimapComponent implements OnInit, OnDestroy {
    /** List of genomic features (exons, CDS, etc.) to render on the minimap */
    features = input<GeneFeature[]>([]);
    /** Map of base pair positions to read depth coverage */
    coverage = input<Map<number, number> | null>(null);
    /** Maximum coverage value for scaling the histogram */
    maxCoverage = input<number>(10);

    private timelineService = inject(TimelineService);

    private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('minimapCanvas');
    private el = inject(ElementRef);

    private ctx!: CanvasRenderingContext2D;
    private resizeObserver: ResizeObserver;

    constructor() {
        this.resizeObserver = new ResizeObserver(() => this.draw());

        // Effect to trigger redraw if inputs change
        effect(() => {
            // Access all relevant inputs to track them
            this.timelineService.maxPosition();
            this.timelineService.position();
            this.timelineService.zoom();
            this.features();
            this.coverage();
            this.maxCoverage();

            if (this.ctx) {
                this.draw();
            }
        });
    }

    ngOnInit() {
        const canvas = this.canvasRef().nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.resizeObserver.observe(this.el.nativeElement);
    }

    ngOnDestroy() {
        this.resizeObserver.disconnect();
    }

    private draw() {
        const lengthValue = this.timelineService.maxPosition();
        if (!this.ctx || lengthValue <= 0 || lengthValue === Infinity) return;

        const canvas = this.canvasRef().nativeElement;
        const width = this.el.nativeElement.clientWidth;
        const height = this.el.nativeElement.clientHeight;

        if (width === 0 || height === 0) return;
        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);

        this.ctx.clearRect(0, 0, width, height);

        // 1. Draw Coverage (Background histogram)
        this.drawCoverage(width, height);

        // 2. Draw Features (Genes/Exons)
        this.drawFeatures(width, height);

        // 3. Draw Viewport (Current View)
        this.drawViewport(width, height);
    }

    private drawCoverage(width: number, height: number) {
        const coverageValue = this.coverage();
        const lengthValue = this.timelineService.maxPosition();
        const maxCoverageValue = this.maxCoverage();

        if (!coverageValue || coverageValue.size === 0 || maxCoverageValue === 0) return;

        const trackHeight = height * 0.6;

        this.ctx.fillStyle = '#b2dfdb'; // Light teal for coverage
        this.ctx.beginPath();

        // Simple sampling for performance if length is huge
        const step = Math.max(1, Math.floor(lengthValue / width));

        for (let x = 0; x < width; x++) {
            const dbPosStart = Math.floor((x / width) * lengthValue);
            // Get max coverage in this bin
            let maxDepth = 0;
            for (let i = 0; i < step; i++) {
                const d = coverageValue.get(dbPosStart + i) || 0;
                if (d > maxDepth) maxDepth = d;
            }

            if (maxDepth > 0) {
                const barHeight = (maxDepth / maxCoverageValue) * trackHeight;
                // Draw with a bit of transparency/gradient feel by using actual fillStyle
                this.ctx.fillRect(x, height - barHeight, 1, barHeight);
            }
        }
    }

    private drawFeatures(width: number, height: number) {
        const featuresValue = this.features();
        const lengthValue = this.timelineService.maxPosition();

        if (!featuresValue || featuresValue.length === 0) return;

        const trackHeight = height * 0.3;
        const trackY = 4; // Top part

        // Draw baseline
        this.ctx.strokeStyle = '#80cbc4'; // Medium teal
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, trackY + trackHeight / 2);
        this.ctx.lineTo(width, trackY + trackHeight / 2);
        this.ctx.stroke();

        featuresValue.forEach(feature => {
            // Map global positions to canvas pixels
            const x1 = (feature.start / lengthValue) * width;
            const x2 = (feature.end / lengthValue) * width;
            const w = Math.max(2, x2 - x1);

            if (feature.type === 'exon' || feature.type === 'CDS') {
                this.ctx.fillStyle = feature.type === 'CDS' ? '#00796b' : '#26a69a';

                // Use roundRect for modern look
                this.ctx.beginPath();
                if (this.ctx.roundRect) {
                    this.ctx.roundRect(x1, trackY, w, trackHeight, 2);
                } else {
                    this.ctx.rect(x1, trackY, w, trackHeight);
                }
                this.ctx.fill();
            }
        });
    }

    private drawViewport(width: number, height: number) {
        // Current window
        const lengthValue = this.timelineService.maxPosition();
        const positionValue = this.timelineService.position();
        const zoomValue = this.timelineService.zoom();

        const x1 = (positionValue / lengthValue) * width;
        const w = Math.max(4, (zoomValue / lengthValue) * width); // Visible width

        // Draw rectangle with border
        this.ctx.strokeStyle = '#004d40'; // Dark teal
        this.ctx.lineWidth = 2;

        // Semi-transparent fill
        this.ctx.fillStyle = 'rgba(0, 150, 136, 0.15)';

        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(x1, 2, w, height - 4, 4);
        } else {
            this.ctx.rect(x1, 2, w, height - 4);
        }
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Handles mouse down events on the canvas to start dragging the viewport.
     */
    onMouseDown(event: MouseEvent) {
        this.handleInteraction(event);

        const moveHandler = (e: MouseEvent) => this.handleInteraction(e);
        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    }

    private handleInteraction(event: MouseEvent) {
        const canvas = this.canvasRef().nativeElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = rect.width;
        const lengthValue = this.timelineService.maxPosition();
        const zoomValue = this.timelineService.zoom();

        // Calculate new position (centered on click if possible, or left edge)
        const clickRatio = Math.max(0, Math.min(1, x / width));
        let newPos = Math.floor(clickRatio * lengthValue);

        // Center the view on newPos
        newPos = newPos - (zoomValue / 2);

        // Clamp
        newPos = Math.max(0, Math.min(newPos, lengthValue - zoomValue));

        this.timelineService.setPosition(newPos);
    }
}

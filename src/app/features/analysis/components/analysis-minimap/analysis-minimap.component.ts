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
    <div class="minimap-container" role="region" aria-label="Analysis minimap showing read coverage across the reference sequence" (mouseleave)="onMouseLeave()">
      <canvas #minimapCanvas (mousedown)="onMouseDown($event)" (mousemove)="onMouseMove($event)" aria-label="Interactive minimap canvas" role="button" tabindex="0"></canvas>
      
      @if (hoveredFeature()) {
        <div class="minimap-tooltip" [style.left.px]="mousePos().x" [style.top.px]="mousePos().y">
          <span class="tooltip-type">{{ hoveredFeature()?.type | uppercase }}</span>
          <span class="tooltip-label">{{ getFeatureLabel(hoveredFeature()!) }}</span>
          <span class="tooltip-range">
            {{ hoveredFeature()?.start }} - {{ hoveredFeature()?.end }} 
            <span class="tooltip-length">({{ (hoveredFeature()?.end || 0) - (hoveredFeature()?.start || 0) + 1 }} bp)</span>
          </span>
        </div>
      }
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
      overflow: visible; /* Changed from hidden to allow tooltip overflow if needed, though container is relative */
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
    .minimap-tooltip {
      position: absolute;
      background: rgba(33, 33, 33, 0.95);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      pointer-events: none;
      z-index: 1000;
      white-space: nowrap;
      transform: translate(-50%, 20px); /* Changed from -110% to 20px to show BELOW cursor */
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      gap: 2px;
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(4px);
    }
    .tooltip-type {
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      opacity: 0.7;
      letter-spacing: 0.5px;
    }
    .tooltip-label {
      font-weight: 600;
      color: #4db6ac;
    }
    .tooltip-range {
      font-family: monospace;
      font-size: 10px;
      opacity: 0.8;
    }
    .tooltip-length {
      color: #80cbc4;
      margin-left: 4px;
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

    /** Currently hovered genomic feature */
    hoveredFeature = signal<GeneFeature | null>(null);
    /** Current mouse position within the canvas for tooltip placement */
    mousePos = signal<{ x: number, y: number }>({ x: 0, y: 0 });

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

    /**
     * Updates the hovered feature and mouse position on movement.
     */
    onMouseMove(event: MouseEvent) {
        const canvas = this.canvasRef().nativeElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mousePos.set({ x, y });

        const lengthValue = this.timelineService.maxPosition();
        const featuresValue = this.features();
        const width = rect.width;
        const height = rect.height;

        // Features are drawn in the top part
        const trackHeight = height * 0.3;
        const trackY = 4;

        if (y >= trackY && y <= trackY + trackHeight) {
            const genomicPos = (x / width) * lengthValue;
            
            // Find all features at this position
            const features = featuresValue.filter(f => genomicPos >= f.start && genomicPos <= f.end);
            
            // Prioritize 'exon' over 'cds' to show specific exon numbers if available
            const relevantFeature = 
                features.find(f => f.type.toLowerCase() === 'exon') || 
                features.find(f => f.type.toLowerCase() === 'cds');
            
            this.hoveredFeature.set(relevantFeature || null);
        } else {
            this.hoveredFeature.set(null);
        }
    }

    /**
     * Clears the hovered feature when the mouse leaves the minimap area.
     */
    onMouseLeave() {
        this.hoveredFeature.set(null);
    }

    /**
     * Extracts a human-readable label from a genomic feature's qualifiers.
     * Combines Gene name and Exon number if both are available.
     */
    getFeatureLabel(feature: GeneFeature): string {
        const q = feature.qualifiers;
        if (!q) return feature.type;

        // 1. Try to get Gene Name
        const gene = q['gene'] || q['gene_name'] || q['Name'];
        const geneStr = gene ? (Array.isArray(gene) ? gene[0] : gene) : '';
        
        // 2. Try to get Exon Number
        let exon = q['exon_number'] || q['number'] || q['exon'];
        
        // Fallback: try to extract "exon X" from note if it exists
        if (!exon && q['note']) {
            const note = Array.isArray(q['note']) ? q['note'][0] : q['note'];
            const match = note.match(/exon\s+(\d+)/i);
            if (match) exon = match[1];
        }

        const exonStr = exon ? (Array.isArray(exon) ? exon[0] : exon) : '';

        // Format result
        if (geneStr && exonStr) return `${geneStr} - Exon ${exonStr}`;
        if (exonStr) return `Exon ${exonStr}`;
        if (geneStr) return geneStr;
        
        // Fallback to other labels
        const label = q['label'] || q['product'] || q['note'];
        if (label) return Array.isArray(label) ? label[0] : label;

        return feature.type;
    }
}

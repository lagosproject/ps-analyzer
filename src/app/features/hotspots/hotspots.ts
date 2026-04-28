import { Component, OnInit, inject, signal, effect, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalysisService, HotspotPoint } from '../../core/services/analysis.service';
import { ToastService } from '../../core/services/toast.service';

// Ideogram is a common JS library, we import it like this
// If types are missing, we might need a declaration
declare var Ideogram: any;

@Component({
  selector: 'app-hotspots',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotspots.html',
  styleUrls: ['./hotspots.css']
})
export class HotspotsComponent implements OnInit, OnDestroy {
  private readonly analysisService = inject(AnalysisService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  
  readonly isLoading = signal<boolean>(true);
  readonly hasData = signal<boolean>(false);
  readonly totalVariants = signal<number>(0);
  readonly assembly = signal<string>('GRCh38');
  
  private ideogram: any;
  
  async ngOnInit() {
    await this.loadDataAndRender();
  }

  ngOnDestroy() {
    if (this.ideogram) {
      // Clean up if ideogram has a destroy method
    }
  }

  async setAssembly(assembly: string) {
    if (this.assembly() === assembly) return;
    this.assembly.set(assembly);
    await this.loadDataAndRender();
  }

  async loadDataAndRender() {
    this.isLoading.set(true);
    try {
      const hotspots = await this.analysisService.getHotspots(1000000, this.assembly()); // 1MB bins
      this.hasData.set(hotspots.length > 0);
      
      // Calculate total variants
      const total = hotspots.reduce((sum, h) => sum + h.count, 0);
      this.totalVariants.set(total);

      this.isLoading.set(false);
      
      // Small delay to ensure the [hidden] attribute is removed from the DOM
      // so Ideogram can calculate container dimensions correctly.
      setTimeout(() => {
        this.renderKaryotype(hotspots);
      }, 0);
    } catch (error: any) {
      this.toastService.show(`Failed to load hotspot data: ${error.message}`, 'error');
      this.isLoading.set(false);
    }
  }

  renderKaryotype(hotspots: HotspotPoint[]) {
    // Format hotspots for Ideogram annotations
    // We'll try both with and without 'chr' prefix by providing both if possible, 
    // but usually '1', '2', etc. is safest for human organism.
    const annotations = hotspots.map(h => ({
      name: `Variants: ${h.count}`,
      chr: h.chr.replace('chr', ''), 
      start: Math.max(1, h.start), 
      stop: h.stop,
      color: this.getColorForCount(h.count)
    }));

    console.log('Rendering Ideogram with simplified annotations:', annotations);

    const config = {
      organism: 'human',
      assembly: this.assembly(),
      container: '#karyotype-container',
      annotations: annotations,
      annotationsLayout: 'histogram',
      barWidth: 6,
      annotationHeight: 24,
      showBandLabels: true,
      onLoad: () => {
        console.log('Ideogram loaded successfully');
      }
    };

    try {
      const container = document.querySelector('#karyotype-container');
      if (container) container.innerHTML = '';

      if (typeof Ideogram === 'undefined') {
          // @ts-ignore
          import('ideogram').then(IdeoModule => {
              const Ideo = IdeoModule.default || IdeoModule;
              this.ideogram = new Ideo(config);
          });
      } else {
          this.ideogram = new Ideogram(config);
      }
    } catch (e) {
      console.error('Failed to initialize Ideogram:', e);
    }
  }

  private getColorForCount(count: number): string {
    // Low: App Primary, High: Danger/Warning colors
    if (count > 50) return '#ef4444'; // Danger
    if (count > 20) return '#f97316'; // Warning
    if (count > 5) return '#eab308';  // Alert
    return '#38A89D';                 // Primary (Success/Base)
  }

  async refresh() {
    await this.loadDataAndRender();
  }

  goBack() {
    this.router.navigate(['/']);
  }
}

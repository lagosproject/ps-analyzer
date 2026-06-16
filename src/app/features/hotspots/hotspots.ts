import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { AnalysisService } from '../../core/services/analysis.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-hotspots',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './hotspots.html',
  styleUrls: ['./hotspots.css']
})
export class HotspotsComponent implements OnInit {
  private readonly analysisService = inject(AnalysisService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly isLoading = signal<boolean>(true);
  readonly hasData = signal<boolean>(false);
  readonly totalVariants = signal<number>(0);
  readonly assembly = signal<string>('GRCh38');

  readonly approvedVariants = signal<any[]>([]);
  readonly selectedChromosome = signal<string | null>(null);
  readonly selectedRegion = signal<{ start: number; stop: number } | null>(null);
  readonly searchTerm = signal<string>('');
  readonly jobsMap = signal<Map<string, string>>(new Map());

  // Definition of the 24 human chromosomes with their lengths and centromere ratios
  readonly chromosomes = [
    { name: '1', size: 248956422, centromereRatio: 0.49 },
    { name: '2', size: 242193529, centromereRatio: 0.38 },
    { name: '3', size: 198295559, centromereRatio: 0.46 },
    { name: '4', size: 190214555, centromereRatio: 0.26 },
    { name: '5', size: 181538259, centromereRatio: 0.26 },
    { name: '6', size: 170805979, centromereRatio: 0.34 },
    { name: '7', size: 159345973, centromereRatio: 0.37 },
    { name: '8', size: 145138636, centromereRatio: 0.31 },
    { name: '9', size: 138394717, centromereRatio: 0.35 },
    { name: '10', size: 133797422, centromereRatio: 0.30 },
    { name: '11', size: 135086622, centromereRatio: 0.39 },
    { name: '12', size: 133275309, centromereRatio: 0.26 },
    { name: '13', size: 114364328, centromereRatio: 0.15 },
    { name: '14', size: 107043718, centromereRatio: 0.16 },
    { name: '15', size: 101991189, centromereRatio: 0.18 },
    { name: '16', size: 90338345, centromereRatio: 0.40 },
    { name: '17', size: 83257102, centromereRatio: 0.28 },
    { name: '18', size: 80373285, centromereRatio: 0.20 },
    { name: '19', size: 58617616, centromereRatio: 0.44 },
    { name: '20', size: 64444167, centromereRatio: 0.42 },
    { name: '21', size: 46709983, centromereRatio: 0.25 },
    { name: '22', size: 50818468, centromereRatio: 0.26 },
    { name: 'X', size: 156040895, centromereRatio: 0.38 },
    { name: 'Y', size: 57227415, centromereRatio: 0.20 }
  ];

  readonly maxChrSize = 248956422; // Chromosome 1 size

  // Computed signal to group and position markers on each chromosome
  readonly chromosomeMarkers = computed(() => {
    const variants = this.approvedVariants();
    const markersMap: Record<string, { position: number; count: number; gene: string }[]> = {};

    // Initialize arrays for all chromosomes
    this.chromosomes.forEach(c => {
      markersMap[c.name] = [];
    });

    // Group variants that are close to each other (within 2MB)
    variants.forEach(v => {
      const chrName = String(v.chromosome).replace('chr', '').toUpperCase();
      if (markersMap[chrName]) {
        const closeMarker = markersMap[chrName].find(m => Math.abs(m.position - v.position) < 2000000);
        if (closeMarker) {
          closeMarker.count += 1;
          if (v.gene && !closeMarker.gene.includes(v.gene)) {
            closeMarker.gene += `, ${v.gene}`;
          }
        } else {
          markersMap[chrName].push({
            position: v.position,
            count: 1,
            gene: v.gene || 'Unknown'
          });
        }
      }
    });

    return markersMap;
  });

  readonly filteredVariants = computed(() => {
    let variants = this.approvedVariants();
    const chrom = this.selectedChromosome();
    const region = this.selectedRegion();
    const search = this.searchTerm().trim().toLowerCase();

    // Filter by chromosome
    if (chrom) {
      const cleanChrom = chrom.replace('chr', '').toUpperCase();
      variants = variants.filter(v => {
        const cleanVChr = String(v.chromosome).replace('chr', '').toUpperCase();
        return cleanVChr === cleanChrom;
      });
    }

    // Filter by region (hotspot bin)
    if (region) {
      variants = variants.filter(v => v.position >= region.start && v.position <= region.stop);
    }

    // Filter by search term
    if (search) {
      variants = variants.filter(v => 
        (v.gene && v.gene.toLowerCase().includes(search)) ||
        (v.patient_id && v.patient_id.toLowerCase().includes(search)) ||
        (v.job_id && v.job_id.toLowerCase().includes(search)) ||
        (`${v.ref_allele}>${v.alt_allele}`.toLowerCase().includes(search)) ||
        (String(v.position).includes(search))
      );
    }

    return variants;
  });

  async ngOnInit() {
    await this.loadDataAndRender();
  }

  async setAssembly(assembly: string) {
    if (this.assembly() === assembly) return;
    this.assembly.set(assembly);
    this.clearSelection();
    await this.loadDataAndRender();
  }

  async loadDataAndRender() {
    this.isLoading.set(true);
    try {
      // 1. Get detailed approved variants
      const approved = await this.analysisService.getApprovedVariants(this.assembly());
      this.approvedVariants.set(approved);
      this.hasData.set(approved.length > 0);
      this.totalVariants.set(approved.length);

      // 2. Get all jobs to build the jobs map
      try {
        const jobs = await this.analysisService.getJobs();
        const jMap = new Map<string, string>();
        jobs.forEach(j => jMap.set(j.id, j.name));
        this.jobsMap.set(jMap);
      } catch (jobError) {
        console.warn('Failed to load jobs list for naming:', jobError);
      }

      this.isLoading.set(false);
    } catch (error: any) {
      this.toastService.show(this.translate.instant('hotspots.failedLoad', { error: error.message }), 'error');
      this.isLoading.set(false);
    }
  }

  toggleChromosome(chrName: string) {
    if (this.selectedChromosome() === chrName && !this.selectedRegion()) {
      this.clearSelection();
    } else {
      this.selectedChromosome.set(chrName);
      this.selectedRegion.set(null);
    }
  }

  onMarkerClick(event: MouseEvent, chrName: string, marker: any) {
    event.stopPropagation();
    this.selectedChromosome.set(chrName);
    this.selectedRegion.set({
      start: Math.max(0, marker.position - 1000000),
      stop: marker.position + 1000000
    });
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  clearSelection() {
    this.selectedChromosome.set(null);
    this.selectedRegion.set(null);
  }

  highlightChromosome(chr: string) {
    const cleanChr = String(chr).replace('chr', '');
    this.selectedChromosome.set(cleanChr);
    this.selectedRegion.set(null);
  }

  getJobName(jobId: string | null): string {
    if (!jobId) return 'N/A';
    return this.jobsMap().get(jobId) || jobId;
  }

  getGeneBadgeClass(gene: string | null): string {
    if (!gene) return 'gene-unknown';
    const firstLetter = gene.charCodeAt(0);
    const index = firstLetter % 6;
    return `gene-color-${index}`;
  }

  viewJob(jobId: string | null) {
    if (!jobId) return;
    this.router.navigate(['/analysis/loading', jobId]);
  }

  formatBp(val: number): string {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + ' Mb';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(0) + ' kb';
    }
    return val + ' bp';
  }

  async refresh() {
    await this.loadDataAndRender();
  }

  goBack() {
    this.router.navigate(['/']);
  }
}

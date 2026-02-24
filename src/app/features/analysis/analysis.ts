import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, viewChildren, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from '../../core/services/analysis.service';
import { TimelineService } from '../../core/services/timeline.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { AnalysisEntry, TracyConfig, HGVSConfig, Variant, JobComment, AnalysisJob, JobPatient, GeneFeature, ConsensusAlignItem } from '../../core/models/analysis.model';
import { GroupNucleotideRows } from "./components/group-nucleotide-rows/group-nucleotide-rows";
import { SangerChartComponent } from "./components/sanger-chart/sanger-chart";
import { VariantListComponent } from "./components/variant-list/variant-list.component";
import { SettingsModalComponent } from "../../shared/components/settings-modal/settings-modal";

import { AnalysisMinimapComponent } from "./components/analysis-minimap/analysis-minimap.component";
import { NucleotideRowControlsComponent } from "./components/nucleotide-row-controls/nucleotide-row-controls";
import { ReportService, ReportConfig } from '../../core/services/report.service';
import { ReportModalComponent } from "./components/report-modal/report-modal.component";

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, GroupNucleotideRows, SangerChartComponent, VariantListComponent, FormsModule, SettingsModalComponent, AnalysisMinimapComponent, NucleotideRowControlsComponent, ReportModalComponent],
  templateUrl: './analysis.html',
  styleUrl: './analysis.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisComponent implements OnInit {
  private readonly analysisService = inject(AnalysisService);
  private readonly appState = inject(AppStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly timelineService = inject(TimelineService);
  private readonly reportService = inject(ReportService);
  private readonly toastService = inject(ToastService);

  /** ID of the current analysis job */
  readonly currentJobId = signal<string | null>(null);
  /** Name of the current analysis job */
  readonly currentJobName = signal<string | null>(null);

  /** UI state for inline editing of the job name */
  readonly isEditingName = signal<boolean>(false);
  /** Temporary name used during editing */
  readonly editingName = signal<string>('');

  /** List of patients in the current job */
  readonly patients = signal<JobPatient[]>([]);
  /** Flag indicating if a local reference file is being used */
  readonly useLocalRefState = signal<boolean>(false);
  /** NCBI Accession ID for reference */
  readonly ncbiIdState = signal<string>('');
  /** Local path to the FASTA reference file */
  readonly refFastaPath = signal<string | null>(null);

  /** Computed active reference source */
  readonly reference = computed(() => {
    return (this.useLocalRefState() ? this.refFastaPath() : this.ncbiIdState()) || '';
  });
  /** Computed NCBI ID, null if local reference is used */
  readonly ncbiId = computed(() => !this.useLocalRefState() ? this.ncbiIdState() : null);

  /** Genomic features loaded from annotations (e.g. bed, gff) */
  readonly features = signal<GeneFeature[]>([]);

  /** Currently selected variant in the list */
  readonly selectedVariant = signal<Variant | null>(null);

  /** UI state for the settings modal */
  readonly showSettings = signal<boolean>(false);
  /** Current Tracy alignment engine configuration */
  readonly tracyConfig = signal<TracyConfig | undefined>(undefined);
  /** Current HGVS and VEP configuration */
  readonly hgvsConfig = signal<HGVSConfig>({ assembly: 'GRCh38', auto_vep: false });

  /** UI state for the report generation modal */
  readonly showReportModal = signal<boolean>(false);

  readonly hasMarkedVariants = computed(() => {
    const jobId = this.currentJobId();
    if (!jobId) return false;
    return this.reportService.getMarkedVariants(jobId).length > 0;
  });

  /** Total number of reads across all patients */
  readonly totalReads = computed(() => {
    if (!this.patients()) return 0;
    return this.patients().reduce((acc, p) => acc + (p.reads?.length || 0), 0);
  });

  /**
   * Handles selection of a nucleotide in the timeline or alignment view.
   * Highlights the position, centers charts, and selects associated variants.
   * @param event - Contains readId, reference position, and insertion flag
   */
  onNucleotideSelected(event: { readId: string, refPos: number, isInsertion?: boolean }) {
    let trace: AnalysisEntry | undefined;
    if (event.readId === 'Reference') {
      trace = this.referenceTrace();
    } else {
      trace = this.traces().find(t => t.readId === event.readId);
    }

    if (!trace || !trace.result.consensusAlign) return;

    const item = trace.result.consensusAlign[event.refPos];
    if (!item) return;

    const globalIndex = event.refPos - 1;
    this.timelineService.setHighlight(globalIndex, globalIndex);

    // Centering Logic:
    // 1. If Reference is clicked: center ALL charts.
    // 2. If Read Row is clicked:
    //    - If NOT an insertion: center ALL charts.
    //    - If IS an insertion: center ONLY that chart.
    if (event.readId === 'Reference' || !event.isInsertion) {
      this.traces().forEach(t => {
        const traceItem = t.result.consensusAlign?.[event.refPos];
        if (traceItem) {
          const chart = this.sangerCharts().find(c => c.readId() === t.readId);
          if (chart) {
            const sp = traceItem.sangerPos1?.[0] ?? traceItem.sangerPos2?.[0] ?? 0;
            chart.centerOnIndex(sp - 1);
          }
        }
      });
    } else {
      // Single chart centering for insertions in read rows
      const targetSangerChart = this.sangerCharts().find(c => c.readId() === event.readId);
      if (targetSangerChart) {
        const sp = item.sangerPos1?.[0] ?? item.sangerPos2?.[0] ?? 0;
        targetSangerChart.centerOnIndex(sp - 1);
      }
    }

    // Find and select variant if associated
    const variantAtPos = this.allVariants().find(v => v.position === event.refPos);
    if (variantAtPos) {
      this.selectedVariant.set(variantAtPos);

      // Ensure it's visible in the list
      const variantList = this.variantListComponent();
      if (variantList) {
        variantList.ensureVariantVisible(variantAtPos);
      }
    } else {
      // De-select if no variant at this position
      this.selectedVariant.set(null);
    }
  }

  /**
   * Starts inline editing mode for the job name.
   */
  startEditingName() {
    const currentName = this.currentJobName();
    if (currentName) {
      this.editingName.set(currentName);
      this.isEditingName.set(true);
    }
  }

  /**
   * Saves the edited job name to the backend.
   */
  async saveName() {
    const newName = this.editingName().trim();
    const oldName = this.currentJobName();
    const jobId = this.currentJobId();

    if (newName.length >= 3 && newName !== oldName && jobId) {
      try {
        await this.analysisService.renameJob(jobId, newName);
        this.currentJobName.set(newName);
        this.isEditingName.set(false);
      } catch (e) {
        console.error("Failed to rename job", e);
        alert("Failed to rename job");
      }
    } else {
      // Revert or same name
      this.isEditingName.set(false);
    }
  }

  /**
   * Cancels inline editing mode.
   */
  cancelEditingName() {
    this.isEditingName.set(false);
  }

  /** Child components for Sanger chromatograms */
  readonly sangerCharts = viewChildren(SangerChartComponent);
  /** Child component for the variants list */
  readonly variantListComponent = viewChild(VariantListComponent);

  /** The artificial trace generated to display the reference sequence */
  readonly referenceTrace = signal<AnalysisEntry | undefined>(undefined);

  /** All aggregated variants found across all reads */
  readonly allVariants = signal<Variant[]>([]);
  /** User discussion comments mapped by variant position */
  readonly comments = signal<Record<string, JobComment[]>>({});
  /** Alternative HGVS nomenclatures loaded from VEP */
  readonly hgvsAlternatives = signal<Record<string, string[]>>({});

  /** Signal containing all parsed analysis traces */
  readonly traces = signal<AnalysisEntry[]>([]);

  /** Maps reference position to total read depth coverage */
  readonly alignmentReadMap = signal<Map<number, number>>(new Map<number, number>());
  /** Maximum read depth observed at any position */
  readonly maxCoverage = signal<number>(0);

  /**
   * Computes read depth across the entire alignment to drive the minimap.
   */
  setAlignmentReadMap() {
    const depthMap = new Map<number, number>();
    const traces = this.traces();
    if (!traces) return;
    let max = 0;
    for (const trace of traces) {
      if (!trace.result.consensusAlign) continue;

      for (const item in trace.result.consensusAlign) {
        const refPos = parseInt(item, 10);
        const currentMax = depthMap.get(refPos) || 0;
        depthMap.set(refPos, currentMax + 1);
        if (currentMax + 1 > max) {
          max = currentMax + 1;
        }
      }
    }
    this.alignmentReadMap.set(depthMap);
    this.maxCoverage.set(max);
  }

  readonly alignmentDepthMap = computed(() => {
    const depthMap = new Map<number, number>();
    const traces = this.traces();
    const reference = this.referenceTrace();
    if (!reference || !traces) return depthMap;

    const processes = reference ? [reference, ...traces] : traces;

    for (const trace of processes) {
      if (!trace.result.consensusAlign) continue;

      for (const item in trace.result.consensusAlign) {
        const refPos = parseInt(item, 10);
        const currentMax = depthMap.get(refPos) || 0;
        try {
          depthMap.set(refPos, Math.max(currentMax, trace.result.consensusAlign[item].cons.length));
        } catch (error) {
          console.error(error);
        }

      }
    }
    return depthMap;
  });

  openSettings() {
    this.showSettings.set(true);
  }

  closeSettings() {
    this.showSettings.set(false);
  }

  updateScroll(event: Event) {
    const target = event.target as HTMLInputElement;
    const basePos = Number(target.value);
    this.timelineService.setPosition(basePos);
  }

  zoomToVariant(v: Variant) {
    const window = 10;
    const start = Math.max(0, v.position - window);
    const end = v.position + window;
    this.timelineService.setRange(start, end);

    this.selectedVariant.set(v);
    this.timelineService.setHighlight(v.position - 1, v.position - 1);

    // Zoom to this variant in all charts
    this.sangerCharts().forEach(chart => {
      chart.highlightRefPos(v.position, v['genotype']);
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const jobId = params.get('id');

      if (jobId) {
        // Check if job was passed via router state
        const navigation = this.router.currentNavigation();
        const stateJob = navigation?.extras.state?.['job'] || history.state?.['job'];

        void this.loadJob(jobId, stateJob);
      } else {
        // Fallback or go back
        const stateJobId = this.appState.currentJobId();
        if (stateJobId) {
          this.router.navigate(['/analysis', stateJobId]);
        } else {
          this.goBack();
        }
      }
    });
  }

  async setReferenceTrace(sequence: string) {
    const entry: AnalysisEntry = {
      patient: { id: 'Reference', name: 'Reference', reads: [] },
      readId: 'Reference',
      readName: 'Reference',
      result: {
        variants: { columns: [], rows: [] },
        consensusAlign: Array.from(sequence).reduce((acc, char, i) => {
          const refPos = i + 1;
          acc[refPos] = {
            refPos,
            cons: [char.toUpperCase()],
            sangerPos1: [i], // Mock value, straightforward for reference
            alt1: [],
            alt2: []
          };
          return acc;
        }, {} as Record<number, ConsensusAlignItem>),
        alignment: { refStart: 0, refForward: 1 },
        trace: { traceA: [], traceC: [], traceG: [], traceT: [], peakLocations: [] }
      }
    }
    this.referenceTrace.set(entry);
  }

  /**
   * Loads job data into the component state.
   * @param jobId - The ID of the job
   * @param passedJob - Optional pre-loaded job object (from route state)
   */
  async loadJob(jobId: string, passedJob?: AnalysisJob) {
    try {
      let job = passedJob;

      if (!job) {
        job = await this.analysisService.getJob(jobId);
      }

      if (!job) {
        return;
      }

      this.currentJobId.set(job.id);
      this.currentJobName.set(job.name);

      if (job.reference) {
        if (job.reference.type === 'file') {
          this.useLocalRefState.set(true);
          this.refFastaPath.set(job.reference.value);
          this.ncbiIdState.set('');
        } else {
          this.useLocalRefState.set(false);
          this.refFastaPath.set(null);
          this.ncbiIdState.set(job.reference.value);
        }
      }

      if (job.patients) {
        this.patients.set(job.patients);
      }

      if (job.reference_sequence) {
        this.setReferenceTrace(job.reference_sequence);
        this.timelineService.setMaxPosition(job.reference_sequence.length);
      }


      if (job.config) {
        this.tracyConfig.set(job.config);
      }

      if (job.hgvs_config) {
        this.hgvsConfig.set(job.hgvs_config);
      }

      if (job.comments) {
        this.comments.set(job.comments);
      }

      if (job.features) {
        this.features.set(job.features);
      }

      if (job.hgvs_alternatives) {
        this.hgvsAlternatives.set(job.hgvs_alternatives);
      }

      const results = job.results;

      if (!results) {
        return;
      }

      for (const res of results) {
        if (res.error) {
          console.error(`Error in result for patient ${res.patientId}: `, res.error);
          this.toastService.show(`Error for patient ${res.patientId}: ${res.error}`, 'error');
          continue;
        }

        const patientId = res.patientId;
        const readPath = res.readPath;
        const alignment = res.alignment; // This is our AlignmentResponse

        const patient = this.patients().find(p => p.id === patientId);
        if (!patient) continue;

        // Loading trim values from job metadata if they are not already set in alignment
        const jobPatient = job.patients.find((p: any) => p.id === patientId);
        const jobRead = jobPatient?.reads.find((r: any) => r.id === res.readId || r.file === readPath);

        if (jobRead) {
          if (alignment.alignment.intro_trimmed === undefined || alignment.alignment.intro_trimmed === null) {
            alignment.alignment.intro_trimmed = jobRead.trimLeft;
          }
          if (alignment.alignment.outro_trimmed === undefined || alignment.alignment.outro_trimmed === null) {
            alignment.alignment.outro_trimmed = jobRead.trimRight;
          }
        }

        const variants = this.analysisService.mapVariantData(alignment.variants);
        const mapped = variants.map((v: Variant) => this.analysisService.enhanceVariant(v, patient.name, patient.id, job));
        const grouped = this.analysisService.groupVariants(mapped);

        this.allVariants.update(current => {
          const combined = [...current, ...grouped];
          return this.analysisService.groupVariants(combined);
        });

        const alignStart = alignment.alignment.refStart;

        if (alignment.trace) {
          const newTrace = this.analysisService.createAnalysisEntry(patient, readPath, alignment);

          this.traces.update(current => {
            const index = current.findIndex(t => t.readId === readPath);
            if (index !== -1) {
              const updated = [...current];
              updated[index] = newTrace;
              return updated;
            } else {
              return [...current, newTrace];
            }
          });
        }

        this.setAlignmentReadMap();

        this.timelineService.setPosition(alignStart);
      }

    } catch (err: any) {
      console.error("Clinical Engine Failure:", err);
      this.toastService.show(`Analysis loading failed: ${err.message || err}`, 'error');
    }
  }

  /**
   * Posts a new comment for a variant to the backend.
   * @param event Contains the variant position ID and the comment text
   */
  async onCommentAdded(event: { variantKey: string, comment: string }) {
    const jobId = this.currentJobId();
    if (!jobId) return;

    try {
      // For now using 'User' as author, ideally we'd have a real user name
      const updatedJob = await this.analysisService.addComment(jobId, event.variantKey, event.comment, 'User');
      if (updatedJob && updatedJob.comments) {
        this.comments.set(updatedJob.comments);
      }
    } catch (e) {
      console.error("Failed to add comment", e);
      alert("Failed to add comment");
    }
  }

  /**
   * Deletes a comment from a variant.
   * @param event Contains the variant position ID and the comment ID to delete
   */
  async onCommentDeleted(event: { variantKey: string, commentId: string }) {
    const jobId = this.currentJobId();
    if (!jobId) return;

    try {
      const updatedJob = await this.analysisService.deleteComment(jobId, event.variantKey, event.commentId);
      if (updatedJob && updatedJob.comments) {
        this.comments.set(updatedJob.comments);
      }
    } catch (e) {
      console.error("Failed to delete comment", e);
      alert("Failed to delete comment");
    }
  }

  /**
   * Scrolls the viewport to smoothly center the given chromatogram trace row.
   * @param readId - The ID of the read to focus on
   */
  handleRowClick(readId: string) {
    const elementId = `trace-${readId}`;
    const element = document.getElementById(elementId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlighted');

      setTimeout(() => {
        element.classList.remove('highlighted');
      }, 2000);
    }
  }



  /**
   * Opens the report generation configuration modal.
   */
  openReportModal() {
    this.showReportModal.set(true);
  }

  /**
   * Receives configuration from the report modal and navigates to the report view.
   * @param config - The generated report configuration
   */
  onReportGenerate(config: ReportConfig) {
    this.reportService.setReportConfig(config);
    this.showReportModal.set(false);

    // Navigate to report page
    console.log("Generating report with config:", config);
    this.router.navigate(['/report']);
  }
}
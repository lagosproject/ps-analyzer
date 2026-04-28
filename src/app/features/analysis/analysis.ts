import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, viewChildren, viewChild, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnalysisService } from '../../core/services/analysis.service';
import { TimelineService } from '../../core/services/timeline.service';
import { AppStateService } from '../../core/services/app-state.service';
import { ToastService } from '../../core/services/toast.service';
import { AnalysisEntry, TracyConfig, HGVSConfig, Variant, JobComment, AnalysisJob, JobPatient, GeneFeature, ConsensusAlignItem, VariantStatus } from '../../core/models/analysis.model';
import { GroupNucleotideRows } from "./components/group-nucleotide-rows/group-nucleotide-rows";
import { SangerChartComponent } from "./components/sanger-chart/sanger-chart";
import { VariantListComponent } from "./components/variant-list/variant-list.component";
import { SettingsModalComponent } from "../../shared/components/settings-modal/settings-modal";

import { AnalysisMinimapComponent } from "./components/analysis-minimap/analysis-minimap.component";
import { NucleotideRowControlsComponent } from "./components/nucleotide-row-controls/nucleotide-row-controls";
import { ReportService, ReportConfig } from '../../core/services/report.service';
import { ReportModalComponent } from "./components/report-modal/report-modal.component";
import { UserService } from '../../core/services/user.service';


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
  protected readonly userService = inject(UserService);


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

  /** UI state to toggle visibility of the sequence visualizer (minimap + alignment) */
  readonly isSequenceVisible = signal<boolean>(true);

  /** Tracks the last interacted read ID for keyboard navigation */
  private readonly lastSelectedReadId = signal<string | null>(null);
  /** Indicates if the sequence visualizer currently has keyboard focus */
  private readonly isSequenceNavActive = signal(false);

  /**
   * Listens for global keydown events to support sequence navigation.
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isSequenceNavActive()) return;

    // Don't intercept if user is typing in an input or textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if (event.key === 'ArrowRight') {
      this.navigateSequence(1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      this.navigateSequence(-1);
      event.preventDefault();
    }
  }

  /**
   * Detects clicks outside the sequence area to deactivate keyboard navigation.
   */
  @HostListener('window:mousedown', ['$event'])
  handleWindowClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInsideSequence = target.closest('.sequence-visualizer-container');
    if (!isInsideSequence) {
      this.isSequenceNavActive.set(false);
    }
  }

  /**
   * Moves the selection highlight by a relative amount in the sequence.
   * @param delta - Positive to move right, negative to move left
   */
  private navigateSequence(delta: number) {
    const range = this.timelineService.highlightedRange();
    if (!range) return;

    const currentReadId = this.lastSelectedReadId() || 'Reference';
    let currentGlobalIndex = range.start; // This is actually refPos - 1
    const max = this.timelineService.maxPosition();
    
    // We also need to know the current subIndex if we are in an insertion.
    // However, since timelineService only tracks globalIndex (refPos - 1), 
    // let's just use the current refPos and scan forward/backward.
    let refPos = currentGlobalIndex + 1;
    let nextRefPos = refPos;
    let found = false;
    
    const trace = currentReadId === 'Reference' 
      ? this.referenceTrace() 
      : this.traces().find(t => t.readId === currentReadId);

    // Scan for the next valid position
    while (true) {
      nextRefPos += delta;
      
      if (nextRefPos < 1 || nextRefPos > max) {
        break;
      }

      if (trace && trace.result.consensusAlign) {
        const item = trace.result.consensusAlign[nextRefPos];
        if (item) {
          // Check if there is a valid base at this refPos for this read.
          // For a read, it has a valid base if cons[0] is not a gap, or if it has any insertions.
          const hasBase = item.cons.some(c => c !== '-');
          if (hasBase) {
            found = true;
            break;
          }
        }
      } else {
        // If it's a trace without consensusAlign, just move normally
        found = true;
        break;
      }
    }

    if (found) {
      const newGlobalIndex = nextRefPos - 1;
      this.onNucleotideSelected({
        readId: currentReadId,
        refPos: nextRefPos,
        globalIndex: newGlobalIndex,
        isInsertion: false, // We'll just target the primary base for now
        insertionIndex: 0
      });
    }
  }

  // We can remove globalToRefMap as it causes desync due to different globalIndex semantics


  /** Height of the sequence visualizer section */
  readonly sequenceHeight = signal<number>(350);
  /** Flag indicating if the user is currently resizing the section */
  private isResizing = false;
  /** Flag indicating if the user has manually adjusted the height */
  private userHasResized = false;

  constructor() {
    // Auto-adjust height based on content until the user manually resizes
    effect(() => {
      const tracesCount = this.traces().length;
      if (!this.userHasResized && tracesCount > 0) {
        this.autoAdjustSequenceHeight();
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Calculates and sets the ideal height for the sequence visualizer based on the number of tracks.
   * Caps at 450px to ensure chromatograms remain visible.
   */
  private autoAdjustSequenceHeight() {
    const overhead = 140; // Minimap(80) + Controls(48) + borders/margins
    const rowHeight = 22;
    const rowCount = this.traces().length + 1; // +1 for reference
    const contentHeight = rowCount * rowHeight;
    const idealHeight = overhead + contentHeight;

    // Default max of 450px, min of 140px
    const finalHeight = Math.min(450, Math.max(140, idealHeight));
    this.sequenceHeight.set(finalHeight);
  }

  /**
   * Initializes the resizing process.
   * @param event The mouse event from the resizer handle
   */
  startResizing(event: MouseEvent) {
    this.isResizing = true;
    this.userHasResized = true;
    event.preventDefault();

    const startY = event.clientY;
    const startHeight = this.sequenceHeight();

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(135, Math.min(1000, startHeight + deltaY));
      this.sequenceHeight.set(newHeight);
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Toggles the sequence visualizer height between default and expanded.
   */
  toggleExpandSequence() {
    if (this.sequenceHeight() > 600) {
      // Restore to ideal height instead of a fixed 350
      this.autoAdjustSequenceHeight();
    } else {
      this.sequenceHeight.set(window.innerHeight - 300);
    }
  }

  /**
   * Toggles the visibility of the sequence visualizer to provide more space for chromatograms.
   */
  toggleSequenceVisibility() {
    this.isSequenceVisible.update(v => !v);
  }

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
  onNucleotideSelected(event: { readId: string, refPos: number, globalIndex?: number, isInsertion?: boolean, subIndex?: number, insertionIndex?: number }) {
    this.lastSelectedReadId.set(event.readId);
    this.isSequenceNavActive.set(true);

    let trace: AnalysisEntry | undefined;
    if (event.readId === 'Reference') {
      trace = this.referenceTrace();
    } else {
      trace = this.traces().find(t => t.readId === event.readId);
    }

    if (!trace || !trace.result.consensusAlign) return;

    const item = trace.result.consensusAlign[event.refPos];
    if (!item) return;

    const gIndex = event.globalIndex !== undefined ? event.globalIndex : event.refPos - 1;
    this.timelineService.setHighlight(gIndex, gIndex);
    this.timelineService.ensureVisible(gIndex);

    const globalIndex = gIndex;

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
            const insIdx = event.subIndex ?? event.insertionIndex ?? 0;
            const sp = traceItem.sangerPos1?.[insIdx] ?? traceItem.sangerPos2?.[insIdx];
            if (sp !== undefined) {
              chart.centerOnIndex(sp - 1);
            }
          }
        }
      });
    } else {
      // Single chart centering for insertions in read rows
      const targetSangerChart = this.sangerCharts().find(c => c.readId() === event.readId);
      if (targetSangerChart) {
        const insIdx = event.subIndex ?? event.insertionIndex ?? 0;
        const sp = item.sangerPos1?.[insIdx] ?? item.sangerPos2?.[insIdx];
        if (sp !== undefined) {
          targetSangerChart.centerOnIndex(sp - 1);
        }
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
  /** Custom status for variants (e.g. reviewed, approved, rejected) */
  readonly variantStatuses = signal<Record<string, VariantStatus>>({});

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

  selectVariant(v: Variant) {
    const currentZoom = this.timelineService.zoom();
    // Center the view on the variant position (v.position is 1-based)
    const targetGlobalIndex = v.position - 1;
    const newPos = Math.floor(targetGlobalIndex - currentZoom / 2);

    this.timelineService.setPosition(newPos);

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

      if (job.variant_statuses) {
        this.variantStatuses.set(job.variant_statuses);
      }

      const results = job.results;

      if (!results) {
        return;
      }

      // Create a map to maintain the original submission order of reads
      const readOrderMap = new Map<string, number>();
      let globalIdx = 0;
      for (const p of job.patients) {
        for (const r of p.reads) {
          readOrderMap.set(r.file, globalIdx);
          if (r.id) readOrderMap.set(r.id, globalIdx);
          globalIdx++;
        }
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
            let updated: AnalysisEntry[];
            if (index !== -1) {
              updated = [...current];
              updated[index] = newTrace;
            } else {
              updated = [...current, newTrace];
            }

            // Always sort traces based on the original project structure
            return updated.sort((a, b) => {
              const orderA = readOrderMap.get(a.readId) ?? 999;
              const orderB = readOrderMap.get(b.readId) ?? 999;
              return orderA - orderB;
            });
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
      const author = await this.userService.ensureUserName();
      if (!author) return;

      const updatedJob = await this.analysisService.addComment(jobId, event.variantKey, event.comment, author);
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
   * Updates the status of a specific variant.
   */
  async onStatusChanged(event: { variantKey: string, status: VariantStatus }) {
    const jobId = this.currentJobId();
    if (!jobId) return;

    try {
      const updatedJob = await this.analysisService.updateVariantStatus(jobId, event.variantKey, event.status);
      if (updatedJob && updatedJob.variant_statuses) {
        this.variantStatuses.set(updatedJob.variant_statuses);
      }
      this.toastService.show(`Status updated to ${event.status}`, 'success');
    } catch (e) {
      console.error("Failed to update status", e);
      this.toastService.show("Failed to update status", "error");
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
import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { AppStateService } from '../../core/services/app-state.service';
import { AnalysisService } from '../../core/services/analysis.service';
import { ToastService } from '../../core/services/toast.service';
import { Patient, SangerRead } from '../../core/models/patient.model';
import { TracyConfig, HGVSConfig, AnalysisJob } from '../../core/models/analysis.model';
import { ReadSettingsComponent } from '../../shared/components/read-settings/read-settings';
import { SettingsModalComponent } from '../../shared/components/settings-modal/settings-modal';

/**
 * DashboardComponent handles the main orchestration of analysis projects.
 * It allows users to manage projects, patients, reads, and configuration settings.
 */

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, ReadSettingsComponent, SettingsModalComponent],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
    /** AppStateService for shared state management */
    private readonly appState = inject(AppStateService);
    /** AnalysisService for backend communication */
    private readonly analysisService = inject(AnalysisService);
    /** ToastService for user notifications */
    private readonly toastService = inject(ToastService);
    /** Angular Router for navigation */
    private readonly router = inject(Router);

    // Signals and State exposed for templates

    /** Current NCBI accession ID for remote reference sequence */
    readonly ncbiId = this.appState.ncbiId;
    /** Local path to a FASTA reference file */
    readonly refFastaPath = this.appState.refFastaPath;
    /** Whether to use a local reference file instead of NCBI */
    readonly useLocalRef = this.appState.useLocalRef;
    /** List of patients in the current project */
    readonly patients = this.appState.patients;
    /** Combined flag for identifying current active reference string */
    readonly activeReference = this.appState.activeReference;

    /** Computed signal checking if analysis parameters are sufficient to run */
    readonly canRunAnalysis = computed(() => {
        const patientsList = this.patients();
        const hasReads = patientsList.some(p => p.reads.length > 0);
        const hasValidRef = this.useLocalRef() ? !!this.refFastaPath() : !!this.fetchSuccess();
        const hasValidNames = patientsList.length > 0 && patientsList.every(p => p.name && p.name.trim() !== '');
        return hasValidRef && hasReads && hasValidNames;
    });

    /** Error message from reference fetching */
    readonly fetchError = signal<string | null>(null);
    /** Success message from reference validation */
    readonly fetchSuccess = signal<string | null>(null);

    /** List of search results from NCBI */
    readonly searchResults = signal<any[]>([]);
    /** Whether search is currently running */
    readonly isSearching = signal<boolean>(false);

    /** List of all saved analysis jobs */
    readonly jobs = signal<AnalysisJob[]>([]);
    /** Search query for filtering jobs */
    readonly searchQuery = signal<string>('');

    /** ID of the job currently being edited */
    readonly currentJobId = this.appState.currentJobId;
    /** Name of the job currently being edited */
    readonly currentJobName = this.appState.currentJobName;

    /** UI state for job name editing */
    readonly isEditingName = signal<boolean>(false);
    /** Temporary name being edited in the UI */
    readonly editingName = signal<string>('');

    /** UI state for showing/hiding settings modal */
    readonly showSettings = signal<boolean>(false);

    tracyConfig = signal<TracyConfig>({
        pratio: 0.33,
        kmer: 15,
        support: 3,
        maxindel: 1000,
        gapopen: -10,
        gapext: -4,
        match: 3,
        mismatch: -5,
        trim: 0,
        trimLeft: 50,
        trimRight: 50,
        linelimit: 10000
    });

    hgvsConfig = signal<HGVSConfig>({
        transcript: '',
        gene: '',
        assembly: 'GRCh38',
        auto_vep: false
    });

    // Read Settings State
    editingRead = signal<{ patientId: string, read: SangerRead } | null>(null);

    /** Computed signal for filtered jobs based on search query */
    readonly filteredJobs = computed(() => {
        const query = this.searchQuery().toLowerCase();
        return this.jobs().filter(job => job.name.toLowerCase().includes(query));
    });

    /**
     * Initializes the component and waits for the analysis server to be ready.
     */
    async ngOnInit() {
        const isConnected = await this.analysisService.waitForServer();
        if (isConnected) {
            this.loadJobs();
        } else {
            this.toastService.show("Could not connect to analysis server.", "error");
        }
    }

    /**
     * Loads the list of saved jobs from the analysis service.
     */
    async loadJobs() {
        try {
            const jobs = await this.analysisService.getJobs();
            this.jobs.set(jobs);

            // Sync current job name if ID exists
            const jobId = this.currentJobId();
            if (jobId) {
                const job = jobs.find((j: AnalysisJob) => j.id === jobId);
                if (job) {
                    this.currentJobName.set(job.name);
                }
            }
        } catch (e) {
            console.error("Failed to load jobs", e);
            this.toastService.show("Failed to load project list.", "error");
        }
    }

    /**
     * Handles changes to the NCBI Accession ID.
     * @param newId - The updated ID string
     */
    onNcbiIdChange(newId: string) {
        this.ncbiId.set(newId);
        this.fetchError.set(null);
        this.fetchSuccess.set(null);
        this.searchResults.set([]);

        // Auto-update HGVS transcript if using NCBI ID
        this.hgvsConfig.update(cfg => ({ ...cfg, transcript: newId }));
    }

    /**
     * Attempts to fetch reference sequence metadata from NCBI.
     */
    async fetchRefSeq() {
        this.fetchError.set(null);
        this.fetchSuccess.set(null);
        this.searchResults.set([]);
        const query = this.ncbiId();
        if (!query) return;

        this.isSearching.set(true);
        try {
            const results = await this.analysisService.searchReference(query);
            this.isSearching.set(false);
            if (results && results.length > 0) {
                if (results.length === 1 || query.toUpperCase().startsWith('NM_') || query.toUpperCase().startsWith('NC_') || query.toUpperCase().startsWith('NG_') || query.toUpperCase().startsWith('NR_')) {
                    // Exact match or single result
                    const id = results[0].accession;
                    this.appState.clearLocalRef();
                    this.ncbiId.set(id);
                    // Update HGVS transcript
                    this.hgvsConfig.update(cfg => ({ ...cfg, transcript: id }));
                    this.fetchSuccess.set(`Validated reference: ${id} (${results[0].title})`);
                } else {
                    // Multiple results, show them to the user
                    this.searchResults.set(results);
                    this.fetchSuccess.set(`Found ${results.length} possible references. Please select one.`);
                }
            } else {
                this.fetchError.set(`No references found for "${query}".`);
            }
        } catch (error: any) {
            this.isSearching.set(false);
            this.fetchError.set("Error checking reference. Please try again.");
        }
    }

    /**
     * Selects a specific search result from NCBI.
     */
    selectSearchResult(result: any) {
        this.appState.clearLocalRef();
        this.ncbiId.set(result.accession);
        this.hgvsConfig.update(cfg => ({ ...cfg, transcript: result.accession }));
        this.searchResults.set([]);
        this.fetchSuccess.set(`Selected reference: ${result.accession} (${result.title})`);
    }

    /**
     * Opens a dialog to select a local FASTA file as reference.
     */
    async selectRefFasta() {
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Reference FASTA', extensions: ['fasta', 'fa'] }]
        });

        if (selected && typeof selected === 'string') {
            this.appState.setLocalRef(selected);
        }
    }

    /**
     * Clears the current local reference file selection.
     */
    clearLocalRef() {
        this.appState.clearLocalRef();
    }

    /**
     * Adds a new patient to the project and focuses their name input field.
     */
    addPatient() {
        this.appState.addPatient('');
        setTimeout(() => {
            const container = document.querySelector('.modal-content');
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
            const inputs = document.querySelectorAll('.patient-card input[type="text"]');
            if (inputs.length > 0) {
                const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
                lastInput.focus();
            }
        }, 50);
    }

    /**
     * Updates the name of a patient reactively.
     */
    updatePatientName(id: string, name: string) {
        this.appState.updatePatientName(id, name);
    }

    /**
     * Opens a dialog to select sequelcing reads for a patient.
     * @param patient - The patient to add reads to
     */
    async addRead(patient: Patient) {
        const selected = await open({
            multiple: true,
            filters: [{ name: 'Sanger Data', extensions: ['ab1', 'scf', 'fasta', 'fa', 'txt'] }]
        });

        if (selected && Array.isArray(selected)) {
            selected.forEach(filePath => {
                this.appState.addRead(patient.id, filePath);
            });
        }
    }

    /**
     * Confirms and removes a patient from the project.
     * @param id - patient ID
     */
    async removePatient(id: string) {
        const confirmed = await ask("Are you sure you want to remove this patient?", {
            title: 'Confirm Deletion',
            kind: 'warning',
        });

        if (confirmed) {
            this.appState.removePatient(id);
        }
    }

    /**
     * Removes a specific read file from a patient.
     */
    removeRead(patientId: string, filePath: string) {
        this.appState.removeRead(patientId, filePath);
    }

    /**
     * Opens the settings dialog for a specific read.
     */
    openReadSettings(patientId: string, read: SangerRead) {
        this.editingRead.set({ patientId, read });
    }

    /**
     * Closes the read settings dialog.
     */
    closeReadSettings() {
        this.editingRead.set(null);
    }

    /**
     * Saves updated read settings (e.g. trimming).
     */
    saveReadSettings(settings: { trimLeft: number, trimRight: number }) {
        const current = this.editingRead();
        if (current) {
            this.appState.updateReadConfig(current.patientId, current.read.id, settings);
            this.closeReadSettings();
        }
    }

    // Job Management Actions

    /**
     * Loads an existing job into the current project state.
     * @param job - The analysis job to load
     */
    async loadJob(job: AnalysisJob) {
        // Set as current job
        this.currentJobId.set(job.id);
        this.currentJobName.set(job.name);

        // 1. Set reference
        if (job.reference.type === 'file') {
            this.appState.setLocalRef(job.reference.value);
        } else {
            this.appState.clearLocalRef();
            this.ncbiId.set(job.reference.value);
            this.fetchSuccess.set(`Loaded reference: ${job.reference.value}`);
        }

        // 2. Set patients
        this.appState.patients.set([]); // Clear existing
        job.patients.forEach((p: any) => {
            this.appState.addPatient(p.name, p.id);
            const addedP = this.appState.patients().find(pat => pat.id === p.id || pat.name === p.name);
            if (addedP) {
                p.reads.forEach((r: any) => {
                    if (typeof r === 'string') {
                        this.appState.addRead(addedP.id, r);
                    } else {
                        this.appState.addRead(addedP.id, r.file, r.id, { trimLeft: r.trimLeft, trimRight: r.trimRight });
                    }
                });
            }
        });

        // 3. Set config
        if (job.config) {
            this.tracyConfig.set({ ...job.config });
        } else {
            this.resetTracyConfig();
        }

        // 4. Set HGVS config
        if (job.hgvs_config) {
            this.hgvsConfig.set({ ...job.hgvs_config });
        } else {
            this.hgvsConfig.set({ transcript: '', gene: '', assembly: 'GRCh38', auto_vep: false });
        }
    }

    /**
     * Confirms and deletes a saved job.
     */
    async onDeleteJob(event: Event, job: AnalysisJob) {
        event.stopPropagation();
        const confirmed = await ask(`Delete job "${job.name}"?`, {
            title: 'Confirm Deletion',
            kind: 'warning',
        });

        if (confirmed) {
            try {
                await this.analysisService.deleteJob(job.id);
                this.loadJobs();
                if (this.currentJobId() === job.id) {
                    this.currentJobId.set(null);
                }
                this.toastService.show("Project deleted.", "success");
            } catch (e) {
                console.error("Failed to delete job", e);
                this.toastService.show("Failed to delete project.", "error");
            }
        }
    }

    /**
     * Navigates to the results page for the current active job.
     */
    showCurrentResults() {
        const jobId = this.currentJobId();
        if (jobId) {
            this.router.navigate(['/analysis/loading', jobId]);
        }
    }

    /**
     * Prompts for a new name and renames a saved job.
     */
    async onRenameJob(event: Event, job: AnalysisJob) {
        event.stopPropagation();
        const newName = prompt("New job name:", job.name);
        if (newName && newName !== job.name) {
            try {
                await this.analysisService.renameJob(job.id, newName);
                this.loadJobs();
                this.toastService.show("Project renamed.", "success");
            } catch (e) {
                console.error("Failed to rename job", e);
                this.toastService.show("Failed to rename project.", "error");
            }
        }
    }

    /**
     * Opens a dialog to export/share a job to a local folder.
     */
    async onShareJob(event: Event, job: AnalysisJob) {
        event.stopPropagation();

        try {
            const targetFolder = await open({
                directory: true,
                multiple: false,
                title: 'Select Export Folder'
            });

            if (!targetFolder) return;

            const confirmed = await ask(`Export "${job.name}" to this folder?\n\nChoose Export Level:`, {
                title: 'Share Job',
                kind: 'info',
                okLabel: 'Full (Data + Results)',
                cancelLabel: 'Results Only'
            });

            const level = confirmed ? 'full' : 'results_only';

            await this.analysisService.shareJob(job.id, level, targetFolder as string);
            this.toastService.show(`Job exported successfully to ${targetFolder}`, 'success');
        } catch (e) {
            console.error("Failed to share job", e);
            this.toastService.show("Failed to export job", 'error');
        }
    }

    /**
     * Opens a dialog to import a previously exported project folder.
     */
    async onImportJob() {
        try {
            const sourceFolder = await open({
                directory: true,
                multiple: false,
                title: 'Select Shared Job Folder'
            });

            if (!sourceFolder) return;

            await this.analysisService.importJob(sourceFolder as string);
            this.toastService.show("Job imported successfully", 'success');
            this.loadJobs();
        } catch (e) {
            console.error("Failed to import job", e);
            this.toastService.show("Failed to import job. Ensure it is a valid shared job folder.", 'error');
        }
    }

    /**
     * Starts the inline editing mode for the current project name.
     */
    startEditingName() {
        const currentName = this.currentJobName();
        if (currentName) {
            this.editingName.set(currentName);
            this.isEditingName.set(true);
        }
    }

    /**
     * Saves the current editing name to the backend.
     */
    async saveName() {
        const newName = this.editingName().trim();
        const oldName = this.currentJobName();
        const jobId = this.currentJobId();

        if (newName.length >= 3 && newName !== oldName && jobId) {
            try {
                await this.analysisService.renameJob(jobId, newName);
                await this.loadJobs();
                this.isEditingName.set(false);
                this.toastService.show("Project renamed.", "success");
            } catch (e) {
                console.error("Failed to rename job", e);
                this.toastService.show("Failed to rename project.", "error");
            }
        } else {
            this.isEditingName.set(false);
        }
    }

    /**
     * Cancels the current inline editing without saving.
     */
    cancelEditingName() {
        this.isEditingName.set(false);
    }

    /**
     * Resets the current local state to start a fresh project.
     */
    resetProject() {
        this.currentJobId.set(null);
        this.currentJobName.set(null);
        this.appState.clearLocalRef();
        this.ncbiId.set('');
        this.appState.patients.set([]);
        this.fetchError.set(null);
        this.fetchSuccess.set(null);
        this.resetTracyConfig();
        this.hgvsConfig.set({ transcript: '', gene: '', assembly: 'GRCh38', auto_vep: false });
    }

    /**
     * Resets the alignment engine configuration to defaults.
     */
    resetTracyConfig() {
        this.tracyConfig.set({
            pratio: 0.33,
            kmer: 15,
            support: 3,
            maxindel: 1000,
            gapopen: -10,
            gapext: -4,
            match: 3,
            mismatch: -5,
            trim: 0,
            trimLeft: 50,
            trimRight: 50,
            linelimit: 10000
        });
    }

    /**
     * Opens the global settings modal.
     */
    openSettings() {
        this.showSettings.set(true);
    }

    /**
     * Closes the global settings modal.
     */
    closeSettings() {
        this.showSettings.set(false);
    }

    /**
     * Main execution flow: Validates state, creates/updates job, and runs analysis.
     */
    async runAnalysis() {
        if (this.patients().length > 0 && this.activeReference()) {

            const refType: 'file' | 'ncbi' = this.useLocalRef() ? 'file' : 'ncbi';
            const refValue = this.useLocalRef() ? this.refFastaPath()! : this.ncbiId()!;

            const reference = { type: refType, value: refValue };

            // Filter patients with at least one read
            const validPatients = this.patients()
                .filter(p => p.reads.length > 0)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    reads: p.reads.map(r => ({
                        id: r.id,
                        file: r.file,
                        trimLeft: r.trimLeft,
                        trimRight: r.trimRight
                    }))
                }));

            if (validPatients.length === 0) {
                this.toastService.show("No patients with reads found.", "warning");
                return;
            }

            let jobName = `Job ${new Date().toLocaleString()}`;

            try {
                let job: AnalysisJob;
                if (this.currentJobId()) {
                    // Update existing job
                    const existingJob = this.jobs().find(j => j.id === this.currentJobId());
                    if (existingJob) {
                        jobName = existingJob.name;
                    }
                    job = await this.analysisService.updateJob(this.currentJobId()!, jobName, reference, validPatients, this.tracyConfig(), this.hgvsConfig());
                } else {
                    // Create New Job
                    const appVersion = await getVersion();
                    job = await this.analysisService.createJob(jobName, reference, validPatients, appVersion, this.tracyConfig(), this.hgvsConfig());
                    this.currentJobId.set(job.id);
                    this.currentJobName.set(job.name);
                }

                this.loadJobs();
                await this.analysisService.runJob(job.id);
                this.router.navigate(['/analysis/loading', job.id]);
            } catch (e) {
                console.error("Job execution failed", e);
                this.toastService.show("Failed to execute analysis job.", "error");
            }
        } else {
            this.toastService.show("Please add at least one patient and a reference sequence.", "warning");
        }
    }
}

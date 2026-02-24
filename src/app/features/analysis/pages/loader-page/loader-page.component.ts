import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AnalysisError, AnalysisService } from '../../../../core/services/analysis.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { SangerLoaderComponent } from '../../../../shared/components/loader/loader.component';

/**
 * Component displayed while an analysis job is running.
 * Polls the backend for job status and progress, then navigates to the results view.
 */
@Component({
    selector: 'app-analysis-loader-page',
    standalone: true,
    imports: [CommonModule, SangerLoaderComponent],
    templateUrl: './loader-page.component.html',
    styleUrl: './loader-page.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalysisLoaderPageComponent implements OnInit, OnDestroy {
    private readonly analysisService = inject(AnalysisService);
    private readonly appState = inject(AppStateService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    /** The current status message to display in the UI */
    readonly statusMessage = signal<string>('Initializing...');
    /** Job progress percentage (0-100) */
    readonly progress = signal<number>(0);
    /** Error details if the job fails */
    readonly analysisError = signal<AnalysisError | null>(null);

    private destroyed = false;

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const jobId = params.get('id');
            if (jobId) {
                this.startSequencing(jobId);
            } else {
                // Fallback to current job ID from state if not in URL, checks
                const stateJobId = this.appState.currentJobId();
                if (stateJobId) {
                    this.startSequencing(stateJobId);
                } else {
                    this.goBack();
                }
            }
        });
    }

    ngOnDestroy() {
        this.destroyed = true;
    }

    /**
     * Navigates the user back to the dashboard if an error occurs and they choose to exit.
     */
    goBack() {
        this.router.navigate(['/']);
    }

    /**
     * Starts polling the backend for job status until completed or failed.
     * @param jobId - The unique identifier of the job to monitor
     */
    async startSequencing(jobId: string) {
        this.analysisError.set(null);

        try {
            let job = await this.analysisService.getJob(jobId);

            // Polling while status is RUNNING or CREATED or PENDING
            while (!this.destroyed && (job.status === 'running' || job.status === 'created' || job.status === 'pending')) {
                this.progress.set(job.progress || 0);
                if (job.status_message) {
                    this.statusMessage.set(job.status_message);
                } else {
                    this.statusMessage.set(`Job is ${job.status}...`);
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
                job = await this.analysisService.getJob(jobId);
            }

            if (this.destroyed) return;

            if (job.status === 'failed') {
                console.error("Job failed:", job.error);
                this.statusMessage.set("Job failed.");
                this.analysisError.set({ type: 'JobFailed', message: job.error || 'Unknown error', traceback: '' });
                return;
            }

            this.statusMessage.set("Processing results...");
            // Navigate to analysis view passing the job object in state to avoid re-fetching
            this.router.navigate(['/analysis', jobId], { state: { job } });


        } catch (err: any) {
            this.analysisError.set(err);
            console.error("Clinical Engine Failure:", err);
        }
    }
}

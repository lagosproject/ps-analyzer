import { Injectable, signal, effect } from '@angular/core';

/**
 * Configuration for a single variant block in a report.
 */
export interface ReportConfigItem {
    /** Genomic position of the variant */
    variantPosition: number;
    /** List of Sanger read IDs to display for this variant */
    selectedReadIds: string[];
    /** Whether to display the reference sequence row */
    includeReference: boolean;
    /** User comments specific to this report entry */
    comments?: string;
}

/**
 * Complete configuration for a generated report.
 */
export interface ReportConfig {
    /** Job ID associated with the report */
    jobId: string;
    /** Display name of the job */
    jobName: string;
    /** List of variant blocks to include in the report */
    items: ReportConfigItem[];
}

@Injectable({
    providedIn: 'root'
})
export class ReportService {
    private readonly STORAGE_KEY = 'ps-analyzer-marked-variants';

    /** 
     * Stores a set of strings in format "jobId:variantPosition"
     * These are the variants marked by the user for inclusion in the report.
     */
    private markedVariants = signal<Set<string>>(new Set());

    /** 
     * The configuration currently being used to generate or preview a report.
     */
    readonly currentReportConfig = signal<ReportConfig | null>(null);

    constructor() {
        this.loadFromStorage();

        // Auto-save whenever the signal changes
        effect(() => {
            this.saveToStorage(this.markedVariants());
        });
    }

    /**
     * Loads previously marked variants from browser localStorage.
     */
    private loadFromStorage() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                const arr = JSON.parse(stored);
                if (Array.isArray(arr)) {
                    this.markedVariants.set(new Set(arr));
                }
            } catch (e) {
                console.error('Failed to load marked variants from storage', e);
            }
        }
    }

    /**
     * Saves the current set of marked variants to browser localStorage.
     */
    private saveToStorage(set: Set<string>) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(set)));
    }

    /**
     * Generates a unique key for a variant in a job for storage.
     */
    private getEntryKey(jobId: string, variantPosition: number): string {
        return `${jobId}:${variantPosition}`;
    }

    /**
     * Toggles the mark status of a variant for the report.
     * @param jobId - ID of the job
     * @param variantPosition - Genomic position of the variant
     */
    toggleMark(jobId: string, variantPosition: number) {
        const key = this.getEntryKey(jobId, variantPosition);
        this.markedVariants.update(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    /**
     * Checks if a variant is currently marked for the report.
     */
    isMarked(jobId: string, variantPosition: number): boolean {
        const key = this.getEntryKey(jobId, variantPosition);
        return this.markedVariants().has(key);
    }

    /**
     * Gets all variant positions marked for a specific job.
     * @returns Array of genomic positions (numbers)
     */
    getMarkedVariants(jobId: string): number[] {
        const prefix = `${jobId}:`;
        return Array.from(this.markedVariants())
            .filter(k => k.startsWith(prefix))
            .map(k => parseInt(k.substring(prefix.length), 10));
    }

    /**
     * Sets the active report configuration for the report viewer.
     */
    setReportConfig(config: ReportConfig) {
        this.currentReportConfig.set(config);
    }
}

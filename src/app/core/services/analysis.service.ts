import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import {
  TracyConfig,
  AnalysisEntry,
  Variant,
  VariantData,
  AnalysisResult,
  AnalysisError,
  HGVSRequest,
  JobComment,
  AnalysisJob,
  JobReference,
  JobPatient,
  JobRead
} from '../models/analysis.model';

// Re-export types for backward compatibility with isolatedModules support
export type {
  TracyConfig,
  AnalysisEntry,
  Variant,
  VariantData,
  AnalysisResult,
  AnalysisError,
  HGVSRequest,
  JobComment,
  AnalysisJob,
  JobReference,
  JobPatient,
  JobRead
};

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {
  private readonly http = inject(HttpClient);

  /** Base URL for the analysis engine API */
  private readonly apiUrl = API_CONFIG.baseUrl;

  private serverReadySignal = signal<boolean>(false);
  /** Signal indicating if the backend server is reachable */
  readonly serverReady = this.serverReadySignal.asReadonly();

  constructor() { }

  /**
   * Unified error handler that converts API errors to AnalysisError format.
   * @param error - The error object from the HTTP request
   * @returns AnalysisError with structured error information
   */
  private handleApiError(error: any): AnalysisError {
    return {
      type: error.error?.type || 'ApiError',
      message: error.error?.message || error.error?.detail || 'Could not connect to the analysis engine.',
      traceback: error.error?.traceback || ''
    };
  }

  /**
   * Checks if the analysis server is up and running.
   * @returns Promise resolving to true if alive, false otherwise.
   */
  async checkHealth(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get(`${this.apiUrl}/`));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Waits for the server to be ready by polling the health endpoint.
   * @param retries - Maximum number of attempts
   * @param delay - Milliseconds between attempts
   * @returns Promise resolving to true if server becomes ready
   */
  async waitForServer(retries = 20, delay = 1000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const alive = await this.checkHealth();
      if (alive) {
        this.serverReadySignal.set(true);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.serverReadySignal.set(false);
    return false;
  }

  /**
   * Verifies if a reference ID exists in the backend storage.
   * @param id - The reference sequence identifier
   * @returns Promise resolving to true if it exists
   */
  async checkReferenceExists(id: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ exists: boolean }>(`${this.apiUrl}/check-reference`, {
          params: { id }
        })
      );
      return res.exists;
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Helper to map tabular variant data to an array of Variant objects.
   * @param data - The raw tabular data from the API
   * @returns Array of structured Variant objects
   */
  mapVariantData(data: VariantData): Variant[] {
    const { columns, rows } = data;
    return rows.map(row => {
      const variant: any = {};
      columns.forEach((col, index) => {
        // Handle renaming from backend 'pos' or 'Paciente' if needed
        let fieldName = col;
        if (col === 'pos') fieldName = 'position';
        if (col === 'Paciente') fieldName = 'patient';

        variant[fieldName] = row[index];
      });
      return variant as Variant;
    });
  }

  /**
   * Creates a new analysis job.
   * @param name - Name of the job
   * @param reference - Reference sequence configuration
   * @param patients - List of patients and their reads
   * @param appVersion - Current application version
   * @param config - Alignment engine settings
   * @param hgvsConfig - HGVS/VEP settings
   * @returns Promise with the created job details
   */
  async createJob(
    name: string,
    reference: JobReference,
    patients: any[], // Payload patients are slightly different from JobPatient (reads are paths)
    appVersion?: string,
    config?: TracyConfig,
    hgvsConfig?: any
  ): Promise<AnalysisJob> {
    try {
      const payload = { name, reference, patients, app_version: appVersion, config, hgvs_config: hgvsConfig };
      return await firstValueFrom(
        this.http.post<AnalysisJob>(`${this.apiUrl}/create-job`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves details for a specific job.
   * @param jobId - Unique job identifier
   */
  async getJob(jobId: string): Promise<AnalysisJob> {
    try {
      return await firstValueFrom(
        this.http.get<AnalysisJob>(`${this.apiUrl}/jobs/${jobId}`)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Lists all available jobs.
   */
  async getJobs(): Promise<AnalysisJob[]> {
    try {
      return await firstValueFrom(
        this.http.get<AnalysisJob[]>(`${this.apiUrl}/jobs`)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Deletes a job.
   * @param jobId - Job to delete
   */
  async deleteJob(jobId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.apiUrl}/jobs/${jobId}`)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Renames an existing job.
   * @param jobId - Job identifier
   * @param newName - New name for the job
   */
  async renameJob(jobId: string, newName: string): Promise<AnalysisJob> {
    try {
      return await firstValueFrom(
        this.http.put<AnalysisJob>(`${this.apiUrl}/jobs/${jobId}/rename`, { name: newName })
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Updates job configuration and patients.
   */
  async updateJob(
    jobId: string,
    name: string,
    reference: JobReference,
    patients: any[],
    config?: TracyConfig,
    hgvsConfig?: any
  ): Promise<AnalysisJob> {
    try {
      const payload = { name, reference, patients, config, hgvs_config: hgvsConfig };
      return await firstValueFrom(
        this.http.put<AnalysisJob>(`${this.apiUrl}/jobs/${jobId}`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Starts the analysis execution for a job.
   * @param jobId - Job to run
   */
  async runJob(jobId: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/run-job/${jobId}`, {})
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Gets a preview of a sequence file (e.g. Sanger trace).
   * @param filePath - Path to the file
   */
  async getReadPreview(filePath: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/preview-read`, {
          params: { path: filePath }
        })
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Adds a user comment to a specific variant in a job.
   * @param jobId - Job ID
   * @param variantKey - Unique key for the variant (position-based)
   * @param text - Comment content
   * @param author - Comment author
   */
  async addComment(jobId: string, variantKey: string, text: string, author: string): Promise<any> {
    try {
      const payload = { variant_key: variantKey, text, author };
      return await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/jobs/${jobId}/comments`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Deletes a variant comment.
   */
  async deleteComment(jobId: string, variantKey: string, commentId: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.http.delete<any>(`${this.apiUrl}/jobs/${jobId}/comments/${variantKey}/${commentId}`)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Fetches alternative HGVS nomenclatures for a variant using the Ensembl API.
   */
  async getHgvsAlternatives(transcript: string, position: number, ref: string, alt: string, assembly = 'GRCh38'): Promise<string[]> {
    try {
      const payload: HGVSRequest = { transcript, pos: position, ref, alt, assembly };
      return await firstValueFrom(
        this.http.post<string[]>(`${this.apiUrl}/tools/hgvs/alternatives`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Stores fetched alternatives in the job data.
   */
  async addJobHgvsAlternatives(jobId: string, principalHgvs: string, alternatives: string[]): Promise<any> {
    try {
      const payload = { principal_hgvs: principalHgvs, alternatives };
      return await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/jobs/${jobId}/hgvs-alternatives`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Enhances a variant with VEP data and metadata from the job.
   * @param variant - The variant to enhance
   * @param patientName - Name of the patient
   * @param patientId - Unique patient identifier
   * @param job - Job metadata containing annotations
   * @returns Enhanced Variant object
   */
  enhanceVariant(variant: Variant, patientName: string, patientId: string, job: any): Variant {
    let vepData = null;
    const vHgvs = variant['hgvs'];
    const principalHgvs = Array.isArray(vHgvs) ? vHgvs[0] : (vHgvs ? String(vHgvs) : null);

    if (job.vep_annotations) {
      if (principalHgvs && job.vep_annotations[principalHgvs]) {
        vepData = job.vep_annotations[principalHgvs];
      } else if (principalHgvs && job.hgvs_alternatives && job.hgvs_alternatives[principalHgvs]) {
        const alts = job.hgvs_alternatives[principalHgvs];
        for (const alt of alts) {
          if (job.vep_annotations[alt]) {
            vepData = job.vep_annotations[alt];
            break;
          }
        }
      }

      // Fallback: check all possible HGVS strings for this variant combined
      if (!vepData) {
        const hgvsKeys: string[] = [];
        if (principalHgvs) hgvsKeys.push(principalHgvs);
        if (principalHgvs && job.hgvs_alternatives?.[principalHgvs]) {
          hgvsKeys.push(...job.hgvs_alternatives[principalHgvs]);
        }
        if (Array.isArray(vHgvs)) {
          hgvsKeys.push(...vHgvs.map(String));
        }

        for (const key of hgvsKeys) {
          if (job.vep_annotations[key]) {
            vepData = job.vep_annotations[key];
            break;
          }
        }
      }
    }

    const enhancedVariant: Variant = {
      ...variant,
      patient: patientName,
      patientId: patientId
    };

    if (vepData) {
      enhancedVariant['gene_symbol'] = vepData.gene_symbol;
      enhancedVariant['impact'] = vepData.impact;
      enhancedVariant['consequence'] = vepData.consequence;
      enhancedVariant['hgvs_c'] = vepData.hgvs_c;
      enhancedVariant['hgvs_p'] = vepData.hgvs_p;
      enhancedVariant['sift'] = vepData.sift;
      enhancedVariant['polyphen'] = vepData.polyphen;
    }

    return enhancedVariant;
  }

  /**
   * Groups identical variants found in different reads.
   * Keeps the highest quality instance and attaches others as polymorphisms.
   * @param variants - List of variants to group
   */
  groupVariants(variants: Variant[]): Variant[] {
    const flattened: Variant[] = [];

    // Flatten first to ensure deep grouping
    for (const v of variants) {
      flattened.push({ ...v });
      if (v.polymorphism) {
        flattened.push(...v.polymorphism.map(p => ({ ...p })));
        v.polymorphism = undefined;
      }
    }

    const groups = new Map<string, Variant[]>();

    for (const v of flattened) {
      const key = `${v.position}-${v.type}-${v.ref}-${v.alt}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(v);
    }

    const result: Variant[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0]);
      } else {
        group.sort((a, b) => (b.qual || 0) - (a.qual || 0));
        const best = group[0];
        const others = group.slice(1);
        result.push({ ...best, polymorphism: others });
      }
    }

    return result;
  }

  /**
   * Creates a standardized AnalysisEntry for UI display.
   */
  createAnalysisEntry(patient: any, readId: string, alignment: any): AnalysisEntry {
    return {
      patient,
      readId,
      readName: readId.split('/').pop() || readId,
      result: {
        ...alignment,
        variants: alignment.variants || { columns: [], rows: [] }
      }
    };
  }

  /**
   * Exports job data to a target folder for sharing.
   * @param jobId - Job ID
   * @param level - Export depth ('full' or 'results_only')
   * @param targetFolder - Optional target directory
   */
  async shareJob(jobId: string, level: 'full' | 'results_only', targetFolder?: string): Promise<{ status: string, export_path: string }> {
    try {
      const payload = { level, target_folder: targetFolder };
      return await firstValueFrom(
        this.http.post<{ status: string, export_path: string }>(`${this.apiUrl}/jobs/${jobId}/share`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Imports a job from an exported folder.
   * @param sourceFolder - Folder containing the exported data
   */
  async importJob(sourceFolder: string): Promise<any> {
    try {
      const payload = { source_folder: sourceFolder };
      return await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/jobs/import`, payload)
      );
    } catch (error: any) {
      throw this.handleApiError(error);
    }
  }
}
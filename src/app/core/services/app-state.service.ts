import { Injectable, signal, computed } from '@angular/core';
import { Patient, SangerRead } from '../models/patient.model';

@Injectable({
    providedIn: 'root'
})
export class AppStateService {
    /** 
     * NC_ identifier for the reference sequence (e.g., NM_000546)
     * Used when fetching reference data from NCBI.
     */
    ncbiId = signal<string>('NM_000546');

    /** 
     * Local file path to the reference sequence (FASTA format).
     * Used when the user provides a local reference file.
     */
    refFastaPath = signal<string | null>(null);

    /** 
     * Toggle indicating if a local reference file should be used instead of NCBI.
     */
    useLocalRef = signal<boolean>(false);

    /** 
     * List of patients and their associated Sanger reads currently in the analysis session.
     */
    patients = signal<Patient[]>([]);

    /** 
     * ID of the currently active/selected job.
     */
    currentJobId = signal<string | null>(null);

    /** 
     * Name of the currently active job.
     */
    currentJobName = signal<string | null>(null);

    /** 
     * Computed reference identifier to be used in analysis.
     * Returns either the local FASTA path or the NCBI ID depending on the configuration.
     */
    activeReference = computed(() => {
        return (this.useLocalRef() ? this.refFastaPath() : this.ncbiId()) || '';
    });

    /**
     * Adds a new patient to the current session.
     * @param name - Name of the patient
     * @param id - Optional unique identifier. Generated if not provided.
     */
    addPatient(name: string, id?: string) {
        this.patients.update(p => [...p, {
            id: id || Math.random().toString(36).substring(2, 9),
            name,
            reads: []
        }]);
    }

    /**
     * Adds a Sanger read sequence to a patient's record.
     * @param patientId - ID of the target patient
     * @param filePath - Local path to the .ab1 or .scf file
     * @param readId - Optional unique identifier
     * @param config - Optional initial trimming settings
     */
    addRead(patientId: string, filePath: string, readId?: string, config?: { trimLeft: number, trimRight: number }) {
        this.patients.update(patients => {
            const patient = patients.find(p => p.id === patientId);
            if (patient) {
                const alreadyExists = patient.reads.some(read => read.file === filePath);
                if (!alreadyExists) {
                    patient.reads.push({
                        id: readId || Math.random().toString(36).substring(2, 9),
                        file: filePath,
                        trimLeft: config?.trimLeft ?? 50,
                        trimRight: config?.trimRight ?? 50
                    });
                }
            }
            return [...patients];
        });
    }

    /**
     * Updates the trimming configuration for a specific read.
     */
    updateReadConfig(patientId: string, readId: string, config: { trimLeft: number, trimRight: number }) {
        this.patients.update(patients => {
            const patient = patients.find(p => p.id === patientId);
            if (patient) {
                const read = patient.reads.find(r => r.id === readId);
                if (read) {
                    read.trimLeft = config.trimLeft;
                    read.trimRight = config.trimRight;
                }
            }
            return [...patients];
        });
    }

    /**
     * Removes a patient and all their associated reads from the session.
     */
    removePatient(patientId: string) {
        this.patients.update(patients => patients.filter(p => p.id !== patientId));
    }

    /**
     * Removes a specific read file from a patient.
     */
    removeRead(patientId: string, filePath: string) {
        this.patients.update(patients => {
            const patient = patients.find(p => p.id === patientId);
            if (patient) {
                patient.reads = patient.reads.filter(read => read.file !== filePath);
            }
            return [...patients];
        });
    }

    /**
     * Resets the application to use NCBI instead of a local reference.
     */
    clearLocalRef() {
        this.useLocalRef.set(false);
        this.refFastaPath.set(null);
    }

    /**
     * Sets a local FASTA file as the active reference sequence.
     * @param path - Path to the FASTA file
     */
    setLocalRef(path: string) {
        this.refFastaPath.set(path);
        this.useLocalRef.set(true);
        this.ncbiId.set('');
    }
}

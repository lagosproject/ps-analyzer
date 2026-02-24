/**
 * Represents a single Sanger sequencing read.
 */
export interface SangerRead {
  /** Unique identifier for the read */
  id: string;
  /** File path or name of the sequence file (.ab1, .scf, etc.) */
  file: string;
  /** Optional left trimming value in base pairs */
  trimLeft?: number;
  /** Optional right trimming value in base pairs */
  trimRight?: number;
}

/**
 * Represents a patient and their associated sequencing data.
 */
export interface Patient {
  /** Uniqueidentifier for the patient */
  id: string;
  /** Full name or label of the patient */
  name: string;
  /** List of sequencing reads associated with this patient */
  reads: SangerRead[];
}
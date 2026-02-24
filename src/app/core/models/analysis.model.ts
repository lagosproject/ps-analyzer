import { Patient } from "./patient.model";

/**
 * Represents a genetic variant found in a patient's sample.
 */
export interface Variant {
  /** The name or identifier of the patient */
  patient: string;
  /** The genomic position of the variant (1-indexed) */
  position: number;
  /** The reference allele */
  ref: string;
  /** The alternative allele */
  alt: string;
  /** The type of variant (e.g., SNP, Insertion, Deletion) */
  type: string;
  /** The quality score of the variant call */
  qual: number;
  /** Optional filter status (e.g., PASS, Fail) */
  filter?: string;
  /** Other variants found at the same position in different reads (for polyploid/hetezigous analysis) */
  polymorphism?: Variant[];
  /** Internal patient identifier */
  patientId?: string;
  /** Catch-all for additional dynamic properties (e.g. VEP annotations) */
  [key: string]: any;
}

/**
 * Tabular data structure for variant results.
 */
export interface VariantData {
  /** Column names in the result table */
  columns: string[];
  /** Data rows matching the column definitions */
  rows: any[][];
}

/**
 * Metadata for sequence alignment.
 */
export interface AlignmentMetadata {
  /** Starting position on the reference sequence */
  refStart: number;
  /** Forward reference position */
  refForward: number;
  /** Number of bases trimmed from the start */
  intro_trimmed?: number;
  /** Number of bases trimmed from the end */
  outro_trimmed?: number;
}

/**
 * A single item in a consensus alignment.
 */
export interface ConsensusAlignItem {
  /** Position on the reference sequence */
  refPos: number;
  /** Trace positions for Sanger peaks (Sense) */
  sangerPos1?: number[];
  /** Trace positions for Sanger peaks (Antisense) */
  sangerPos2?: number[];
  /** Alternative alleles found in Sense */
  alt1: string[];
  /** Alternative alleles found in Antisense */
  alt2: string[];
  /** Consensus base at this position */
  cons: string[];
}

/**
 * The complete result of an alignment and variant calling analysis.
 */
export interface AnalysisResult {
  /** Table of variants found */
  variants: VariantData;
  /** Mapping of positions to consensus alignment details */
  consensusAlign?: Record<string, ConsensusAlignItem>;
  /** Alignment positioning metadata */
  alignment: AlignmentMetadata;
  /** Raw trace signal data for visualization */
  trace: {
    traceA: number[];
    traceC: number[];
    traceG: number[];
    traceT: number[];
    peakLocations: number[];
  };
  /** Total base count */
  baseCount?: number;
  /** Consensus sequence based on reads */
  readSeqConsensus?: string[];
  /** Complementary consensus sequence */
  readSeqConsensusComplementary?: string[];
  /** Reference sequence used for alignment */
  readSeqRef?: string[];
}

/**
 * Request payload for retrieving HGVS alternative nomenclatures.
 */
export interface HGVSRequest {
  /** Transcript accession (e.g., NM_...) */
  transcript: string;
  /** Genome assembly version */
  assembly?: string;
  /** Genomic position */
  pos: number;
  /** Reference allele */
  ref: string;
  /** Alternative allele */
  alt: string;
}

/**
 * Structured error information from the analysis engine.
 */
export interface AnalysisError {
  /** Type of error */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Backend stack trace for debugging */
  traceback: string;
}

/**
 * Single entry in the analysis job results.
 */
export interface AnalysisEntry {
  /** Patient associated with the result */
  patient: Patient;
  /** Read identifier (e.g. file path or unique ID) */
  readId: string;
  /** Display name for the read */
  readName?: string;
  /** Backend analysis result */
  result: AnalysisResult;
  /** High-level mapped variants for easy UI display */
  mappedVariants?: Variant[];
}

/**
 * Result of a single read within a multi-read job.
 */
export interface JobReadResult {
  /** Internal patient ID */
  patientId: string;
  /** Path to the read file */
  readPath: string;
  /** Analysis result if successful */
  alignment?: AnalysisResult;
  /** Error message if failed */
  error?: string;
}

/**
 * Configuration parameters for the Tracy alignment engine.
 */
export interface TracyConfig {
  /** Probability ratio threshold */
  pratio: number;
  /** K-mer size for initial matching */
  kmer: number;
  /** Support threshold */
  support: number;
  /** Maximum insertion/deletion size */
  maxindel: number;
  /** Gap open penalty */
  gapopen: number;
  /** Gap extension penalty */
  gapext: number;
  /** Match score */
  match: number;
  /** Mismatch penalty */
  mismatch: number;
  /** General trimming threshold */
  trim: number;
  /** Bases to trim from the left */
  trimLeft: number;
  /** Bases to trim from the right */
  trimRight: number;
  /** Optional annotation source */
  annotate?: string;
  /** Line limit for processing */
  linelimit: number;
}

/**
 * Configuration for HGVS and VEP annotations.
 */
export interface HGVSConfig {
  /** Target transcript */
  transcript?: string;
  /** Gene symbol */
  gene?: string;
  /** Genome assembly */
  assembly: string;
  /** Whether to automatically generate HGVS */
  auto_hgvs?: boolean;
  /** Whether to automatically fetch VEP annotations */
  auto_vep?: boolean;
}

/**
 * Genomic feature from a reference file.
 */
export interface GeneFeature {
  /** Feature type (e.g., gene, exon, CDS) */
  type: string;
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Strand (+1 or -1) */
  strand: number;
  /** Additional metadata from the source file */
  qualifiers: Record<string, any>;
}

/**
 * User comment on a specific job variant.
 */
export interface JobComment {
  /** Unique comment ID */
  id: string;
  /** Comment text content */
  text: string;
  /** Author name/ID */
  author: string;
  /** Timestamp of creation (ISO string) */
  created_at: string;
}
/**
 * Reference sequence setup for an analysis job.
 */
export interface JobReference {
  /** Source type: 'file' for local FASTA, 'ncbi' for accession code */
  type: 'file' | 'ncbi';
  /** The local path or NCBI accession ID */
  value: string;
}

/**
 * A sequenced read entry within a job's patient record.
 */
export interface JobRead {
  /** Unique read ID */
  id: string;
  /** File path */
  file: string;
  /** Bases to trim from the start */
  trimLeft?: number;
  /** Bases to trim from the end */
  trimRight?: number;
}

/**
 * Patient record within a specific job.
 */
export interface JobPatient {
  /** Unique patient identifier */
  id: string;
  /** Patient name or display label */
  name: string;
  /** List of reads for this patient in this job */
  reads: JobRead[];
}

/**
 * The complete metadata and configuration for an analysis job.
 */
export interface AnalysisJob {
  /** Unique identifier for the job */
  id: string;
  /** Human-readable name */
  name: string;
  /** Reference sequence configuration */
  reference: JobReference;
  /** List of patients and their reads */
  patients: JobPatient[];
  /** Alignment engine configuration */
  config?: TracyConfig;
  /** HGVS/VEP annotation settings */
  hgvs_config?: HGVSConfig;
  /** Timestamp when the job was created */
  created_at: string;
  /** Tool version used for the analysis */
  version?: string;
  /** Current status of the job (e.g., 'created', 'running', 'completed', 'failed') */
  status?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current status message */
  status_message?: string;
  /** Error message if the job failed */
  error?: string;
  /** Analysis results output */
  results?: any[];
  /** User discussion comments mapped by variant position */
  comments?: Record<string, JobComment[]>;
  /** Genomic features associated with the job's reference */
  features?: GeneFeature[];
  /** Alternative HGVS names returned by VEP */
  hgvs_alternatives?: Record<string, string[]>;
  /** The reference sequence content */
  reference_sequence?: string;
}

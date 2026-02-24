import { AnalysisEntry, Variant, JobComment } from '../../../core/models/analysis.model';
import { ReportConfigItem } from '../../../core/services/report.service';

/**
 * Represents a single read entry in a report item.
 */
export interface ReportReadEntry {
    /** Short display name for the read */
    readId: string;
    /** Full analysis data for the read */
    trace: AnalysisEntry;
    /** Optional variant details specific to this read */
    variant?: Variant;
}

/**
 * Represents a processed report item combining configuration and data.
 */
export interface ProcessedReportItem {
    /** Original configuration for this item */
    config: ReportConfigItem;
    /** Mapped variant details */
    variant: Variant;
    /** HGVS nomenclature for display */
    hgvs: string;
    /** Comments associated with this variant from the job */
    jobComments: JobComment[];
    /** List of reads to be displayed in the report for this variant */
    reads: ReportReadEntry[];
}

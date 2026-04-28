import { Injectable } from '@angular/core';
import { AnalysisJob, Variant, JobComment } from '../models/analysis.model';
import { ProcessedReportItem } from '../../features/report/models/report.models';

/**
 * Service for generating FHIR (Fast Healthcare Interoperability Resources) representations
 * of genomic analysis data.
 */
@Injectable({
    providedIn: 'root'
})
export class FhirService {

    /**
     * Generates a FHIR R4 Bundle containing Patient and Genomic Observation resources
     * based on the provided report items and job metadata.
     * 
     * @param items - The processed report items (variants and associated reads)
     * @param job - The source analysis job for metadata
     * @returns A FHIR R4 Bundle object
     */
    generateReportBundle(items: ProcessedReportItem[], job: AnalysisJob | null): any {
        const bundle: any = {
            resourceType: 'Bundle',
            type: 'collection',
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            entry: []
        };

        // Collect unique patients
        const patientsMap = new Map<string, any>();
        items.forEach(item => {
            const pId = item.variant.patientId || 'unknown-patient';
            if (!patientsMap.has(pId)) {
                patientsMap.set(pId, {
                    resourceType: 'Patient',
                    id: pId,
                    name: [{ text: item.variant.patient || 'Unknown Patient' }]
                });
            }
        });

        // Add patients to bundle
        patientsMap.forEach(patient => {
            bundle.entry.push({ resource: patient });
        });

        // Add observations for each variant
        items.forEach(item => {
            const v = item.variant;
            const pId = v.patientId || 'unknown-patient';
            
            const observation: any = {
                resourceType: 'Observation',
                id: crypto.randomUUID(),
                status: 'final',
                category: [
                    {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                                code: 'laboratory',
                                display: 'Laboratory'
                            }
                        ]
                    }
                ],
                code: {
                    coding: [
                        {
                            system: 'http://loinc.org',
                            code: '69548-6',
                            display: 'Genetic variant assessment'
                        }
                    ],
                    text: 'Genetic variant assessment'
                },
                subject: {
                    reference: `Patient/${pId}`
                },
                effectiveDateTime: new Date().toISOString(),
                valueCodeableConcept: {
                    coding: [
                        {
                            system: 'http://loinc.org',
                            code: 'LA9633-4',
                            display: 'Present'
                        }
                    ]
                },
                note: item.jobComments.map(c => ({ text: `[${c.author}] ${c.text}` })),
                component: [
                    {
                        code: {
                            coding: [{ system: 'http://loinc.org', code: '48013-7', display: 'Genomic reference sequence ID' }]
                        },
                        valueString: job?.reference.value || 'unknown'
                    },
                    {
                        code: {
                            coding: [{ system: 'http://loinc.org', code: '48019-4', display: 'Genomic DNA region start' }]
                        },
                        valueInteger: v.position
                    },
                    {
                        code: {
                            coding: [{ system: 'http://loinc.org', code: '48001-2', display: 'Genomic DNA change (Nucleotide change)' }]
                        },
                        valueString: item.hgvs || `g.${v.position}${v.ref}>${v.alt}`
                    }
                ]
            };

            // Add clinical significance if available
            if (v['clinical_significance']) {
                observation.component.push({
                    code: {
                        coding: [{ system: 'http://loinc.org', code: '48019-4', display: 'Clinical significance' }]
                    },
                    valueCodeableConcept: {
                        text: v['clinical_significance']
                    }
                });
            }

            bundle.entry.push({ resource: observation });
        });

        return bundle;
    }
}

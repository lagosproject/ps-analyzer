import { Component, input, output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Variant } from '../../../../core/models/analysis.model';
import { ToastService } from '../../../../core/services/toast.service';
import { openUrl } from '@tauri-apps/plugin-opener';

interface OCGroup {
  module: string;
  fields: { name: string; value: any }[];
}

@Component({
  selector: 'app-variant-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './variant-details-modal.component.html',
  styleUrl: './variant-details-modal.component.css'
})
export class VariantDetailsModalComponent {
  isVisible = input(false);
  isVisibleChange = output<boolean>();
  variant = input<Variant | null>(null);
  targetTranscript = input<string | null>(null);

  /** Active OpenCRAVAT module tab for filtering */
  activeCravatTab = signal<string>('All');

  private toastService = inject(ToastService);

  /**
   * Formats a consequence abbreviation into a descriptive name.
   */
  readonly consequenceMap: Record<string, string> = {
    'MIS': 'Missense',
    'SYN': 'Synonymous',
    'INT': 'Intronic',
    'IND': 'Indel',
    'DEL': 'Deletion',
    'INS': 'Insertion',
    'CSH': 'Complex Substitution',
    'FSD': 'Frameshift Deletion',
    'FSI': 'Frameshift Insertion',
    'CSS': 'Canonical Splice Site',
    'SPL': 'Splice Site Region',
    'STG': 'Stop Gain',
    'STL': 'Stop Loss',
    'UNG': 'Unknown',
    '2KU': '2kb Upstream',
    '2KD': '2kb Downstream',
    'UT3': "3' UTR",
    'UT5': "5' UTR",
    'NMD': 'Nonsense Mediated Decay'
  };

  getConsequenceDisplayName(consequence: string | undefined | null): string {
    if (!consequence) return 'N/A';
    const clean = consequence.trim().toUpperCase();
    const mapped = this.consequenceMap[clean];
    if (mapped && mapped.toUpperCase() !== clean) {
      return `${mapped} (${consequence})`;
    }
    return consequence;
  }

  getVariantName(): string {
    const v = this.variant();
    if (!v) return '';
    
    // Attempt to extract HGVS string from variant
    let hgvs: string[] = [];
    if (v['hgvs']) {
      hgvs = Array.isArray(v['hgvs']) ? v['hgvs'] : [v['hgvs'].toString()];
    }

    const target = this.targetTranscript();
    if (target) {
      const targetName = hgvs.find(h => h.includes(target));
      if (targetName) return targetName;
    }

    const priority = hgvs.find(h => h.startsWith('NM_'));
    if (priority) return priority;

    if (hgvs.length > 0) {
      return hgvs[0];
    }
    return `${v.ref}${v.position}${v.alt}`;
  }

  getAlternateNames(): string[] {
    const v = this.variant();
    if (!v) return [];
    
    let hgvs: string[] = [];
    if (v['hgvs']) {
      hgvs = Array.isArray(v['hgvs']) ? v['hgvs'] : [v['hgvs'].toString()];
    }

    const primaryName = this.getVariantName();
    return hgvs.filter(h => h !== primaryName);
  }

  /**
   * Returns list of patients involved with this variant.
   */
  getInvolvedPatients(): string[] {
    const v = this.variant();
    if (!v) return [];
    const patients = new Set<string>();
    patients.add(v.patient);
    if (v.polymorphism) {
      v.polymorphism.forEach((p: Variant) => patients.add(p.patient));
    }
    return Array.from(patients).sort();
  }

  /**
   * Parses and groups `oc_data` by module source prefix (e.g. clinvar, gnomad).
   */
  readonly cravatGroups = computed<OCGroup[]>(() => {
    const v = this.variant();
    if (!v) return [];

    const groupsMap = new Map<string, { name: string; value: any }[]>();

    if (v['oc_data']) {
      const rawData = v['oc_data'] as Record<string, any>;
      Object.entries(rawData).forEach(([key, val]) => {
        // Exclude simple columns that are already explicitly mapped in standard UI
        if (['uid', 'hugo', 'so', 'achange', 'coding', 'impact'].includes(key)) return;

        let moduleName = 'General';
        let fieldName = key;

        if (key.includes('__')) {
          const parts = key.split('__');
          moduleName = parts[0];
          fieldName = parts[1];
        }

        if (['original_input', 'tagsampler'].includes(moduleName.toLowerCase())) return;

        // Format field name nicely (e.g. "sig" -> "Sig", "disease_names" -> "Disease Names")
        const formattedFieldName = fieldName
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        if (!groupsMap.has(moduleName)) {
          groupsMap.set(moduleName, []);
        }
        groupsMap.get(moduleName)!.push({
          name: formattedFieldName,
          value: val
        });
      });
    }
    const groups = Array.from(groupsMap.entries())
      .map(([module, fields]) => {
        // Sort fields alphabetically
        fields.sort((a, b) => a.name.localeCompare(b.name));
        
        // Format module name (e.g. "clinvar" -> "ClinVar", "gnomad" -> "gnomAD")
        let formattedModule = module.toUpperCase();
        if (module.toLowerCase() === 'clinvar') formattedModule = 'ClinVar';
        else if (module.toLowerCase() === 'gnomad') formattedModule = 'gnomAD';
        else if (module.toLowerCase() === 'dbsnp') formattedModule = 'dbSNP';
        else if (module.toLowerCase() === 'cosmic') formattedModule = 'COSMIC';
        else if (module.toLowerCase() === 'general') formattedModule = 'Base Annotations';
        else {
          formattedModule = module.charAt(0).toUpperCase() + module.slice(1);
        }

        // Merge Disease Names and Disease Refs if module is ClinVar
        if (formattedModule === 'ClinVar') {
          const namesField = fields.find(f => f.name === 'Disease Names');
          const refsField = fields.find(f => f.name === 'Disease Refs');
          
          if (namesField) {
            const namesList = String(namesField.value).split('|').map(s => s.trim());
            const refsList = refsField ? String(refsField.value).split('|').map(s => s.trim()) : [];
            
            const paired: { name: string; refs: { label: string; url: string }[] }[] = [];
            
            namesList.forEach((name, idx) => {
              if (!name || name === '.' || name.toLowerCase() === 'not provided') return;
              
              const refsForName: { label: string; url: string }[] = [];
              const rawRefs = refsList[idx];
              if (rawRefs && rawRefs !== '.' && rawRefs !== '-') {
                rawRefs.split(',').forEach(r => {
                  const resolved = this.resolveRef(r);
                  if (resolved.label) {
                    refsForName.push(resolved);
                  }
                });
              }
              
              paired.push({
                name,
                refs: refsForName
              });
            });
            
            fields = fields.filter(f => f.name !== 'Disease Names' && f.name !== 'Disease Refs');
            if (paired.length > 0) {
              fields.push({
                name: 'Disease Associations Linked',
                value: paired
              });
            }
          }
        }

        return {
          module: formattedModule,
          fields
        };
      })
      .sort((a, b) => a.module.localeCompare(b.module));

    // Append VEP annotations if available
    const vepFields: { name: string; value: any }[] = [];
    if (v['gene_symbol']) vepFields.push({ name: 'Gene Symbol', value: v['gene_symbol'] });
    if (v['consequence']) vepFields.push({ name: 'Consequence', value: v['consequence'] });
    if (v['impact']) vepFields.push({ name: 'Impact', value: v['impact'] });
    if (v['hgvs_c']) vepFields.push({ name: 'HGVS coding', value: v['hgvs_c'] });
    if (v['hgvs_p']) vepFields.push({ name: 'HGVS protein', value: v['hgvs_p'] });
    if (v['sift']) vepFields.push({ name: 'SIFT', value: v['sift'] });
    if (v['polyphen']) vepFields.push({ name: 'PolyPhen', value: v['polyphen'] });
    if (v['clin_sig'] && (Array.isArray(v['clin_sig']) ? v['clin_sig'].length > 0 : v['clin_sig'])) {
      vepFields.push({ name: 'Clinical Significance', value: Array.isArray(v['clin_sig']) ? v['clin_sig'].join(', ') : v['clin_sig'] });
    }
    if (v['phenotype'] && (Array.isArray(v['phenotype']) ? v['phenotype'].length > 0 : v['phenotype'])) {
      vepFields.push({ name: 'Phenotype', value: Array.isArray(v['phenotype']) ? v['phenotype'].join(', ') : v['phenotype'] });
    }

    if (vepFields.length > 0) {
      groups.push({
        module: 'VEP',
        fields: vepFields
      });
    }

    return groups;
  });

  /**
   * Computed list of OpenCRAVAT groups filtered by the active tab.
   */
  readonly filteredCravatGroups = computed(() => {
    const tab = this.activeCravatTab();
    const groups = this.cravatGroups();
    if (tab === 'All') return groups;
    return groups.filter(g => g.module === tab);
  });

  setActiveCravatTab(tab: string) {
    this.activeCravatTab.set(tab);
  }

  async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toastService.show('Copied to clipboard!', 'success');
    } catch (err) {
      console.error(err);
      this.toastService.show('Failed to copy', 'error');
    }
  }

  async openLink(type: string) {
    const v = this.variant();
    if (!v) return;

    let url = '';
    const name = this.getVariantName();

    if (type === 'ensembl') {
      url = `https://www.ensembl.org/Homo_sapiens/Search/Results?q=${encodeURIComponent(name)}`;
    } else if (type === 'clinvar') {
      // Check if dbSNP rsid or ClinVar ID is available in oc_data
      const clinvarId = v['oc_data']?.['clinvar__id'];
      if (clinvarId) {
        url = `https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`;
      } else {
        url = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(name)}`;
      }
    } else if (type === 'gnomad') {
      // Format should ideally be chrom-pos-ref-alt
      const ocData = v['oc_data'];
      const chrom = ocData?.['chrom'] || v['chrom'];
      const pos = ocData?.['pos'] || v.position;
      const ref = ocData?.['ref'] || v.ref;
      const alt = ocData?.['alt'] || v.alt;
      
      if (chrom && pos && ref && alt) {
        const cleanChrom = chrom.toString().replace('chr', '');
        url = `https://gnomad.broadinstitute.org/variant/${cleanChrom}-${pos}-${ref}-${alt}?dataset=gnomad_r4`;
      } else {
        url = `https://gnomad.broadinstitute.org/search?q=${encodeURIComponent(name)}`;
      }
    } else if (type === 'dbsnp') {
      const rsid = v['oc_data']?.['dbsnp__rsid'] || v['dbsnp_id'];
      if (rsid) {
        url = `https://www.ncbi.nlm.nih.gov/snp/${rsid}`;
      } else {
        url = `https://www.ncbi.nlm.nih.gov/snp/?term=${encodeURIComponent(name)}`;
      }
    } else if (type === 'franklin') {
      const ocData = v['oc_data'];
      const chrom = ocData?.['chrom'] || v['chrom'];
      const pos = ocData?.['pos'] || v.position;
      const ref = ocData?.['ref'] || v.ref;
      const alt = ocData?.['alt'] || v.alt;
      
      if (chrom && pos && ref && alt) {
        const cleanChrom = chrom.toString().replace('chr', '');
        url = `https://franklin.genoox.com/clinical-db/program/search?q=chr${cleanChrom}-${pos}-${ref}-${alt}`;
      } else {
        url = `https://franklin.genoox.com/clinical-db/program/search?q=${encodeURIComponent(name)}`;
      }
    }

    if (!url) return;

    this.toastService.show(`Opening external site...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      console.error('Failed to open URL via Tauri opener:', err);
      window.open(url, '_blank');
    }
  }

  isLongValue(val: any): boolean {
    if (val === null || val === undefined) return false;
    const str = String(val);
    return str.length > 30 || (str.length > 20 && str.includes(' '));
  }

  splitCommaString(val: any): string[] {
    if (!val) return [];
    const str = String(val);
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  formatConsequence(val: any): string {
    if (!val) return '';
    const str = String(val);
    return str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  async openPubmed(pmid: string) {
    const numeric = pmid.replace('PMID:', '').trim();
    const url = `https://pubmed.ncbi.nlm.nih.gov/${numeric}/`;
    this.toastService.show(`Opening PubMed article...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  async openDbsnp(rsid: string) {
    const url = `https://www.ncbi.nlm.nih.gov/snp/${rsid.trim()}`;
    this.toastService.show(`Opening dbSNP...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  splitPipeString(val: any): string[] {
    if (!val) return [];
    const str = String(val);
    return str
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s !== '.' && s.toLowerCase() !== 'not provided');
  }

  async openClinvar(id: any) {
    const url = `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`;
    this.toastService.show(`Opening NCBI ClinVar...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  async openDbsnpId(id: any) {
    const url = `https://www.ncbi.nlm.nih.gov/snp/rs${id}`;
    this.toastService.show(`Opening dbSNP...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  getClinicalSourceUrl(source: string): string {
    const parts = source.split(':');
    if (parts.length < 2) return '';
    const db = parts[0].trim().toLowerCase();
    const id = parts[1].trim();
    if (db === 'clingen') {
      return `https://reg.clinicalgenome.org/redirection/CAId/${id}`;
    } else if (db === 'omim') {
      const subParts = id.split('.');
      if (subParts.length === 2) {
        return `https://www.omim.org/entry/${subParts[0]}#${subParts[1]}`;
      }
      return `https://www.omim.org/entry/${id}`;
    } else if (db === 'uniprotkb') {
      const subParts = id.split('#');
      return `https://www.uniprot.org/uniprotkb/${subParts[0]}/entry`;
    }
    return '';
  }

  async openExternalUrl(url: string) {
    this.toastService.show(`Opening external link...`, 'info');
    try {
      await openUrl(url);
    } catch (err) {
      window.open(url, '_blank');
    }
  }

  resolveRef(ref: string): { label: string; url: string } {
    ref = ref.trim();
    let cleanRef = ref;
    if (ref.toUpperCase().startsWith('MONDO:MONDO:')) {
      cleanRef = ref.substring(6);
    }
    
    const colonIndex = cleanRef.indexOf(':');
    if (colonIndex === -1) return { label: cleanRef, url: '' };
    
    const db = cleanRef.substring(0, colonIndex).trim();
    const id = cleanRef.substring(colonIndex + 1).trim();
    const dbLower = db.toLowerCase();
    
    let url = '';
    if (dbLower.includes('medgen')) {
      url = `https://www.ncbi.nlm.nih.gov/medgen/?term=${id}`;
    } else if (dbLower.includes('human phenotype ontology') || dbLower === 'hpo' || dbLower === 'hp') {
      url = `https://hpo.jax.org/app/browse/term/${id}`;
    } else if (dbLower === 'mondo') {
      url = `https://monarchinitiative.org/disease/${db}:${id}`;
    } else if (dbLower.includes('orphanet') || dbLower === 'orpha') {
      url = `https://www.orpha.net/consor/cgi-bin/OC_Exp.php?lng=EN&Expert=${id}`;
    } else if (dbLower === 'omim') {
      url = `https://www.omim.org/entry/${id}`;
    }
    
    return { label: cleanRef, url };
  }

  close() {
    this.isVisibleChange.emit(false);
  }
}

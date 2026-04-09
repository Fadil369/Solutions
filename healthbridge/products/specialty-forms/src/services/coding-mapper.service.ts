import { MappedCode } from '../types';
import { query } from '../database/connection';

// Dental: ADA → SNODENT → NPHIES mapping
const DENTAL_MAPPINGS: Record<string, { snodent: string; nphies: string; system: string; desc: string }> = {
  'D0150': { snodent: '12102', nphies: '66888', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Comprehensive oral evaluation' },
  'D0210': { snodent: '13101', nphies: '66900', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Intraoral complete series radiographic images' },
  'D1110': { snodent: '15111', nphies: '66950', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Prophylaxis — adult' },
  'D2140': { snodent: '25110', nphies: '67050', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Amalgam — one surface' },
  'D2391': { snodent: '25211', nphies: '67060', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Resin-based composite — one surface, posterior' },
  'D2750': { snodent: '27111', nphies: '67100', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Crown — porcelain fused to high noble metal' },
  'D2950': { snodent: '29111', nphies: '67150', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Core buildup, including any pins' },
  'D3310': { snodent: '33111', nphies: '67200', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Endodontic therapy, anterior' },
  'D4341': { snodent: '45111', nphies: '67250', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Periodontal scaling and root planing — 4+ teeth per quadrant' },
  'D7140': { snodent: '71111', nphies: '67300', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Extraction, erupted tooth or exposed root' },
  'D7210': { snodent: '72111', nphies: '67310', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Extraction, erupted tooth requiring removal of bone and/or sectioning of tooth' },
  'D6010': { snodent: '61111', nphies: '67400', system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure', desc: 'Surgical placement of implant body: endosteal implant' },
};

// Dermatology: ICD-10 skin codes → NPHIES
const DERMA_MAPPINGS: Record<string, { nphies: string; system: string; desc: string }> = {
  'L57.0': { nphies: 'ICD10-L57.0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Actinic keratosis' },
  'C44.90': { nphies: 'ICD10-C44.90', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Malignant neoplasm of skin, unspecified' },
  'L30.0': { nphies: 'ICD10-L30.0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Nummular dermatitis' },
  'L40.0': { nphies: 'ICD10-L40.0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Psoriasis vulgaris' },
  'L20.9': { nphies: 'ICD10-L20.9', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Atopic dermatitis, unspecified' },
  'L70.0': { nphies: 'ICD10-L70.0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Acne vulgaris' },
  'B35.1': { nphies: 'ICD10-B35.1', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Tinea unguium' },
  'D22.9': { nphies: 'ICD10-D22.9', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Melanocytic nevus, unspecified' },
};

// Ophthalmology: ICD-10 eye codes → NPHIES
const OPHTHAL_MAPPINGS: Record<string, { nphies: string; system: string; desc: string }> = {
  'H40.10X0': { nphies: 'ICD10-H40.10X0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Unspecified open-angle glaucoma, stage unspecified' },
  'H25.9': { nphies: 'ICD10-H25.9', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Unspecified cataract' },
  'H35.30': { nphies: 'ICD10-H35.30', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Nonexudative age-related macular degeneration, unspecified' },
  'H36.0': { nphies: 'ICD10-H36.0', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Diabetic retinopathy' },
  'H52.10': { nphies: 'ICD10-H52.10', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Myopia, unspecified eye' },
  'H52.20': { nphies: 'ICD10-H52.20', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Astigmatism, unspecified eye' },
  'H10.9': { nphies: 'ICD10-H10.9', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Unspecified conjunctivitis' },
  'H20.9': { nphies: 'ICD10-H20.9', system: 'http://nphies.sa/terminology/CodeSystem/icd-10', desc: 'Unspecified iridocyclitis' },
};

const MAPPING_TABLES: Record<string, Record<string, { nphies: string; system: string; desc: string }>> = {
  dental: DENTAL_MAPPINGS,
  derma: DERMA_MAPPINGS,
  ophthalmology: OPHTHAL_MAPPINGS,
};

export class CodingMapper {
  async mapCode(specialty: string, localCode: string): Promise<MappedCode | null> {
    // Check cache first
    const cached = await query(
      'SELECT * FROM coding_cache WHERE specialty = $1 AND local_code = $2',
      [specialty, localCode]
    );

    if (cached.rows.length > 0) {
      const row = cached.rows[0];
      return {
        nphiesCode: row.nphies_code,
        nphiesSystem: row.nphies_system,
        description: row.local_desc,
        localCode: row.local_code,
        specialty: row.specialty,
      };
    }

    // Check mapping table
    const table = MAPPING_TABLES[specialty];
    if (!table) return null;

    const mapping = table[localCode];
    if (!mapping) return null;

    // Cache the mapping
    await this.cacheMapping(specialty, localCode, mapping.nphies, mapping.system, mapping.desc);

    return {
      nphiesCode: mapping.nphies,
      nphiesSystem: mapping.system,
      description: mapping.desc,
      localCode,
      specialty,
    };
  }

  async bulkMap(specialty: string, localCodes: string[]): Promise<MappedCode[]> {
    const results: MappedCode[] = [];
    for (const code of localCodes) {
      const mapped = await this.mapCode(specialty, code);
      if (mapped) results.push(mapped);
    }
    return results;
  }

  async cacheMapping(
    specialty: string,
    localCode: string,
    nphiesCode: string,
    nphiesSystem: string,
    description: string
  ): Promise<void> {
    await query(
      `INSERT INTO coding_cache (specialty, local_code, local_desc, nphies_code, nphies_system)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (specialty, local_code) DO UPDATE SET
         nphies_code = EXCLUDED.nphies_code,
         nphies_system = EXCLUDED.nphies_system,
         mapped_at = NOW()`,
      [specialty, localCode, description, nphiesCode, nphiesSystem]
    );
  }

  async searchCodes(specialty: string, queryStr: string): Promise<MappedCode[]> {
    // Search in-memory mappings
    const table = MAPPING_TABLES[specialty];
    if (!table) return [];

    const q = queryStr.toLowerCase();
    const results: MappedCode[] = [];

    for (const [code, mapping] of Object.entries(table)) {
      if (code.toLowerCase().includes(q) || mapping.desc.toLowerCase().includes(q)) {
        results.push({
          nphiesCode: mapping.nphies,
          nphiesSystem: mapping.system,
          description: mapping.desc,
          localCode: code,
          specialty,
        });
      }
    }

    // Also search cached codes
    const cached = await query(
      `SELECT * FROM coding_cache WHERE specialty = $1 AND (local_code ILIKE $2 OR local_desc ILIKE $2) LIMIT 50`,
      [specialty, `%${queryStr}%`]
    );

    for (const row of cached.rows) {
      if (!results.find((r) => r.localCode === row.local_code)) {
        results.push({
          nphiesCode: row.nphies_code,
          nphiesSystem: row.nphies_system,
          description: row.local_desc,
          localCode: row.local_code,
          specialty: row.specialty,
        });
      }
    }

    return results;
  }
}

export const codingMapper = new CodingMapper();

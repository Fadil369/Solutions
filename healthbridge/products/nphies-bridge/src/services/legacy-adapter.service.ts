import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { Patient } from '../types';

export interface LegacyRecord {
  patientNationalId: string;
  patientNameAr?: string;
  patientNameEn?: string;
  patientDob?: string;
  patientGender?: string;
  patientPhone?: string;
  insuranceId?: string;
  serviceDate: string;
  procedureCode: string;
  procedureDescription: string;
  diagnosisCode: string;
  amount: number;
}

export abstract class LegacyAdapter {
  abstract name: string;
  abstract parse(filePath: string): Promise<LegacyRecord[]>;
  abstract pollDb(connectionString: string): Promise<LegacyRecord[]>;

  protected async upsertPatient(record: LegacyRecord): Promise<string> {
    const result = await query(
      `INSERT INTO patients (id, national_id, name_ar, name_en, dob, gender, phone, insurance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (national_id) DO UPDATE SET
         name_ar = COALESCE(EXCLUDED.name_ar, patients.name_ar),
         name_en = COALESCE(EXCLUDED.name_en, patients.name_en),
         phone = COALESCE(EXCLUDED.phone, patients.phone),
         insurance_id = COALESCE(EXCLUDED.insurance_id, patients.insurance_id),
         updated_at = NOW()
       RETURNING id`,
      [
        uuidv4(), record.patientNationalId,
        record.patientNameAr, record.patientNameEn,
        record.patientDob, record.patientGender,
        record.patientPhone, record.insuranceId,
      ]
    );
    return result.rows[0].id;
  }

  async sync(filePath: string): Promise<{ imported: number; errors: number }> {
    const records = await this.parse(filePath);
    let imported = 0;
    let errors = 0;

    for (const record of records) {
      try {
        await this.upsertPatient(record);
        imported++;
      } catch (err: any) {
        logger.error('Failed to import record', { record: record.patientNationalId, error: err.message });
        errors++;
      }
    }

    logger.info(`Legacy sync complete: ${imported} imported, ${errors} errors`);
    return { imported, errors };
  }
}

export class CsvAdapter extends LegacyAdapter {
  name = 'CSV';

  // Column mapping for different PMS exports
  private columnMaps: Record<string, Record<string, string>> = {
    accumed: {
      patientNationalId: 'NationalID',
      patientNameAr: 'PatientNameAR',
      patientNameEn: 'PatientNameEN',
      patientDob: 'DOB',
      patientGender: 'Gender',
      patientPhone: 'Mobile',
      insuranceId: 'InsuranceNo',
      serviceDate: 'ServiceDate',
      procedureCode: 'CPTCode',
      procedureDescription: 'CPTDesc',
      diagnosisCode: 'ICDCode',
      amount: 'Amount',
    },
    medware: {
      patientNationalId: 'NATIONAL_ID',
      patientNameAr: 'NAME_AR',
      patientNameEn: 'NAME_EN',
      patientDob: 'DATE_OF_BIRTH',
      patientGender: 'SEX',
      patientPhone: 'PHONE',
      insuranceId: 'POLICY_NUMBER',
      serviceDate: 'ENCOUNTER_DATE',
      procedureCode: 'PROC_CODE',
      procedureDescription: 'PROC_DESC',
      diagnosisCode: 'DIAG_CODE',
      amount: 'CHARGE_AMOUNT',
    },
    generic: {
      patientNationalId: 'national_id',
      patientNameAr: 'name_ar',
      patientNameEn: 'name_en',
      patientDob: 'dob',
      patientGender: 'gender',
      patientPhone: 'phone',
      insuranceId: 'insurance_id',
      serviceDate: 'service_date',
      procedureCode: 'procedure_code',
      procedureDescription: 'procedure_description',
      diagnosisCode: 'diagnosis_code',
      amount: 'amount',
    },
  };

  async parse(filePath: string, pmsType: string = 'generic'): Promise<LegacyRecord[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const columnMap = this.columnMaps[pmsType] || this.columnMaps.generic;

    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    return rows.map((row: any) => {
      const record: any = {};
      for (const [target, source] of Object.entries(columnMap)) {
        record[target] = row[source] || row[source.toLowerCase()] || '';
      }
      // Normalize gender
      if (record.patientGender) {
        const g = record.patientGender.toLowerCase();
        record.patientGender = g.startsWith('m') ? 'male' : g.startsWith('f') ? 'female' : g;
      }
      // Parse amount
      record.amount = parseFloat(record.amount) || 0;
      return record as LegacyRecord;
    });
  }

  async pollDb(_connectionString: string): Promise<LegacyRecord[]> {
    // SQL-based polling would go here
    logger.warn('SQL polling not yet configured for CSV adapter');
    return [];
  }
}

export class Hl7v2Adapter extends LegacyAdapter {
  name = 'HL7v2';

  async parse(filePath: string): Promise<LegacyRecord[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const messages = content.split(/\nMSH\|/).filter(Boolean);
    const records: LegacyRecord[] = [];

    for (const msg of messages) {
      const segments = ('MSH|' + msg).split('\n');
      const record: LegacyRecord = {
        patientNationalId: '',
        serviceDate: new Date().toISOString().split('T')[0],
        procedureCode: '',
        procedureDescription: '',
        diagnosisCode: '',
        amount: 0,
      };

      for (const segment of segments) {
        const [segId, ...fields] = segment.split('|');

        if (segId === 'PID') {
          // PID-3: Patient ID, PID-5: Name
          record.patientNationalId = fields[2]?.split('^')[0] || '';
          const name = fields[4]?.split('^') || [];
          record.patientNameEn = `${name[1] || ''} ${name[0] || ''}`.trim();
        }

        if (segId === 'PV1') {
          // PV1-44: Admit date
          const dateStr = fields[43] || '';
          if (dateStr.length >= 8) {
            record.serviceDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          }
        }

        if (segId === 'DG1') {
          // DG1-3: Diagnosis code
          record.diagnosisCode = fields[2]?.split('^')[0] || '';
        }

        if (segId === 'FT1' || segId === 'DFT') {
          // Procedure code and amount
          record.procedureCode = fields[3]?.split('^')[0] || '';
          record.procedureDescription = fields[3]?.split('^')[1] || '';
          record.amount = parseFloat(fields[11] || '0');
        }
      }

      if (record.patientNationalId) {
        records.push(record);
      }
    }

    return records;
  }

  async pollDb(_connectionString: string): Promise<LegacyRecord[]> {
    return [];
  }
}

export class AdapterFactory {
  static create(pmsType: string): LegacyAdapter {
    switch (pmsType.toLowerCase()) {
      case 'csv':
      case 'accumed':
      case 'medware':
      case 'excel':
        return new CsvAdapter();
      case 'hl7':
      case 'hl7v2':
        return new Hl7v2Adapter();
      default:
        logger.warn(`Unknown PMS type: ${pmsType}, defaulting to CSV`);
        return new CsvAdapter();
    }
  }
}

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../database/connection';
import { z } from 'zod';
import winston from 'winston';
import type { BillingRecord, Visit } from '../types';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const router = Router();

// Base consultation fees (SAR)
const CONSULTATION_FEES: Record<string, number> = {
  'General Medicine': 150,
  'Dental': 200,
  'Ophthalmology': 180,
  'Dermatology': 170,
  'OB/GYN': 200,
  'Pediatrics': 150,
  'Orthopedics': 200,
  'Laboratory': 50,
  'Radiology': 100,
};

/**
 * POST /api/billing/generate/:visitId — Generate bill from completed visit
 */
router.post('/generate/:visitId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await queryOne<Visit & { patient_insurance_id?: string }>(
      `SELECT v.*, p.insurance_id as patient_insurance_id
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE v.id = $1`,
      [req.params.visitId]
    );

    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status === 'billed') {
      return res.status(409).json({ error: 'Visit already billed' });
    }
    if (visit.status !== 'completed') {
      return res.status(400).json({ error: 'Visit must be completed before billing' });
    }

    // Calculate amounts
    const baseFee = CONSULTATION_FEES[visit.department] || 150;
    const hasInsurance = !!visit.patient_insurance_id;
    const insuranceCovered = hasInsurance ? baseFee * 0.8 : 0; // 80% coverage
    const copay = baseFee - insuranceCovered;

    // Add prescription costs if any
    let prescriptionCost = 0;
    if (visit.prescriptions && (visit.prescriptions as any).medications) {
      prescriptionCost = (visit.prescriptions as any).medications.length * 25; // SAR 25 per medication
    }

    const totalAmount = baseFee + prescriptionCost;
    const totalInsuranceCovered = hasInsurance ? totalAmount * 0.8 : 0;
    const totalCopay = totalAmount - totalInsuranceCovered;

    // Check for existing billing record
    const existingBilling = await queryOne<BillingRecord>(
      'SELECT * FROM billing_records WHERE visit_id = $1',
      [req.params.visitId]
    );

    let billing: BillingRecord;

    if (existingBilling) {
      billing = await queryOne<BillingRecord>(
        `UPDATE billing_records
         SET amount = $1, insurance_covered = $2, copay = $3, status = 'pending'
         WHERE id = $4
         RETURNING *`,
        [totalAmount, totalInsuranceCovered, totalCopay, existingBilling.id]
      ) as BillingRecord;
    } else {
      billing = await queryOne<BillingRecord>(
        `INSERT INTO billing_records (id, visit_id, patient_id, amount, insurance_covered, copay, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [uuidv4(), req.params.visitId, visit.patient_id, totalAmount, totalInsuranceCovered, totalCopay]
      ) as BillingRecord;
    }

    // Mark visit as billed
    await query("UPDATE visits SET status = 'billed' WHERE id = $1", [req.params.visitId]);

    logger.info('Bill generated', {
      visitId: req.params.visitId,
      amount: totalAmount,
      insurance: totalInsuranceCovered,
      copay: totalCopay,
    });

    res.json({
      billing,
      breakdown: {
        consultation_fee: baseFee,
        prescription_cost: prescriptionCost,
        total: totalAmount,
        insurance_covered: totalInsuranceCovered,
        copay: totalCopay,
        has_insurance: hasInsurance,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billing/submit-nphies/:billingId — Submit to NPHIES
 */
router.post('/submit-nphies/:billingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const billing = await queryOne<BillingRecord & { visit_dept?: string; visit_chief_complaint?: string }>(
      `SELECT b.*, v.department as visit_dept, v.chief_complaint as visit_chief_complaint,
              v.diagnosis_codes, v.prescriptions, v.vitals,
              p.national_id, p.name_en, p.name_ar, p.insurance_id, p.phone
       FROM billing_records b
       JOIN visits v ON v.id = b.visit_id
       JOIN patients p ON p.id = b.patient_id
       WHERE b.id = $1`,
      [req.params.billingId]
    );

    if (!billing) return res.status(404).json({ error: 'Billing record not found' });
    if (billing.status === 'paid') {
      return res.status(409).json({ error: 'Billing already paid' });
    }

    // Build FHIR Claim resource (NPHIES format)
    const fhirClaim = {
      resourceType: 'Claim',
      status: 'active',
      type: {
        coding: [{
          system: 'http://nphies.sa/terminology/claim-type',
          code: 'institutional',
        }],
      },
      use: 'claim',
      patient: {
        reference: `Patient/${billing.patient_id}`,
        display: billing.name_en || billing.name_ar,
      },
      created: new Date().toISOString(),
      insurer: {
        reference: `Organization/${billing.insurance_id || 'unknown'}`,
      },
      provider: {
        reference: `Organization/${process.env.NPHIES_FACILITY_ID || 'flowclinic-demo'}`,
      },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claimpriority',
          code: 'normal',
        }],
      },
      diagnosis: (billing.diagnosis_codes || []).map((code: string, index: number) => ({
        sequence: index + 1,
        diagnosisCodeableConcept: {
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10',
            code,
          }],
        },
      })),
      item: [{
        sequence: 1,
        productOrService: {
          coding: [{
            system: 'http://nphies.sa/terminology/procedure-code',
            code: 'CONSULTATION',
            display: billing.visit_dept || 'Consultation',
          }],
        },
        unitPrice: {
          value: billing.amount,
          currency: 'SAR',
        },
        net: {
          value: billing.amount,
          currency: 'SAR',
        },
      }],
      total: {
        value: billing.amount,
        currency: 'SAR',
      },
    };

    // In production, this would submit to the NPHIES API via shared library
    // For now, simulate submission
    const claimId = `NPHIES-${uuidv4().substring(0, 8).toUpperCase()}`;

    const updated = await queryOne<BillingRecord>(
      `UPDATE billing_records SET nphies_claim_id = $1, status = 'submitted' WHERE id = $2 RETURNING *`,
      [claimId, req.params.billingId]
    );

    logger.info('NPHIES claim submitted (simulated)', { billingId: req.params.billingId, claimId });

    res.json({
      billing: updated,
      fhirClaim,
      nphiesClaimId: claimId,
      note: 'Simulated submission — configure NPHIES credentials for real submission',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/billing/zatca/:billingId — Generate ZATCA e-invoice
 */
router.post('/zatca/:billingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const billing = await queryOne<BillingRecord & { patient_national_id?: string; patient_name_en?: string }>(
      `SELECT b.*, p.national_id as patient_national_id, p.name_en as patient_name_en
       FROM billing_records b
       JOIN patients p ON p.id = b.patient_id
       WHERE b.id = $1`,
      [req.params.billingId]
    );

    if (!billing) return res.status(404).json({ error: 'Billing record not found' });

    // Build ZATCA Phase 2 simplified invoice XML structure
    const invoiceId = `ZATCA-${uuidv4().substring(0, 8).toUpperCase()}`;
    const invoiceDate = new Date().toISOString();

    const zatcaInvoice = {
      invoiceType: 'simplified',
      invoiceId,
      invoiceDate,
      seller: {
        name: 'FlowClinic PolyClinic',
        vatNumber: '300000000000003', // Demo VAT number
        address: 'Riyadh, KSA',
      },
      buyer: {
        name: billing.patient_name_en || 'Patient',
        nationalId: billing.patient_national_id || '',
      },
      lineItems: [{
        description: 'Medical Consultation',
        quantity: 1,
        unitPrice: billing.amount,
        vatRate: 15,
        vatAmount: billing.amount * 0.15,
        total: billing.amount * 1.15,
      }],
      totals: {
        subtotal: billing.amount,
        vat: billing.amount * 0.15,
        total: billing.amount * 1.15,
        currency: 'SAR',
      },
    };

    const updated = await queryOne<BillingRecord>(
      `UPDATE billing_records SET zatca_invoice_id = $1 WHERE id = $2 RETURNING *`,
      [invoiceId, req.params.billingId]
    );

    logger.info('ZATCA invoice generated', { billingId: req.params.billingId, invoiceId });

    res.json({
      billing: updated,
      zatcaInvoice,
      note: 'Simulated — configure ZATCA certificates for real e-invoicing',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/pending — List pending bills
 */
router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const bills = await query(
      `SELECT b.*, p.name_en as patient_name, p.name_ar as patient_name_ar,
              p.national_id, v.department
       FROM billing_records b
       JOIN patients p ON p.id = b.patient_id
       JOIN visits v ON v.id = b.visit_id
       WHERE b.status = 'pending'
       ORDER BY b.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const total = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM billing_records WHERE status = 'pending'"
    );

    res.json({
      bills,
      pagination: {
        page,
        limit,
        total: parseInt(total?.count || '0'),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/billing/daily-summary — Daily revenue summary
 */
router.get('/daily-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const summary = await queryOne(
      `SELECT
         COUNT(*) as total_bills,
         COALESCE(SUM(amount), 0) as total_amount,
         COALESCE(SUM(insurance_covered), 0) as total_insurance,
         COALESCE(SUM(copay), 0) as total_copay,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
         COUNT(*) FILTER (WHERE status = 'paid') as paid_count
       FROM billing_records
       WHERE DATE(created_at) = $1`,
      [date]
    );

    const byDepartment = await query(
      `SELECT v.department,
         COUNT(*) as bill_count,
         COALESCE(SUM(b.amount), 0) as total_amount
       FROM billing_records b
       JOIN visits v ON v.id = b.visit_id
       WHERE DATE(b.created_at) = $1
       GROUP BY v.department
       ORDER BY total_amount DESC`,
      [date]
    );

    res.json({
      date,
      summary: {
        total_bills: parseInt(summary?.total_bills || '0'),
        total_amount: parseFloat(summary?.total_amount || '0'),
        total_insurance: parseFloat(summary?.total_insurance || '0'),
        total_copay: parseFloat(summary?.total_copay || '0'),
        pending_count: parseInt(summary?.pending_count || '0'),
        submitted_count: parseInt(summary?.submitted_count || '0'),
        paid_count: parseInt(summary?.paid_count || '0'),
      },
      by_department: byDepartment,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

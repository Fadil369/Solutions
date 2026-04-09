import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../database/connection';
import { nphiesService } from '../services/nphies.service';
import { claimScrubber } from '../services/claim-scrubber.service';
import { fhirMapper } from '../services/fhir-mapper.service';
import { AppError } from '../middleware/error.middleware';
import { ApiResponse, Claim, ClaimItem, PaginatedResponse, ScrubberResult } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Create a new claim
router.post('/', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { patientId, encounterId, items, icdCodes, serviceDate } = req.body;

    // Validate required fields
    if (!patientId || !items?.length || !icdCodes?.length || !serviceDate) {
      throw new AppError('MISSING_FIELDS', 'patientId, items, icdCodes, and serviceDate are required', 400);
    }

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
    const claimNumber = `HB-${Date.now().toString(36).toUpperCase()}`;

    // Run claim scrubber before creating
    const scrubResult = await claimScrubber.validateClaim({
      patientId,
      items,
      icdCodes,
      serviceDate,
      totalAmount,
    });

    // Create claim and items in transaction
    const result = await transaction(async (client) => {
      const claimResult = await client.query(
        `INSERT INTO claims (claim_number, patient_id, encounter_id, status, total_amount, icd_codes, service_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [claimNumber, patientId, encounterId, 'draft', totalAmount, icdCodes, serviceDate]
      );

      const claim = claimResult.rows[0];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await client.query(
          `INSERT INTO claim_items (claim_id, line_number, code, code_system, description, quantity, unit_price, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [claim.id, i + 1, item.code, item.codeSystem, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
        );
      }

      return claim;
    });

    res.status(201).json({
      success: true,
      data: {
        claim: result,
        scrubResult: {
          valid: scrubResult.valid,
          score: scrubResult.score,
          errors: scrubResult.errors,
          warnings: scrubResult.warnings,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to create claim', { error: err.message });
    throw new AppError('CLAIM_CREATE_FAILED', err.message, 500);
  }
});

// Submit claim to NPHIES
router.post('/:id/submit', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { id } = req.params;

    // Fetch claim with items
    const claimResult = await query('SELECT * FROM claims WHERE id = $1', [id]);
    if (claimResult.rows.length === 0) {
      throw new AppError('CLAIM_NOT_FOUND', 'Claim not found', 404);
    }
    const claim = claimResult.rows[0];

    if (claim.status !== 'draft') {
      throw new AppError('INVALID_STATUS', `Cannot submit claim with status: ${claim.status}`, 400);
    }

    const itemsResult = await query('SELECT * FROM claim_items WHERE claim_id = $1 ORDER BY line_number', [id]);
    const patientResult = await query('SELECT * FROM patients WHERE id = $1', [claim.patient_id]);

    if (patientResult.rows.length === 0) {
      throw new AppError('PATIENT_NOT_FOUND', 'Patient not found', 404);
    }

    // Re-run scrubber as final check
    const scrubResult = await claimScrubber.validateClaim({
      patientId: claim.patient_id,
      items: itemsResult.rows.map((item: any) => ({
        code: item.code,
        codeSystem: item.code_system,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })),
      icdCodes: claim.icd_codes,
      serviceDate: claim.service_date,
      totalAmount: claim.total_amount,
    });

    if (!scrubResult.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SCRUBBER_FAILED',
          message: 'Claim failed pre-submission validation',
          details: scrubResult,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Build FHIR Claim and submit
    const fhirClaim = fhirMapper.toFhirClaim(claim, itemsResult.rows, patientResult.rows[0]);
    const submissionResult = await nphiesService.submitClaim(fhirClaim);

    // Update claim status
    await query(
      `UPDATE claims SET status = $1, nphies_claim_id = $2, nphies_response = $3, submitted_at = NOW(), updated_at = NOW() WHERE id = $4`,
      [submissionResult.status, submissionResult.nphiesClaimId, JSON.stringify(submissionResult.rawResponse), id]
    );

    // Log rejections if any
    if (submissionResult.rejectionCodes?.length) {
      for (const code of submissionResult.rejectionCodes) {
        const codeInfo = nphiesService.mapRejectionCode(code);
        await query(
          `INSERT INTO rejection_log (claim_id, rejection_code, rejection_desc, category) VALUES ($1, $2, $3, $4)`,
          [id, code, codeInfo.description, codeInfo.category]
        );
      }
    }

    res.json({
      success: true,
      data: {
        claimId: id,
        nphiesClaimId: submissionResult.nphiesClaimId,
        status: submissionResult.status,
        adjudication: submissionResult.adjudication,
        rejectionCodes: submissionResult.rejectionCodes,
        rejectionReason: submissionResult.rejectionReason,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    logger.error('Failed to submit claim', { error: err.message });
    throw new AppError('CLAIM_SUBMIT_FAILED', err.message, 500);
  }
});

// List claims with filters
router.get('/', async (req: Request, res: Response<ApiResponse<PaginatedResponse<Claim>>>) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.query.status) {
      conditions.push(`c.status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.patientId) {
      conditions.push(`c.patient_id = $${paramIndex++}`);
      params.push(req.query.patientId);
    }
    if (req.query.dateFrom) {
      conditions.push(`c.service_date >= $${paramIndex++}`);
      params.push(req.query.dateFrom);
    }
    if (req.query.dateTo) {
      conditions.push(`c.service_date <= $${paramIndex++}`);
      params.push(req.query.dateTo);
    }
    if (req.query.search) {
      conditions.push(`(c.claim_number ILIKE $${paramIndex} OR p.name_en ILIKE $${paramIndex} OR p.name_ar ILIKE $${paramIndex} OR p.national_id ILIKE $${paramIndex})`);
      params.push(`%${req.query.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM claims c LEFT JOIN patients p ON c.patient_id = p.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT c.*, p.name_en as patient_name_en, p.name_ar as patient_name_ar, p.national_id as patient_national_id
       FROM claims c
       LEFT JOIN patients p ON c.patient_id = p.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    res.json({
      success: true,
      data: {
        items: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Get claim detail
router.get('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const claimResult = await query(
      `SELECT c.*, p.name_en as patient_name_en, p.name_ar as patient_name_ar, p.national_id as patient_national_id
       FROM claims c LEFT JOIN patients p ON c.patient_id = p.id WHERE c.id = $1`,
      [req.params.id]
    );

    if (claimResult.rows.length === 0) {
      throw new AppError('CLAIM_NOT_FOUND', 'Claim not found', 404);
    }

    const [itemsResult, rejectionsResult] = await Promise.all([
      query('SELECT * FROM claim_items WHERE claim_id = $1 ORDER BY line_number', [req.params.id]),
      query('SELECT * FROM rejection_log WHERE claim_id = $1 ORDER BY created_at DESC', [req.params.id]),
    ]);

    res.json({
      success: true,
      data: {
        ...claimResult.rows[0],
        items: itemsResult.rows,
        rejections: rejectionsResult.rows,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Resubmit rejected claim
router.post('/:id/resubmit', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { id } = req.params;
    const claimResult = await query('SELECT * FROM claims WHERE id = $1', [id]);

    if (claimResult.rows.length === 0) {
      throw new AppError('CLAIM_NOT_FOUND', 'Claim not found', 404);
    }

    const claim = claimResult.rows[0];
    if (claim.status !== 'rejected') {
      throw new AppError('INVALID_STATUS', `Can only resubmit rejected claims. Current status: ${claim.status}`, 400);
    }

    // Mark rejections as resolved
    await query('UPDATE rejection_log SET resolved = true, resolved_at = NOW() WHERE claim_id = $1', [id]);

    // Reset to draft for re-submission
    await query(`UPDATE claims SET status = 'draft', rejection_codes = '{}', rejection_reason = NULL, updated_at = NOW() WHERE id = $1`, [id]);

    res.json({
      success: true,
      data: { message: 'Claim reset to draft. Call /submit to re-submit.' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('RESUBMIT_FAILED', err.message, 500);
  }
});

// Claim analytics
router.get('/analytics/overview', async (_req: Request, res: Response<ApiResponse>) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const stats = await query(`
      SELECT
        COUNT(*) as total_claims,
        COUNT(CASE WHEN status = 'accepted' OR status = 'paid' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_claim_amount
      FROM claims
      WHERE service_date >= $1
    `, [thirtyDaysAgo]);

    const topRejections = await query(`
      SELECT rejection_code, COUNT(*) as count, rejection_desc
      FROM rejection_log
      WHERE created_at >= $1
      GROUP BY rejection_code, rejection_desc
      ORDER BY count DESC
      LIMIT 10
    `, [thirtyDaysAgo]);

    const s = stats.rows[0];
    const total = parseInt(s.total_claims) || 1;

    res.json({
      success: true,
      data: {
        totalClaims: parseInt(s.total_claims),
        accepted: parseInt(s.accepted),
        rejected: parseInt(s.rejected),
        pending: parseInt(s.pending),
        acceptanceRate: ((parseInt(s.accepted) / total) * 100).toFixed(1),
        totalRevenue: parseFloat(s.total_revenue),
        avgClaimAmount: parseFloat(s.avg_claim_amount).toFixed(2),
        topRejectionCodes: topRejections.rows.map((r: any) => ({
          code: r.rejection_code,
          count: parseInt(r.count),
          description: r.rejection_desc,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    throw new AppError('ANALYTICS_FAILED', err.message, 500);
  }
});

export default router;

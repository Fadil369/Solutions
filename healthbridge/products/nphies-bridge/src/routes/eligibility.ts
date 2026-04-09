import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { nphiesService } from '../services/nphies.service';
import { logger } from '../utils/logger';
import { ApiResponse, EligibilityCheck, PaginatedResponse } from '../types';

const router = Router();

// Check patient eligibility against NPHIES
router.post('/check', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { patientId, nationalId, payerId } = req.body;

    if (!nationalId && !patientId) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Either patientId or nationalId is required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Resolve national ID from patient record if needed
    let resolvedNationalId = nationalId;
    if (!resolvedNationalId && patientId) {
      const patientResult = await query('SELECT national_id, payer_id FROM patients WHERE id = $1', [patientId]);
      if (patientResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      resolvedNationalId = patientResult.rows[0].national_id;
    }

    // Call NPHIES Tameen
    const result = await nphiesService.checkEligibility({
      patientNationalId: resolvedNationalId,
      payerId: payerId || 'default-payer',
    });

    // Store result
    const dbResult = await query(
      `INSERT INTO eligibility_checks (patient_id, status, coverage_type, copay_amount, valid_until, plan_name, response, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, checked_at`,
      [
        patientId || null,
        result.eligible ? 'eligible' : 'ineligible',
        result.coverageType,
        result.copayAmount,
        result.validUntil,
        result.planName,
        JSON.stringify(result.rawResponse),
        result.responseTimeMs,
      ]
    );

    res.json({
      success: true,
      data: {
        checkId: dbResult.rows[0].id,
        eligible: result.eligible,
        status: result.status,
        coverageType: result.coverageType,
        copayAmount: result.copayAmount,
        validUntil: result.validUntil,
        planName: result.planName,
        memberName: result.memberName,
        responseTimeMs: result.responseTimeMs,
        checkedAt: dbResult.rows[0].checked_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('Eligibility check failed', { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: 'ELIGIBILITY_CHECK_FAILED', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Get eligibility history for a patient
router.get('/history/:patientId', async (req: Request, res: Response<ApiResponse<PaginatedResponse<EligibilityCheck>>>) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    const countResult = await query('SELECT COUNT(*) FROM eligibility_checks WHERE patient_id = $1', [patientId]);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT * FROM eligibility_checks WHERE patient_id = $1 ORDER BY checked_at DESC LIMIT $2 OFFSET $3`,
      [patientId, pageSize, offset]
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
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

// Dashboard stats for eligibility
router.get('/stats', async (_req: Request, res: Response<ApiResponse>) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [checksToday, successRate, avgResponse] = await Promise.all([
      query(`SELECT COUNT(*) FROM eligibility_checks WHERE DATE(checked_at) = $1`, [today]),
      query(`SELECT
               COUNT(CASE WHEN status = 'eligible' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as rate
             FROM eligibility_checks WHERE DATE(checked_at) = $1`, [today]),
      query(`SELECT AVG(response_time_ms) FROM eligibility_checks WHERE DATE(checked_at) = $1`, [today]),
    ]);

    res.json({
      success: true,
      data: {
        checksToday: parseInt(checksToday.rows[0].count),
        successRate: parseFloat(successRate.rows[0].rate || '0').toFixed(1),
        avgResponseTimeMs: Math.round(parseFloat(avgResponse.rows[0].avg || '0')),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'STATS_FAILED', message: err.message },
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

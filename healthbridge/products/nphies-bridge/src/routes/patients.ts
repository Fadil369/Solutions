import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { ApiResponse, Patient, PaginatedResponse } from '../types';
import { AppError } from '../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Search patients
router.get('/search', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const q = (req.query.q as string) || '';
    if (q.length < 2) {
      res.json({ success: true, data: [], timestamp: new Date().toISOString() });
      return;
    }

    const result = await query(
      `SELECT id, national_id, name_ar, name_en, phone, insurance_id, payer_name, last_visit
       FROM patients
       WHERE national_id ILIKE $1 OR name_en ILIKE $1 OR name_ar ILIKE $1 OR phone ILIKE $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json({ success: true, data: result.rows, timestamp: new Date().toISOString() });
  } catch (err: any) {
    throw new AppError('SEARCH_FAILED', err.message, 500);
  }
});

// List patients with pagination
router.get('/', async (req: Request, res: Response<ApiResponse<PaginatedResponse<Patient>>>) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    const countResult = await query('SELECT COUNT(*) FROM patients');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      'SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );

    res.json({
      success: true,
      data: { items: result.rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Get patient by ID
router.get('/:id', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const result = await query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      throw new AppError('PATIENT_NOT_FOUND', 'Patient not found', 404);
    }
    res.json({ success: true, data: result.rows[0], timestamp: new Date().toISOString() });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Get patient claims
router.get('/:id/claims', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const result = await query(
      `SELECT id, claim_number, status, total_amount, service_date, icd_codes, rejection_reason, created_at
       FROM claims WHERE patient_id = $1 ORDER BY service_date DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows, timestamp: new Date().toISOString() });
  } catch (err: any) {
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Get patient eligibility status
router.get('/:id/eligibility-status', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const result = await query(
      `SELECT * FROM eligibility_checks WHERE patient_id = $1 ORDER BY checked_at DESC LIMIT 1`,
      [req.params.id]
    );
    res.json({
      success: true,
      data: result.rows[0] || { status: 'no_check', message: 'No eligibility checks found' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    throw new AppError('FETCH_FAILED', err.message, 500);
  }
});

// Create patient
router.post('/', async (req: Request, res: Response<ApiResponse>) => {
  try {
    const { nationalId, nameAr, nameEn, dob, gender, phone, insuranceId, payerId, payerName } = req.body;

    if (!nationalId) {
      throw new AppError('MISSING_NATIONAL_ID', 'nationalId is required', 400);
    }

    const result = await query(
      `INSERT INTO patients (id, national_id, name_ar, name_en, dob, gender, phone, insurance_id, payer_id, payer_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (national_id) DO UPDATE SET
         name_ar = COALESCE(EXCLUDED.name_ar, patients.name_ar),
         name_en = COALESCE(EXCLUDED.name_en, patients.name_en),
         phone = COALESCE(EXCLUDED.phone, patients.phone),
         insurance_id = COALESCE(EXCLUDED.insurance_id, patients.insurance_id),
         updated_at = NOW()
       RETURNING *`,
      [uuidv4(), nationalId, nameAr, nameEn, dob, gender, phone, insuranceId, payerId, payerName]
    );

    res.status(201).json({ success: true, data: result.rows[0], timestamp: new Date().toISOString() });
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('CREATE_FAILED', err.message, 500);
  }
});

export default router;

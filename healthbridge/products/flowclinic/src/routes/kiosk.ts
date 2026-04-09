import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queueService } from '../services/queue.service';
import { query, queryOne } from '../database/connection';
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from '../config';
import { z } from 'zod';
import type { Patient, SupportedLanguage } from '../types';

const router = Router();

// Saudi national ID: 10 digits, starting with 1 (Saudi) or 2 (non-Saudi)
const saudiIdRegex = /^[12]\d{9}$/;

// Validation schemas
const registerSchema = z.object({
  nationalId: z.string().regex(saudiIdRegex, 'Invalid Saudi national ID format (10 digits starting with 1 or 2)'),
  nameAr: z.string().optional().default(''),
  nameEn: z.string().optional().default(''),
  phone: z.string().min(8).max(20),
  preferredLanguage: z.enum(['ar', 'en', 'ur', 'tl', 'bn', 'hi']).default('ar'),
  insuranceId: z.string().optional(),
  department: z.string().min(1),
});

const checkInSchema = z.object({
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().min(1),
  doctorId: z.string().optional(),
}).refine(data => data.nationalId || data.phone, {
  message: 'Either nationalId or phone is required',
});

/**
 * POST /api/kiosk/register — New patient registration
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    // Check if patient already exists
    const existing = await queryOne<Patient>(
      'SELECT * FROM patients WHERE national_id = $1',
      [body.nationalId]
    );

    if (existing) {
      // Patient exists — treat as check-in
      const entry = await queueService.joinQueue(existing.id, body.department);
      return res.status(200).json({
        action: 'check_in',
        patient: existing,
        queueEntry: entry,
        message: 'Patient already registered. Checked in to queue.',
      });
    }

    // Create new patient
    const patient = await queryOne<Patient>(
      `INSERT INTO patients (id, national_id, name_ar, name_en, phone, preferred_language, insurance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        uuidv4(),
        body.nationalId,
        body.nameAr,
        body.nameEn,
        body.phone,
        body.preferredLanguage,
        body.insuranceId || null,
      ]
    );

    if (!patient) throw new Error('Failed to create patient');

    // Auto-join queue
    const entry = await queueService.joinQueue(patient.id, body.department);

    res.status(201).json({
      action: 'registered',
      patient,
      queueEntry: entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/kiosk/check-in — Returning patient check-in
 */
router.post('/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = checkInSchema.parse(req.body);

    // Look up patient
    let patient: Patient | null = null;

    if (body.nationalId) {
      patient = await queryOne<Patient>(
        'SELECT * FROM patients WHERE national_id = $1',
        [body.nationalId]
      );
    }

    if (!patient && body.phone) {
      patient = await queryOne<Patient>(
        'SELECT * FROM patients WHERE phone = $1',
        [body.phone]
      );
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found. Please register as a new patient.' });
    }

    // Update last_visit
    await query('UPDATE patients SET last_visit = NOW() WHERE id = $1', [patient.id]);

    // Join queue
    const entry = await queueService.joinQueue(patient.id, body.department, body.doctorId);

    res.json({
      action: 'check_in',
      patient,
      queueEntry: entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * GET /api/kiosk/languages — Available languages for kiosk UI
 */
router.get('/languages', (_req: Request, res: Response) => {
  const languages = SUPPORTED_LANGUAGES.map(code => ({
    code,
    name: LANGUAGE_NAMES[code],
    flag: LANGUAGE_FLAGS[code],
    direction: code === 'ar' ? 'rtl' : 'ltr',
  }));
  res.json(languages);
});

/**
 * GET /api/kiosk/departments — Available departments for selection
 */
router.get('/departments', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM queue_entries q
         WHERE q.department = d.name_en AND q.status = 'waiting'
         AND DATE(q.created_at) = CURRENT_DATE) as waiting_count
       FROM departments d
       WHERE d.queue_enabled = true
       ORDER BY d.name_en`
    );
    res.json(departments);
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../database/connection';
import { voiceSoapService } from '../services/voice-soap.service';
import { z } from 'zod';
import type { Visit, Vitals, SoapNote, Prescription } from '../types';

const router = Router();

// Multer config for audio uploads (max 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Validation schemas
const startVisitSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().min(1),
  department: z.string().min(1),
  queueEntryId: z.string().uuid().optional(),
  chiefComplaint: z.string().optional(),
});

const vitalsSchema = z.object({
  bp_systolic: z.number().min(40).max(300),
  bp_diastolic: z.number().min(20).max(200),
  heart_rate: z.number().min(20).max(300),
  temperature: z.number().min(30).max(45),
  weight: z.number().min(0.5).max(500),
  height: z.number().min(20).max(250),
  spo2: z.number().min(50).max(100),
});

const soapNoteSchema = z.object({
  subjective: z.string().min(1),
  objective: z.string().min(1),
  assessment: z.string().min(1),
  plan: z.string().min(1),
});

const diagnosisSchema = z.object({
  icdCodes: z.array(z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, 'Invalid ICD-10 format')).min(1),
});

const prescriptionSchema = z.object({
  medications: z.array(z.object({
    name: z.string().min(1),
    dose: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
  })).min(1),
});

/**
 * POST /api/soap/visit/start — Start a new visit
 */
router.post('/visit/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = startVisitSchema.parse(req.body);

    // Verify patient exists
    const patient = await queryOne('SELECT id FROM patients WHERE id = $1', [body.patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const visit = await queryOne<Visit>(
      `INSERT INTO visits (id, patient_id, doctor_id, department, chief_complaint, status)
       VALUES ($1, $2, $3, $4, $5, 'in_progress')
       RETURNING *`,
      [uuidv4(), body.patientId, body.doctorId, body.department, body.chiefComplaint || null]
    );

    // If queue entry provided, mark as in_progress
    if (body.queueEntryId) {
      await query(
        `UPDATE queue_entries SET status = 'in_progress', called_at = COALESCE(called_at, NOW())
         WHERE id = $1`,
        [body.queueEntryId]
      );
    }

    res.status(201).json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * PUT /api/soap/visit/:id/vitals — Record vitals
 */
router.put('/visit/:id/vitals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = vitalsSchema.parse(req.body);

    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    const updated = await queryOne<Visit>(
      'UPDATE visits SET vitals = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(body), req.params.id]
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/soap/visit/:id/dictation — Voice-to-text SOAP note
 */
router.post('/visit/:id/dictation', upload.single('audio'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const language = (req.body.language as 'ar' | 'en') || 'en';
    const soapNote = await voiceSoapService.transcribeAndFormat(req.file.buffer, language);

    const updated = await queryOne<Visit>(
      'UPDATE visits SET soap_note = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(soapNote), req.params.id]
    );

    res.json({ soapNote, visit: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/soap/visit/:id/note — Manual SOAP note entry
 */
router.put('/visit/:id/note', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = soapNoteSchema.parse(req.body);

    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    const updated = await queryOne<Visit>(
      'UPDATE visits SET soap_note = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(body), req.params.id]
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/soap/visit/:id/diagnosis — Add diagnosis codes
 */
router.post('/visit/:id/diagnosis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = diagnosisSchema.parse(req.body);

    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    // Merge with existing codes
    const existingCodes = visit.diagnosis_codes || [];
    const newCodes = [...new Set([...existingCodes, ...body.icdCodes])];

    const updated = await queryOne<Visit>(
      'UPDATE visits SET diagnosis_codes = $1 WHERE id = $2 RETURNING *',
      [newCodes, req.params.id]
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/soap/visit/:id/prescriptions — Add prescriptions
 */
router.post('/visit/:id/prescriptions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = prescriptionSchema.parse(req.body);

    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    const prescription: Prescription = { medications: body.medications };

    const updated = await queryOne<Visit>(
      'UPDATE visits SET prescriptions = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(prescription), req.params.id]
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/soap/visit/:id/complete — Complete visit
 * Validates: must have vitals, soap note, at least one diagnosis
 * Auto-triggers billing record creation
 */
router.post('/visit/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await queryOne<Visit>('SELECT * FROM visits WHERE id = $1', [req.params.id]);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.status !== 'in_progress') {
      return res.status(400).json({ error: 'Visit is not in progress' });
    }

    // Validation
    const errors: string[] = [];
    if (!visit.vitals) errors.push('Vitals are required');
    if (!visit.soap_note) errors.push('SOAP note is required');
    if (!visit.diagnosis_codes || visit.diagnosis_codes.length === 0) {
      errors.push('At least one diagnosis code is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Visit incomplete', details: errors });
    }

    // Complete visit and create billing record in a transaction
    const result = await transaction(async (client) => {
      const updatedVisit = await client.query(
        `UPDATE visits SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      // Auto-create billing record
      const billing = await client.query(
        `INSERT INTO billing_records (id, visit_id, patient_id, amount, insurance_covered, copay, status)
         VALUES ($1, $2, $3, 0, 0, 0, 'pending')
         RETURNING *`,
        [uuidv4(), req.params.id, visit.patient_id]
      );

      return { visit: updatedVisit.rows[0], billing: billing.rows[0] };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/soap/visit/:id — Get visit details
 */
router.get('/visit/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visit = await queryOne(
      `SELECT v.*, p.name_ar as patient_name_ar, p.name_en as patient_name_en,
              p.national_id, p.phone, p.preferred_language
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    res.json(visit);
  } catch (error) {
    next(error);
  }
});

export default router;

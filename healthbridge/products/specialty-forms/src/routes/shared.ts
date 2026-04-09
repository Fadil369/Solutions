import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../database/connection';
import { codingMapper } from '../../services/coding-mapper.service';

const router = Router();

// ── Map local code to NPHIES code ──
router.post('/coding/map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specialty, localCode } = req.body;

    if (!specialty || !localCode) {
      res.status(400).json({ error: { message: 'specialty and localCode are required' } });
      return;
    }

    const validSpecialties = ['dental', 'derma', 'ophthalmology'];
    if (!validSpecialties.includes(specialty)) {
      res.status(400).json({ error: { message: `specialty must be one of: ${validSpecialties.join(', ')}` } });
      return;
    }

    const mapped = await codingMapper.mapCode(specialty, localCode);
    if (!mapped) {
      res.status(404).json({ error: { message: `No mapping found for ${specialty} code: ${localCode}` } });
      return;
    }

    res.json({ data: mapped });
  } catch (err) {
    next(err);
  }
});

// ── Search across all code systems ──
router.get('/coding/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { specialty, q } = req.query;

    if (!q || (q as string).length < 2) {
      res.status(400).json({ error: { message: 'Query parameter q must be at least 2 characters' } });
      return;
    }

    const specialties = specialty
      ? [specialty as string]
      : ['dental', 'derma', 'ophthalmology'];

    const results: Record<string, any[]> = {};
    for (const s of specialties) {
      results[s] = await codingMapper.searchCodes(s, q as string);
    }

    const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
    res.json({ data: results, total });
  } catch (err) {
    next(err);
  }
});

// ── Generic visit view ──
router.get('/visits/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const visit = await query(
      `SELECT v.*, p.name_ar, p.name_en, p.national_id 
       FROM visits v 
       JOIN patients p ON p.id = v.patient_id 
       WHERE v.id = $1`,
      [id]
    );

    if (visit.rows.length === 0) {
      res.status(404).json({ error: { message: 'Visit not found' } });
      return;
    }

    const v = visit.rows[0];

    // Fetch specialty-specific data
    let specialtyData = null;
    if (v.specialty === 'dental') {
      const [charts, treatments] = await Promise.all([
        query('SELECT * FROM dental_charts WHERE patient_id = $1 AND performed_at >= $2', [v.patient_id, v.created_at]),
        query('SELECT * FROM dental_treatments WHERE patient_id = $1 AND created_at >= $2', [v.patient_id, v.created_at]),
      ]);
      specialtyData = { charts: charts.rows, treatments: treatments.rows };
    } else if (v.specialty === 'derma') {
      const assessments = await query(
        'SELECT * FROM derma_assessments WHERE patient_id = $1 AND assessed_at >= $2',
        [v.patient_id, v.created_at]
      );
      specialtyData = { assessments: assessments.rows };
    } else if (v.specialty === 'ophthalmology') {
      const exams = await query(
        'SELECT * FROM ophthal_exams WHERE patient_id = $1 AND examined_at >= $2',
        [v.patient_id, v.created_at]
      );
      specialtyData = { exams: exams.rows };
    }

    res.json({ data: v, specialtyData });
  } catch (err) {
    next(err);
  }
});

// ── Complete visit ──
router.post('/visits/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE visits SET status = 'completed', completed_at = NOW() WHERE id = $1 AND status = 'in_progress' RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'Visit not found or already completed' } });
      return;
    }

    const visit = result.rows[0];

    // In production, trigger billing workflow here
    // e.g., generate invoice, submit to insurance, etc.

    res.json({
      data: visit,
      billingTriggered: true,
      message: 'Visit completed. Billing workflow initiated (simulated).',
    });
  } catch (err) {
    next(err);
  }
});

export default router;

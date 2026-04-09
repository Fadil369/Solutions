import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../database/connection';
import { privacyService } from '../../services/privacy.service';
import bodyRegionsData from '../../data/body-regions.json';
import { BodyRegion } from '../../types';

const router = Router();
const bodyRegions: BodyRegion[] = bodyRegionsData as BodyRegion[];

// ── New skin assessment ──
router.post('/assessment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, bodyRegion, lesionType, sizeMm, color, borderRegularity, notes, assessedBy } = req.body;

    if (!patientId || !bodyRegion) {
      res.status(400).json({ error: { message: 'patientId and bodyRegion are required' } });
      return;
    }

    const validRegion = bodyRegions.find((r) => r.region === bodyRegion);
    if (!validRegion) {
      res.status(400).json({
        error: {
          message: 'Invalid body region',
          validRegions: bodyRegions.map((r) => ({ region: r.region, label: r.label })),
        },
      });
      return;
    }

    const result = await query(
      `INSERT INTO derma_assessments (patient_id, body_region, lesion_type, size_mm, color, border_regularity, notes, assessed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [patientId, bodyRegion, lesionType || null, sizeMm || null, color || null, borderRegularity || null, notes || null, assessedBy || 'system']
    );

    res.status(201).json({ data: result.rows[0], regionInfo: validRegion });
  } catch (err) {
    next(err);
  }
});

// ── Assessment history ──
router.get('/assessments/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      `SELECT a.*, 
        (SELECT COUNT(*) FROM derma_photos p WHERE p.assessment_id = a.id) as photo_count
       FROM derma_assessments a WHERE a.patient_id = $1 ORDER BY a.assessed_at DESC`,
      [patientId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Upload lesion photo ──
router.post('/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, assessmentId, photoType, filePath, consentGiven, takenBy } = req.body;

    if (!patientId || !assessmentId || !filePath) {
      res.status(400).json({ error: { message: 'patientId, assessmentId, and filePath are required' } });
      return;
    }

    if (!consentGiven) {
      res.status(400).json({ error: { message: 'Patient consent is required before storing photos' } });
      return;
    }

    const result = await query(
      `INSERT INTO derma_photos (patient_id, assessment_id, photo_type, file_path, encrypted, consent_given, taken_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [patientId, assessmentId, photoType || 'lesion', filePath, true, consentGiven, takenBy || 'system']
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Photos for assessment (consent-checked) ──
router.get('/photos/:assessmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params;
    const result = await query(
      `SELECT id, patient_id, assessment_id, photo_type, 
        CASE WHEN consent_given THEN file_path ELSE '[REDACTED]' END as file_path,
        taken_at, taken_by
       FROM derma_photos 
       WHERE assessment_id = $1 AND consent_given = true 
       ORDER BY taken_at`,
      [assessmentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Compare two assessments ──
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assessmentId1, assessmentId2 } = req.body;

    if (!assessmentId1 || !assessmentId2) {
      res.status(400).json({ error: { message: 'Both assessmentId1 and assessmentId2 are required' } });
      return;
    }

    const [a1Result, a2Result] = await Promise.all([
      query('SELECT * FROM derma_assessments WHERE id = $1', [assessmentId1]),
      query('SELECT * FROM derma_assessments WHERE id = $1', [assessmentId2]),
    ]);

    if (a1Result.rows.length === 0 || a2Result.rows.length === 0) {
      res.status(404).json({ error: { message: 'One or both assessments not found' } });
      return;
    }

    const a1 = a1Result.rows[0];
    const a2 = a2Result.rows[0];

    // Calculate changes
    const sizeChange = a2.size_mm && a1.size_mm ? parseFloat(a2.size_mm) - parseFloat(a1.size_mm) : null;
    const sizeChangePercent = sizeChange && a1.size_mm ? ((sizeChange / parseFloat(a1.size_mm)) * 100).toFixed(1) : null;

    const changes: string[] = [];
    if (a1.size_mm !== a2.size_mm) changes.push(`Size: ${a1.size_mm}mm → ${a2.size_mm}mm (${sizeChangePercent}%)`);
    if (a1.color !== a2.color) changes.push(`Color: ${a1.color} → ${a2.color}`);
    if (a1.border_regularity !== a2.border_regularity) changes.push(`Border: ${a1.border_regularity} → ${a2.border_regularity}`);
    if (a1.lesion_type !== a2.lesion_type) changes.push(`Type: ${a1.lesion_type} → ${a2.lesion_type}`);

    res.json({
      data: {
        before: a1,
        after: a2,
        changes,
        sizeChangeMm: sizeChange,
        sizeChangePercent: sizeChangePercent ? parseFloat(sizeChangePercent) : null,
        daysBetween: Math.floor(
          (new Date(a2.assessed_at).getTime() - new Date(a1.assessed_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Create treatment plan ──
router.post('/treatment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assessmentId, patientId, treatmentPlan, medications, followUpDate } = req.body;

    if (!assessmentId || !patientId || !treatmentPlan) {
      res.status(400).json({ error: { message: 'assessmentId, patientId, and treatmentPlan are required' } });
      return;
    }

    const result = await query(
      `INSERT INTO derma_treatments (patient_id, assessment_id, treatment_plan, medications, follow_up_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, assessmentId, treatmentPlan, JSON.stringify(medications || []), followUpDate || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Body map with SVG overlay ──
router.get('/body-map/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const result = await query(
      `SELECT body_region, COUNT(*) as lesion_count, 
        MAX(assessed_at) as last_assessed,
        ARRAY_AGG(DISTINCT lesion_type) FILTER (WHERE lesion_type IS NOT NULL) as lesion_types
       FROM derma_assessments WHERE patient_id = $1 GROUP BY body_region`,
      [patientId]
    );

    // Build body map data with SVG regions
    const bodyMapData = bodyRegions.map((region) => {
      const assessment = result.rows.find((r) => r.body_region === region.region);
      return {
        ...region,
        hasAssessment: !!assessment,
        lesionCount: assessment ? parseInt(assessment.lesion_count) : 0,
        lastAssessed: assessment?.last_assessed || null,
        lesionTypes: assessment?.lesion_types || [],
      };
    });

    res.json({ data: bodyMapData, totalAssessments: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// ── Patient dermatology summary ──
router.get('/patient/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [assessments, treatments, photos] = await Promise.all([
      query(
        `SELECT body_region, COUNT(*) as count FROM derma_assessments WHERE patient_id = $1 GROUP BY body_region`,
        [id]
      ),
      query(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE follow_up_date > NOW()) as pending_followups 
         FROM derma_treatments WHERE patient_id = $1`,
        [id]
      ),
      query(
        `SELECT photo_type, COUNT(*) as count FROM derma_photos WHERE patient_id = $1 AND consent_given = true GROUP BY photo_type`,
        [id]
      ),
    ]);

    res.json({
      data: {
        patientId: id,
        assessmentsByRegion: assessments.rows,
        treatments: treatments.rows[0],
        photosByType: photos.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

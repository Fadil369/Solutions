import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../database/connection';
import { refractionCalculator } from '../../services/refraction-calculator.service';
import { RefractionData } from '../../types';

const router = Router();

// ── Record eye exam ──
router.post('/exam', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, examType, eye, visualAcuity, iop, refraction, notes, examinedBy } = req.body;

    if (!patientId || !examType) {
      res.status(400).json({ error: { message: 'patientId and examType are required' } });
      return;
    }

    // Validate IOP if provided
    let iopAlert = null;
    if (iop !== undefined && iop !== null) {
      const validation = refractionCalculator.validateIOP(iop);
      if (!validation.valid) {
        res.status(400).json({ error: { message: validation.alert, field: 'iop' } });
        return;
      }
      iopAlert = validation;
    }

    // Validate refraction values
    const sphere = refraction?.sphere ?? null;
    const cylinder = refraction?.cylinder ?? null;
    const axis = refraction?.axis ?? null;

    if (sphere !== null && (sphere < -30 || sphere > 30)) {
      res.status(400).json({ error: { message: 'Sphere must be between -30 and +30 diopters' } });
      return;
    }
    if (cylinder !== null && (cylinder < -15 || cylinder > 15)) {
      res.status(400).json({ error: { message: 'Cylinder must be between -15 and +15 diopters' } });
      return;
    }

    const result = await query(
      `INSERT INTO ophthal_exams (patient_id, exam_type, eye, visual_acuity, iop, refraction_sphere, refraction_cylinder, refraction_axis, notes, examined_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [patientId, examType, eye || 'both', visualAcuity || null, iop || null, sphere, cylinder, axis, notes || null, examinedBy || 'system']
    );

    res.status(201).json({
      data: result.rows[0],
      iopAlert,
    });
  } catch (err) {
    next(err);
  }
});

// ── Exam history ──
router.get('/exams/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      `SELECT * FROM ophthal_exams WHERE patient_id = $1 ORDER BY examined_at DESC`,
      [patientId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Upload imaging study ──
router.post('/imaging', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, examId, imageType, dicomPath, findings } = req.body;

    if (!patientId || !examId || !imageType) {
      res.status(400).json({ error: { message: 'patientId, examId, and imageType are required' } });
      return;
    }

    const validTypes = ['oct', 'hvf', 'fundus', 'topography'];
    if (!validTypes.includes(imageType)) {
      res.status(400).json({ error: { message: `imageType must be one of: ${validTypes.join(', ')}` } });
      return;
    }

    const result = await query(
      `INSERT INTO ophthal_imaging (patient_id, exam_id, image_type, dicom_path, findings)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, examId, imageType, dicomPath || null, findings || null]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Imaging for exam ──
router.get('/imaging/:examId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const result = await query(
      `SELECT * FROM ophthal_imaging WHERE exam_id = $1 ORDER BY uploaded_at DESC`,
      [examId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Serve DICOM file ──
router.get('/dicom/:imageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { imageId } = req.params;
    const result = await query('SELECT * FROM ophthal_imaging WHERE id = $1', [imageId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'Image not found' } });
      return;
    }

    const image = result.rows[0];
    if (!image.dicom_path) {
      res.status(404).json({ error: { message: 'No DICOM file associated with this image' } });
      return;
    }

    // Set proper DICOM content-type
    res.setHeader('Content-Type', 'application/dicom');
    res.setHeader('Content-Disposition', `inline; filename="${image.image_type}_${imageId}.dcm"`);

    // In production, stream the actual DICOM file
    // res.sendFile(image.dicom_path);
    res.json({
      message: 'DICOM file reference',
      path: image.dicom_path,
      imageType: image.image_type,
      note: 'In production, this endpoint streams the actual DICOM binary data',
    });
  } catch (err) {
    next(err);
  }
});

// ── Auto-calculate lens prescription ──
router.post('/prescription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId, age } = req.body;

    if (!examId) {
      res.status(400).json({ error: { message: 'examId is required' } });
      return;
    }

    const exam = await query('SELECT * FROM ophthal_exams WHERE id = $1', [examId]);
    if (exam.rows.length === 0) {
      res.status(404).json({ error: { message: 'Exam not found' } });
      return;
    }

    const e = exam.rows[0];
    if (e.refraction_sphere === null || e.refraction_cylinder === null || e.refraction_axis === null) {
      res.status(400).json({ error: { message: 'Exam does not have complete refraction data' } });
      return;
    }

    const refractionData: RefractionData = {
      sphere: parseFloat(e.refraction_sphere),
      cylinder: parseFloat(e.refraction_cylinder),
      axis: parseInt(e.refraction_axis),
      age: age || undefined,
    };

    const prescription = refractionCalculator.calculatePrescription(refractionData);

    // Store prescription
    const result = await query(
      `INSERT INTO ophthal_prescriptions (patient_id, exam_id, lens_type, sphere, cylinder, axis, add_power, pd, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [e.patient_id, examId, prescription.lens_type, prescription.sphere, prescription.cylinder, prescription.axis, prescription.add_power, prescription.pd, prescription.notes]
    );

    res.status(201).json({ data: result.rows[0], prescription });
  } catch (err) {
    next(err);
  }
});

// ── Get prescription for exam ──
router.get('/prescription/:examId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const result = await query(
      `SELECT p.*, e.exam_type, e.eye, e.visual_acuity 
       FROM ophthal_prescriptions p 
       JOIN ophthal_exams e ON e.id = p.exam_id 
       WHERE p.exam_id = $1`,
      [examId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'No prescription found for this exam' } });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Visual acuity history (trend) ──
router.get('/visual-acuity-history/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      `SELECT exam_type, eye, visual_acuity, examined_at 
       FROM ophthal_exams 
       WHERE patient_id = $1 AND visual_acuity IS NOT NULL 
       ORDER BY examined_at`,
      [patientId]
    );

    // Parse Snellen fractions for trend data
    const trends = result.rows.map((row) => {
      let decimalAcuity = null;
      if (row.visual_acuity) {
        const parts = row.visual_acuity.split('/');
        if (parts.length === 2) {
          decimalAcuity = parseInt(parts[0]) / parseInt(parts[1]);
        }
      }
      return {
        ...row,
        decimalAcuity,
        snellen: row.visual_acuity,
      };
    });

    res.json({ data: trends });
  } catch (err) {
    next(err);
  }
});

// ── IOP trend (glaucoma tracking) ──
router.get('/iop-trend/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      `SELECT eye, iop, examined_at, exam_type
       FROM ophthal_exams 
       WHERE patient_id = $1 AND iop IS NOT NULL 
       ORDER BY examined_at`,
      [patientId]
    );

    // Flag elevated readings
    const trends = result.rows.map((row) => ({
      ...row,
      iop: parseFloat(row.iop),
      alert: parseFloat(row.iop) > 21 ? 'elevated' : 'normal',
    }));

    // Calculate stats per eye
    const leftReadings = trends.filter((t) => t.eye === 'left' || t.eye === 'both');
    const rightReadings = trends.filter((t) => t.eye === 'right' || t.eye === 'both');

    const avgIOP = (readings: any[]) =>
      readings.length > 0 ? readings.reduce((s, r) => s + r.iop, 0) / readings.length : null;

    res.json({
      data: trends,
      stats: {
        left: { avg: avgIOP(leftReadings), count: leftReadings.length },
        right: { avg: avgIOP(rightReadings), count: rightReadings.length },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Refraction calculator (standalone) ──
router.post('/refraction/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sphere, cylinder, axis, age } = req.body;

    if (sphere === undefined || cylinder === undefined || axis === undefined) {
      res.status(400).json({ error: { message: 'sphere, cylinder, and axis are required' } });
      return;
    }

    const refractionData: RefractionData = { sphere, cylinder, axis, age };
    const prescription = refractionCalculator.calculatePrescription(refractionData);

    res.json({
      data: {
        input: refractionData,
        prescription,
        addPowerExplanation: age
          ? refractionCalculator.calculateAddPower(age) > 0
            ? `Presbyopia add of +${refractionCalculator.calculateAddPower(age).toFixed(2)}D recommended for age ${age}`
            : `No add power needed (age ${age} < 40)`
          : 'Age not provided — add power not calculated',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Patient ophthalmology summary ──
router.get('/patient/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [exams, imaging, prescriptions] = await Promise.all([
      query(
        `SELECT exam_type, eye, COUNT(*) as count, MAX(examined_at) as last_exam 
         FROM ophthal_exams WHERE patient_id = $1 GROUP BY exam_type, eye`,
        [id]
      ),
      query(
        `SELECT image_type, COUNT(*) as count FROM ophthal_imaging WHERE patient_id = $1 GROUP BY image_type`,
        [id]
      ),
      query(
        `SELECT COUNT(*) as total, MAX(prescribed_at) as last_prescribed 
         FROM ophthal_prescriptions WHERE patient_id = $1`,
        [id]
      ),
    ]);

    res.json({
      data: {
        patientId: id,
        examStats: exams.rows,
        imagingStats: imaging.rows,
        prescriptionStats: prescriptions.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

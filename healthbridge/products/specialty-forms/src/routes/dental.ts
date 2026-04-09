import { Router, Request, Response, NextFunction } from 'express';
import { query, transaction } from '../../database/connection';
import { dentalCodingService } from '../../services/dental-coding.service';
import { codingMapper } from '../../services/coding-mapper.service';
import { config } from '../../config';

const router = Router();

// ── Record dental chart entry ──
router.post('/chart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, toothNumber, surface, procedureCode, notes, performedBy } = req.body;

    if (!patientId || !toothNumber || !procedureCode) {
      res.status(400).json({ error: { message: 'patientId, toothNumber, and procedureCode are required' } });
      return;
    }

    // Map procedure code
    const mapped = dentalCodingService.mapToAda(procedureCode);
    const procedureDesc = mapped?.description || procedureCode;
    const cost = mapped?.cost || 0;

    // Map to NPHIES
    const nphiesMapping = await codingMapper.mapCode('dental', procedureCode);

    const result = await query(
      `INSERT INTO dental_charts (patient_id, tooth_number, surface, procedure_code, procedure_desc, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [patientId, toothNumber, surface || null, procedureCode, procedureDesc, notes || null, performedBy || 'system']
    );

    res.status(201).json({
      data: result.rows[0],
      mapping: mapped,
      nphiesMapping,
      estimatedCost: cost,
    });
  } catch (err) {
    next(err);
  }
});

// ── Get full dental chart for patient ──
router.get('/chart/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;

    const result = await query(
      `SELECT * FROM dental_charts WHERE patient_id = $1 ORDER BY tooth_number, performed_at`,
      [patientId]
    );

    // Build 32-tooth chart
    const teeth: Record<number, any> = {};
    for (let i = 1; i <= 32; i++) {
      teeth[i] = {
        number: i,
        surfaces: {
          mesial: { status: 'healthy' },
          distal: { status: 'healthy' },
          occlusal: { status: 'healthy' },
          buccal: { status: 'healthy' },
          lingual: { status: 'healthy' },
        },
        procedures: [],
      };
    }

    for (const row of result.rows) {
      const tooth = teeth[row.tooth_number];
      if (tooth) {
        tooth.procedures.push(row);
        const surfaceKey = row.surface?.toLowerCase();
        if (surfaceKey && tooth.surfaces[surfaceKey]) {
          tooth.surfaces[surfaceKey] = {
            status: 'treated',
            procedure_code: row.procedure_code,
          };
        }
      }
    }

    res.json({ data: Object.values(teeth), totalEntries: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// ── Create treatment plan ──
router.post('/treatment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId, chartEntries, totalCost } = req.body;

    if (!patientId || !chartEntries?.length) {
      res.status(400).json({ error: { message: 'patientId and chartEntries are required' } });
      return;
    }

    const treatments = await transaction(async (client) => {
      const created: any[] = [];

      for (const entry of chartEntries) {
        const mapped = dentalCodingService.mapToAda(entry.procedureCode);
        const cost = mapped?.cost || 0;
        const preauthRequired = dentalCodingService.requiresPreAuth(entry.procedureCode, cost);

        const result = await client.query(
          `INSERT INTO dental_treatments (patient_id, chart_id, procedure_code, procedure_desc, ada_code, cost, preauth_required)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [patientId, entry.chartId || null, entry.procedureCode, mapped?.description || '', mapped?.adaCode || '', cost, preauthRequired]
        );
        created.push(result.rows[0]);
      }

      return created;
    });

    const needsPreauth = treatments.some((t) => t.preauth_required);

    res.status(201).json({
      data: treatments,
      totalCost: totalCost || treatments.reduce((sum: number, t: any) => sum + parseFloat(t.cost), 0),
      preauthRequired: needsPreauth,
    });
  } catch (err) {
    next(err);
  }
});

// ── Update treatment status ──
router.put('/treatment/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['planned', 'in_progress', 'completed'].includes(status)) {
      res.status(400).json({ error: { message: 'Invalid status. Must be: planned, in_progress, completed' } });
      return;
    }

    const result = await query(
      'UPDATE dental_treatments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { message: 'Treatment not found' } });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Upload X-ray ──
router.post('/xray', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In production, use multer middleware for file upload
    const { patientId, toothNumber, imagePath, imageType } = req.body;

    if (!patientId || !imagePath) {
      res.status(400).json({ error: { message: 'patientId and imagePath are required' } });
      return;
    }

    const result = await query(
      `INSERT INTO dental_xrays (patient_id, tooth_number, image_path, image_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [patientId, toothNumber || null, imagePath, imageType || 'periapical']
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── List X-rays for patient ──
router.get('/xray/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { patientId } = req.params;
    const result = await query(
      'SELECT * FROM dental_xrays WHERE patient_id = $1 ORDER BY uploaded_at DESC',
      [patientId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ── Submit NPHIES pre-auth ──
router.post('/preauth/:treatmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { treatmentId } = req.params;

    const treatment = await query('SELECT * FROM dental_treatments WHERE id = $1', [treatmentId]);
    if (treatment.rows.length === 0) {
      res.status(404).json({ error: { message: 'Treatment not found' } });
      return;
    }

    const t = treatment.rows[0];

    // Build FHIR Claim resource for pre-authorization
    const fhirClaim = {
      resourceType: 'Claim',
      status: 'active',
      type: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional',
        }],
      },
      use: 'preauthorization',
      patient: {
        reference: `Patient/${t.patient_id}`,
      },
      created: new Date().toISOString(),
      provider: {
        reference: `Organization/${config.nphies.facilityId}`,
      },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: 'stat',
        }],
      },
      insurance: [{
        sequence: 1,
        focal: true,
        coverage: {
          reference: `Coverage/${t.patient_id}`,
        },
      }],
      item: [{
        sequence: 1,
        productOrService: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/dental-procedure',
            code: t.ada_code || t.procedure_code,
            display: t.procedure_desc,
          }],
        },
        unitPrice: {
          value: parseFloat(t.cost),
          currency: 'SAR',
        },
      }],
    };

    // In production, POST to NPHIES API
    // const response = await nphiesClient.submitClaim(fhirClaim);

    // Update treatment with preauth ID
    const preauthId = `PA-${Date.now()}`;
    await query(
      'UPDATE dental_treatments SET preauth_id = $1 WHERE id = $2',
      [preauthId, treatmentId]
    );

    res.json({
      data: {
        preauthId,
        fhirClaim,
        status: 'submitted',
        message: 'Pre-authorization submitted (simulated — integrate with NPHIES API in production)',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Search procedure codes ──
router.get('/procedures/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    if (q.length < 2) {
      res.status(400).json({ error: { message: 'Query must be at least 2 characters' } });
      return;
    }

    const results = dentalCodingService.searchProcedures(q);
    res.json({ data: results, total: results.length });
  } catch (err) {
    next(err);
  }
});

// ── Patient dental summary ──
router.get('/patient/:id/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [charts, treatments, xrays] = await Promise.all([
      query('SELECT COUNT(*) as total, COUNT(DISTINCT tooth_number) as teeth_treated FROM dental_charts WHERE patient_id = $1', [id]),
      query(`SELECT status, COUNT(*) as count, SUM(cost) as total_cost FROM dental_treatments WHERE patient_id = $1 GROUP BY status`, [id]),
      query('SELECT COUNT(*) as total FROM dental_xrays WHERE patient_id = $1', [id]),
    ]);

    res.json({
      data: {
        patientId: id,
        chartStats: charts.rows[0],
        treatmentStats: treatments.rows,
        xrayCount: parseInt(xrays.rows[0].total),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

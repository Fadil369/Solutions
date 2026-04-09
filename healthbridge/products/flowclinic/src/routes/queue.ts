import { Router, Request, Response, NextFunction } from 'express';
import { queueService } from '../services/queue.service';
import { query, queryOne } from '../database/connection';
import { z } from 'zod';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const router = Router();

// Validation schemas
const joinQueueSchema = z.object({
  patientId: z.string().uuid(),
  department: z.string().min(1),
  doctorId: z.string().optional(),
  priority: z.boolean().optional().default(false),
});

const callNextSchema = z.object({
  department: z.string().min(1),
});

const completeSchema = z.object({
  entryId: z.string().uuid(),
});

/**
 * POST /api/queue/join — Add patient to queue
 */
router.post('/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = joinQueueSchema.parse(req.body);

    // Verify patient exists
    const patient = await queryOne('SELECT id FROM patients WHERE id = $1', [body.patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check for existing waiting entry
    const existing = await queryOne(
      `SELECT id, queue_number FROM queue_entries
       WHERE patient_id = $1 AND status = 'waiting' AND DATE(created_at) = CURRENT_DATE`,
      [body.patientId]
    );
    if (existing) {
      return res.status(409).json({
        error: 'Patient already in queue',
        queueEntryId: existing.id,
        queueNumber: existing.queue_number,
      });
    }

    const entry = await queueService.joinQueue(
      body.patientId,
      body.department,
      body.doctorId,
      body.priority
    );

    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * GET /api/queue/current — Current queue status by department
 */
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const department = req.query.department as string | undefined;

    if (department) {
      const queue = await queueService.getQueueStatus(department);
      return res.json({ department, queue });
    }

    const allQueues = await queueService.getAllQueues();
    res.json(allQueues);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/queue/position/:entryId — Get specific queue position + wait estimate
 */
router.get('/position/:entryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const position = await queueService.getPosition(req.params.entryId);
    res.json(position);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/queue/call-next — Call next patient
 */
router.post('/call-next', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = callNextSchema.parse(req.body);
    const entry = await queueService.callNext(body.department);

    if (!entry) {
      return res.status(404).json({ error: 'No patients waiting in queue' });
    }

    res.json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/queue/complete — Mark patient as served
 */
router.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = completeSchema.parse(req.body);
    await queueService.completePatient(body.entryId);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * POST /api/queue/no-show — Mark patient as no-show
 */
router.post('/no-show', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = completeSchema.parse(req.body);
    await queueService.markNoShow(body.entryId);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    next(error);
  }
});

/**
 * GET /api/queue/stats — Wait times, throughput, no-show rate
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const department = req.query.department as string | undefined;
    const stats = await queueService.getStats(department);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;

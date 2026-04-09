import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query, queryOne, transaction } from '../database/connection';
import { emitQueueUpdated, emitPatientCalled, emitPatientCompleted } from '../realtime/socket';
import { WhatsAppService } from './whatsapp.service';
import type { QueueEntry, QueuePosition, QueueStats, QueueStatus } from '../types';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

const redis = new IORedis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export class QueueService {
  private whatsapp: WhatsAppService;

  constructor() {
    this.whatsapp = new WhatsAppService();
  }

  async connect(): Promise<void> {
    await redis.connect();
  }

  /**
   * Add patient to queue. Returns the queue entry with assigned number.
   */
  async joinQueue(
    patientId: string,
    department: string,
    doctorId?: string,
    priority: boolean = false
  ): Promise<QueueEntry> {
    // Get next queue number for this department today
    const counterKey = `queue:counter:${department}:${this.todayKey()}`;
    let queueNumber: number;

    if (priority) {
      // Priority patients get the next number but are sorted higher
      queueNumber = await redis.incr(counterKey);
    } else {
      queueNumber = await redis.incr(counterKey);
    }

    // Get avg visit duration for department
    const dept = await queryOne<{ avg_visit_duration_min: number }>(
      'SELECT avg_visit_duration_min FROM departments WHERE name_en = $1 OR name_ar = $1',
      [department]
    );
    const avgDuration = dept?.avg_visit_duration_min || config.DEFAULT_AVG_VISIT_DURATION;

    // Count current waiting patients in department
    const waitingCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM queue_entries
       WHERE department = $1 AND status = 'waiting' AND DATE(created_at) = CURRENT_DATE`,
      [department]
    );
    const position = parseInt(waitingCount?.count || '0') + 1;
    const estimatedWait = position * avgDuration;

    // Insert queue entry
    const entry = await queryOne<QueueEntry>(
      `INSERT INTO queue_entries (id, patient_id, queue_number, department, doctor_id, status, priority, estimated_wait_min)
       VALUES ($1, $2, $3, $4, $5, 'waiting', $6, $7)
       RETURNING *`,
      [uuidv4(), patientId, queueNumber, department, doctorId || null, priority, estimatedWait]
    );

    if (!entry) throw new Error('Failed to create queue entry');

    // Store in Redis sorted set for fast position lookup
    const queueKey = `queue:${department}:${this.todayKey()}`;
    const score = priority ? queueNumber - 1000 : queueNumber; // Priority sorts first
    await redis.zadd(queueKey, score, entry.id);
    await redis.hset(`queue:entry:${entry.id}`, {
      patientId,
      queueNumber: queueNumber.toString(),
      department,
      doctorId: doctorId || '',
      status: 'waiting',
      priority: priority.toString(),
      createdAt: new Date().toISOString(),
    });

    // Send WhatsApp confirmation
    try {
      const patient = await queryOne<any>('SELECT * FROM patients WHERE id = $1', [patientId]);
      if (patient) {
        await this.whatsapp.sendQueueConfirmation(patient, entry);
      }
    } catch (err) {
      logger.warn('Failed to send queue confirmation WhatsApp', { error: (err as Error).message });
    }

    // Emit real-time update
    await this.broadcastQueueUpdate(department);

    logger.info('Patient joined queue', {
      patientId,
      department,
      queueNumber,
      position,
      estimatedWait,
    });

    return entry;
  }

  /**
   * Call next patient in department queue.
   */
  async callNext(department: string): Promise<QueueEntry | null> {
    const queueKey = `queue:${department}:${this.todayKey()}`;

    // Get the lowest-score (next) entry from Redis
    const members = await redis.zrange(queueKey, 0, 0);
    if (!members.length) {
      logger.info('No patients in queue', { department });
      return null;
    }

    const entryId = members[0];

    // Check if still waiting
    const entryData = await redis.hgetall(`queue:entry:${entryId}`);
    if (!entryData || entryData.status !== 'waiting') {
      // Remove stale entry and try next
      await redis.zrem(queueKey, entryId);
      return this.callNext(department);
    }

    // Update status in PostgreSQL
    const updated = await queryOne<QueueEntry>(
      `UPDATE queue_entries SET status = 'in_progress', called_at = NOW()
       WHERE id = $1 AND status = 'waiting'
       RETURNING *`,
      [entryId]
    );

    if (!updated) {
      await redis.zrem(queueKey, entryId);
      return this.callNext(department);
    }

    // Update Redis
    await redis.hset(`queue:entry:${entryId}`, 'status', 'in_progress');
    await redis.hset(`queue:entry:${entryId}`, 'calledAt', new Date().toISOString());

    // Send WhatsApp notification
    try {
      const patient = await queryOne<any>('SELECT * FROM patients WHERE id = $1', [entryData.patientId]);
      if (patient) {
        await this.whatsapp.sendReadyNotification(patient, department);
      }
    } catch (err) {
      logger.warn('Failed to send ready notification', { error: (err as Error).message });
    }

    // Emit real-time event
    emitPatientCalled(updated, department);

    // Get updated queue for broadcast
    await this.broadcastQueueUpdate(department);

    logger.info('Patient called', { entryId, department, queueNumber: updated.queue_number });

    return updated;
  }

  /**
   * Get a patient's position in queue.
   */
  async getPosition(entryId: string): Promise<QueuePosition> {
    // Get entry data
    const entry = await queryOne<QueueEntry>('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
    if (!entry) throw new Error('Queue entry not found');

    if (entry.status !== 'waiting') {
      return { position: 0, estimatedWait: 0 };
    }

    const queueKey = `queue:${entry.department}:${this.todayKey()}`;

    // Get rank in sorted set (0-indexed)
    const rank = await redis.zrank(queueKey, entryId);
    const position = rank !== null ? rank + 1 : 0;

    // Get currently serving
    const servingEntry = await queryOne<QueueEntry>(
      `SELECT queue_number FROM queue_entries
       WHERE department = $1 AND status = 'in_progress' AND DATE(created_at) = CURRENT_DATE
       ORDER BY called_at DESC LIMIT 1`,
      [entry.department]
    );

    return {
      position,
      estimatedWait: entry.estimated_wait_min,
      currentServing: servingEntry?.queue_number,
    };
  }

  /**
   * Mark patient as completed (served).
   */
  async completePatient(entryId: string): Promise<void> {
    const entry = await queryOne<QueueEntry>('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
    if (!entry) throw new Error('Queue entry not found');

    await query(
      `UPDATE queue_entries SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [entryId]
    );

    // Remove from Redis queue
    const queueKey = `queue:${entry.department}:${this.todayKey()}`;
    await redis.zrem(queueKey, entryId);
    await redis.del(`queue:entry:${entryId}`);

    // Update patient last_visit
    await query('UPDATE patients SET last_visit = NOW() WHERE id = $1', [entry.patient_id]);

    // Emit real-time event
    emitPatientCompleted(entry, entry.department);
    await this.broadcastQueueUpdate(entry.department);

    logger.info('Patient completed', { entryId, department: entry.department });
  }

  /**
   * Mark patient as no-show.
   */
  async markNoShow(entryId: string): Promise<void> {
    const entry = await queryOne<QueueEntry>('SELECT * FROM queue_entries WHERE id = $1', [entryId]);
    if (!entry) throw new Error('Queue entry not found');

    await query(
      `UPDATE queue_entries SET status = 'no_show', completed_at = NOW() WHERE id = $1`,
      [entryId]
    );

    // Remove from Redis queue
    const queueKey = `queue:${entry.department}:${this.todayKey()}`;
    await redis.zrem(queueKey, entryId);
    await redis.del(`queue:entry:${entryId}`);

    await this.broadcastQueueUpdate(entry.department);

    logger.info('Patient marked as no-show', { entryId, department: entry.department });
  }

  /**
   * Get full queue status for a department.
   */
  async getQueueStatus(department: string): Promise<QueueEntry[]> {
    const entries = await query<QueueEntry>(
      `SELECT q.*, p.name_ar, p.name_en, p.phone, p.preferred_language
       FROM queue_entries q
       JOIN patients p ON p.id = q.patient_id
       WHERE q.department = $1 AND q.status IN ('waiting', 'in_progress')
         AND DATE(q.created_at) = CURRENT_DATE
       ORDER BY
         q.priority DESC,
         CASE q.status WHEN 'in_progress' THEN 0 ELSE 1 END,
         q.queue_number ASC`,
      [department]
    );
    return entries;
  }

  /**
   * Get all department queues for today.
   */
  async getAllQueues(): Promise<Record<string, QueueEntry[]>> {
    const entries = await query<QueueEntry & { patient_name_ar: string; patient_name_en: string }>(
      `SELECT q.*, p.name_ar as patient_name_ar, p.name_en as patient_name_en
       FROM queue_entries q
       JOIN patients p ON p.id = q.patient_id
       WHERE q.status IN ('waiting', 'in_progress')
         AND DATE(q.created_at) = CURRENT_DATE
       ORDER BY q.department, q.priority DESC, q.queue_number ASC`
    );

    const byDept: Record<string, QueueEntry[]> = {};
    for (const entry of entries) {
      if (!byDept[entry.department]) byDept[entry.department] = [];
      byDept[entry.department].push(entry);
    }
    return byDept;
  }

  /**
   * Calculate estimated wait time for a department.
   */
  async calculateWaitTime(department: string, position: number): Promise<number> {
    const dept = await queryOne<{ avg_visit_duration_min: number }>(
      'SELECT avg_visit_duration_min FROM departments WHERE name_en = $1 OR name_ar = $1',
      [department]
    );
    return position * (dept?.avg_visit_duration_min || config.DEFAULT_AVG_VISIT_DURATION);
  }

  /**
   * Get queue statistics for today.
   */
  async getStats(department?: string): Promise<QueueStats> {
    const deptFilter = department
      ? `AND department = '${department}'`
      : '';
    const result = await queryOne<any>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'waiting') as total_waiting,
         COUNT(*) FILTER (WHERE status = 'completed') as total_served_today,
         COUNT(*) FILTER (WHERE status = 'no_show') as total_no_show_today,
         COALESCE(AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60)
           FILTER (WHERE called_at IS NOT NULL), 0) as avg_wait_min,
         COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - called_at)) / 60)
           FILTER (WHERE completed_at IS NOT NULL AND called_at IS NOT NULL), 0) as avg_service_min
       FROM queue_entries
       WHERE DATE(created_at) = CURRENT_DATE ${deptFilter}`
    );

    const total = parseInt(result?.total_served_today || '0') + parseInt(result?.total_no_show_today || '0');
    const noShowRate = total > 0 ? parseInt(result?.total_no_show_today || '0') / total : 0;

    return {
      total_waiting: parseInt(result?.total_waiting || '0'),
      total_served_today: parseInt(result?.total_served_today || '0'),
      total_no_show_today: parseInt(result?.total_no_show_today || '0'),
      avg_wait_min: Math.round(parseFloat(result?.avg_wait_min || '0')),
      avg_service_min: Math.round(parseFloat(result?.avg_service_min || '0')),
      no_show_rate: Math.round(noShowRate * 100) / 100,
    };
  }

  /**
   * Broadcast queue update to department room.
   */
  private async broadcastQueueUpdate(department: string): Promise<void> {
    const queue = await this.getQueueStatus(department);
    emitQueueUpdated(department, queue);
  }

  private todayKey(): string {
    return new Date().toISOString().split('T')[0];
  }
}

export const queueService = new QueueService();

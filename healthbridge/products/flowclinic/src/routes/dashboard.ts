import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../database/connection';
import { queueService } from '../services/queue.service';
import type { DashboardOverview, DepartmentQueueStatus, DoctorLoad, WaitTimeEstimate } from '../types';

const router = Router();

/**
 * GET /api/dashboard/overview — Today's stats
 */
router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Patients seen today
    const patientsSeen = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM queue_entries
       WHERE status IN ('completed', 'no_show') AND DATE(created_at) = CURRENT_DATE`
    );

    // Patients waiting
    const patientsWaiting = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM queue_entries
       WHERE status = 'waiting' AND DATE(created_at) = CURRENT_DATE`
    );

    // Average wait time today
    const avgWait = await queryOne<{ avg: string }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60) as avg
       FROM queue_entries
       WHERE called_at IS NOT NULL AND DATE(created_at) = CURRENT_DATE`
    );

    // Revenue today
    const revenue = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM billing_records
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // No-show rate
    const noShowStats = await queryOne<{ total: string; no_shows: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'no_show') as no_shows
       FROM queue_entries
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Busiest department
    const busiestDept = await queryOne<{ department: string; count: string }>(
      `SELECT department, COUNT(*) as count
       FROM queue_entries
       WHERE DATE(created_at) = CURRENT_DATE
       GROUP BY department
       ORDER BY count DESC
       LIMIT 1`
    );

    const total = parseInt(noShowStats?.total || '0');
    const noShows = parseInt(noShowStats?.no_shows || '0');

    const overview: DashboardOverview = {
      patients_seen_today: parseInt(patientsSeen?.count || '0'),
      patients_waiting: parseInt(patientsWaiting?.count || '0'),
      avg_wait_min: Math.round(parseFloat(avgWait?.avg || '0')),
      revenue_today: parseFloat(revenue?.total || '0'),
      no_show_rate: total > 0 ? Math.round((noShows / total) * 100) / 100 : 0,
      busiest_department: busiestDept?.department || '—',
    };

    res.json(overview);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/queue-status — Live queue by department (for wall display)
 */
router.get('/queue-status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await query(
      `SELECT d.name_en as department, d.name_ar as department_ar,
        (SELECT COUNT(*) FROM queue_entries q
         WHERE q.department = d.name_en AND q.status = 'waiting'
         AND DATE(q.created_at) = CURRENT_DATE) as waiting,
        (SELECT queue_number FROM queue_entries q
         WHERE q.department = d.name_en AND q.status = 'in_progress'
         AND DATE(q.created_at) = CURRENT_DATE
         ORDER BY q.called_at DESC LIMIT 1) as current_serving,
        (SELECT AVG(EXTRACT(EPOCH FROM (q.called_at - q.created_at)) / 60)
         FROM queue_entries q
         WHERE q.department = d.name_en AND q.called_at IS NOT NULL
         AND DATE(q.created_at) = CURRENT_DATE) as avg_wait_min
       FROM departments d
       WHERE d.queue_enabled = true
       ORDER BY d.name_en`
    );

    const statuses: DepartmentQueueStatus[] = departments.map(d => ({
      department: d.department,
      department_ar: d.department_ar,
      waiting: parseInt(d.waiting || '0'),
      current_serving: d.current_serving ? parseInt(d.current_serving) : undefined,
      avg_wait_min: Math.round(parseFloat(d.avg_wait_min || '0')),
    }));

    res.json(statuses);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/doctor-load — Doctor utilization
 */
router.get('/doctor-load', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const doctors = await query(
      `SELECT d.id as doctor_id, d.name_en as doctor_name, d.department, d.status,
        (SELECT COUNT(*) FROM visits v
         WHERE v.doctor_id = d.id AND DATE(v.created_at) = CURRENT_DATE) as patients_today,
        (SELECT COUNT(*) FROM visits v
         WHERE v.doctor_id = d.id AND v.created_at > NOW() - INTERVAL '1 hour') as patients_last_hour
       FROM doctors d
       WHERE d.status != 'off'
       ORDER BY d.department, d.name_en`
    );

    const loads: DoctorLoad[] = doctors.map(d => ({
      doctor_id: d.doctor_id,
      doctor_name: d.doctor_name,
      department: d.department,
      patients_today: parseInt(d.patients_today || '0'),
      patients_per_hour: parseInt(d.patients_last_hour || '0'),
      status: d.status,
    }));

    res.json(loads);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/wait-times — Real-time wait time estimates by department
 */
router.get('/wait-times', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const waitTimes = await query(
      `SELECT d.name_en as department, d.name_ar as department_ar,
        d.avg_visit_duration_min,
        (SELECT COUNT(*) FROM queue_entries q
         WHERE q.department = d.name_en AND q.status = 'waiting'
         AND DATE(q.created_at) = CURRENT_DATE) as waiting_count
       FROM departments d
       WHERE d.queue_enabled = true
       ORDER BY d.name_en`
    );

    const estimates: WaitTimeEstimate[] = waitTimes.map(w => ({
      department: w.department,
      department_ar: w.department_ar,
      waiting_count: parseInt(w.waiting_count || '0'),
      estimated_wait_min: parseInt(w.waiting_count || '0') * w.avg_visit_duration_min,
    }));

    res.json(estimates);
  } catch (error) {
    next(error);
  }
});

export default router;

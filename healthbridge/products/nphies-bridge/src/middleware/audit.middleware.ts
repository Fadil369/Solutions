import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export function auditMiddleware(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const auditEntry = {
      entity_type: req.path.split('/')[2] || 'unknown',
      action: `${req.method} ${req.path}`,
      user_id: req.user?.id,
      user_role: req.user?.role,
      ip_address: req.ip,
      changes: req.body,
    };

    // Fire and forget — don't block the request
    query(
      `INSERT INTO audit_trail (entity_type, action, user_id, user_role, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [auditEntry.entity_type, auditEntry.action, auditEntry.user_id, auditEntry.user_role, auditEntry.ip_address, JSON.stringify(auditEntry.changes)]
    ).catch(err => {
      logger.error('Failed to write audit trail', { error: err.message });
    });
  }

  next();
}

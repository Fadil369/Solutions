import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip } = req;

  // Log after response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method,
      path,
      statusCode: res.statusCode,
      duration,
      ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('Audit: Request failed', logData);
    } else {
      logger.info('Audit: Request completed', logData);
    }
  });

  next();
}

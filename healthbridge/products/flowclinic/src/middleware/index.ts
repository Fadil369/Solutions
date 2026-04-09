import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../database/connection';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Auth middleware — validates JWT Bearer token.
 * In development mode, bypasses auth for convenience.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development
  if (config.NODE_ENV === 'development') {
    (req as any).user = { sub: 'dev-user', role: 'admin' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Audit logging middleware — logs all API requests to sms_logs (repurposed as audit).
 */
export function auditMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as any).user;
  const userId = user?.sub || 'anonymous';

  logger.info('API Request', {
    method: req.method,
    path: req.path,
    userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  next();
}

/**
 * Error handling middleware.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'Validation error',
      details: (err as any).issues,
    });
    return;
  }

  // PostgreSQL errors
  if ((err as any).code === '23505') {
    res.status(409).json({ error: 'Duplicate entry' });
    return;
  }

  if ((err as any).code === '23503') {
    res.status(400).json({ error: 'Referenced record not found' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : undefined,
  });
}

/**
 * Request logging middleware.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health') {
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });

  next();
}

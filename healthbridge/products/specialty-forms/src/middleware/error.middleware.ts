import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error('Request error', {
    statusCode,
    message,
    path: req.path,
    method: req.method,
    details: err.details,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const err: AppError = new Error(`Route not found: ${req.method} ${req.path}`);
  err.statusCode = 404;
  next(err);
}

import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    facilityId: string;
  };
}

/**
 * Simple auth middleware — in production this validates JWT from NPHIES/OAuth.
 * For development, accepts a mock header.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // Allow unauthenticated in dev mode for testing
    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev-user', role: 'doctor', facilityId: 'dev-facility' };
      return next();
    }
    res.status(401).json({ error: { message: 'Authorization header required', statusCode: 401 } });
    return;
  }

  // In production: validate JWT token
  // For now, extract mock user from header
  try {
    const token = authHeader.replace('Bearer ', '');
    // TODO: Replace with real JWT validation
    req.user = { id: token, role: 'doctor', facilityId: 'default' };
    next();
  } catch {
    res.status(401).json({ error: { message: 'Invalid token', statusCode: 401 } });
  }
}

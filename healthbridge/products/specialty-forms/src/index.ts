import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './config/logger';
import { auditMiddleware } from './middleware/audit.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

import dentalRoutes from './routes/dental';
import dermaRoutes from './routes/derma';
import ophthalRoutes from './routes/ophthalmology';
import sharedRoutes from './routes/shared';

const app = express();

// ── Global Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(auditMiddleware);

// ── Health Check ──
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: '@healthbridge/specialty-forms',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
app.use('/api/dental', authMiddleware, dentalRoutes);
app.use('/api/derma', authMiddleware, dermaRoutes);
app.use('/api/ophthalmology', authMiddleware, ophthalRoutes);
app.use('/api/shared', authMiddleware, sharedRoutes);

// ── Static files (frontend) ──
app.use('/frontend', express.static('frontend'));

// ── Error Handling ──
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ──
const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`🏥 Specialty Smart-Forms server running on port ${PORT}`);
  logger.info(`   Dental:        http://localhost:${PORT}/api/dental`);
  logger.info(`   Dermatology:   http://localhost:${PORT}/api/derma`);
  logger.info(`   Ophthalmology: http://localhost:${PORT}/api/ophthalmology`);
  logger.info(`   Shared:        http://localhost:${PORT}/api/shared`);
  logger.info(`   Frontend:      http://localhost:${PORT}/frontend/`);
  logger.info(`   Environment:   ${config.nodeEnv}`);
});

export default app;

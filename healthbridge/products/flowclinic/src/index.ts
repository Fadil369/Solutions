import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { healthCheck } from './database/connection';
import { runMigrations } from './database/migrate';
import { initSocket } from './realtime/socket';
import { queueService } from './services/queue.service';
import { errorHandler, requestLogger, auditMiddleware } from './middleware';

// Routes
import queueRoutes from './routes/queue';
import kioskRoutes from './routes/kiosk';
import soapRoutes from './routes/soap';
import billingRoutes from './routes/billing';
import dashboardRoutes from './routes/dashboard';

import winston from 'winston';

const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

async function main() {
  logger.info('🏥 FlowClinic Express starting...', {
    port: config.PORT,
    env: config.NODE_ENV,
  });

  // Run database migrations
  try {
    await runMigrations();
  } catch (error) {
    logger.error('Migration failed — continuing (DB may not be available yet)', {
      error: (error as Error).message,
    });
  }

  // Connect to Redis queue engine
  try {
    await queueService.connect();
    logger.info('Redis queue engine connected');
  } catch (error) {
    logger.warn('Redis not available — queue will use DB-only mode', {
      error: (error as Error).message,
    });
  }

  // Express app
  const app = express();
  const server = createServer(app);

  // Socket.IO for real-time updates
  initSocket(server);

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Serve kiosk static files
  app.use('/kiosk', express.static(path.join(process.cwd(), config.KIOSK_STATIC_DIR)));

  // Health check
  app.get('/health', async (_req, res) => {
    const dbOk = await healthCheck();
    res.json({
      status: dbOk ? 'healthy' : 'degraded',
      service: '@healthbridge/flowclinic',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'unavailable',
      },
    });
  });

  // API Routes
  app.use('/api/queue', queueRoutes);
  app.use('/api/kiosk', kioskRoutes);
  app.use('/api/soap', soapRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // API info
  app.get('/api', (_req, res) => {
    res.json({
      service: 'FlowClinic Express',
      version: '1.0.0',
      description: 'Patient flow optimizer for high-volume polyclinics',
      endpoints: {
        queue: '/api/queue',
        kiosk: '/api/kiosk',
        soap: '/api/soap',
        billing: '/api/billing',
        dashboard: '/api/dashboard',
        kiosk_ui: '/kiosk',
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  // Start server
  server.listen(config.PORT, () => {
    logger.info(`🚀 FlowClinic Express running on port ${config.PORT}`);
    logger.info(`   API: http://localhost:${config.PORT}/api`);
    logger.info(`   Kiosk: http://localhost:${config.PORT}/kiosk`);
    logger.info(`   Dashboard: http://localhost:${config.PORT}/api/dashboard/overview`);
    logger.info(`   Health: http://localhost:${config.PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error: error.message, stack: error.stack });
  process.exit(1);
});

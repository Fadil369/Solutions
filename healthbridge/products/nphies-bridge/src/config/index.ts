import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL
  dbHost: z.string().default('localhost'),
  dbPort: z.number().default(5432),
  dbName: z.string().default('nphies_bridge'),
  dbUser: z.string().default('postgres'),
  dbPassword: z.string().default('postgres'),

  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),

  // RabbitMQ
  rabbitmqUrl: z.string().default('amqp://localhost:5672'),

  // NPHIES
  nphiesBaseUrl: z.string().default('https://sandbox.nphies.sa'),
  nphiesClientId: z.string().default(''),
  nphiesClientSecret: z.string().default(''),
  nphiesFacilityId: z.string().default(''),
  nphiesSandbox: z.boolean().default(true),

  // ZATCA
  zatcaBaseUrl: z.string().default('https://sandbox.zatca.gov.sa'),
  zatcaVatNumber: z.string().default(''),
  zatcaCertPath: z.string().default(''),
  zatcaKeyPath: z.string().default(''),

  // Auth
  jwtSecret: z.string().default('change-me-in-production'),

  // Logging
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

function loadConfig() {
  const raw = {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: (process.env.NODE_ENV || 'development') as any,
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || '5432'),
    dbName: process.env.DB_NAME || 'nphies_bridge',
    dbUser: process.env.DB_USER || 'postgres',
    dbPassword: process.env.DB_PASSWORD || 'postgres',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    nphiesBaseUrl: process.env.NPHIES_BASE_URL || 'https://sandbox.nphies.sa',
    nphiesClientId: process.env.NPHIES_CLIENT_ID || '',
    nphiesClientSecret: process.env.NPHIES_CLIENT_SECRET || '',
    nphiesFacilityId: process.env.NPHIES_FACILITY_ID || '',
    nphiesSandbox: process.env.NPHIES_SANDBOX !== 'false',
    zatcaBaseUrl: process.env.ZATCA_BASE_URL || 'https://sandbox.zatca.gov.sa',
    zatcaVatNumber: process.env.ZATCA_VAT_NUMBER || '',
    zatcaCertPath: process.env.ZATCA_CERT_PATH || '',
    zatcaKeyPath: process.env.ZATCA_KEY_PATH || '',
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    logLevel: (process.env.LOG_LEVEL || 'info') as any,
  };

  return configSchema.parse(raw);
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

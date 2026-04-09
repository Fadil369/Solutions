import winston from 'winston';
import { config } from '../config';

// Redact PHI from logs
const redactPhi = winston.format((info) => {
  const redacted = { ...info };
  if (typeof redacted.message === 'string') {
    redacted.message = redacted.message
      .replace(/\b\d{10}\b/g, '[NATIONAL_ID_REDACTED]')
      .replace(/\b[A-Z0-9]{10}\b/g, '[INSURANCE_ID_REDACTED]');
  }
  return redacted;
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    redactPhi(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'nphies-bridge' },
  transports: [
    new winston.transports.Console(),
    ...(config.nodeEnv === 'production'
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10485760, maxFiles: 5 }),
          new winston.transports.File({ filename: 'logs/combined.log', maxsize: 10485760, maxFiles: 5 }),
        ]
      : []),
  ],
});

export default logger;

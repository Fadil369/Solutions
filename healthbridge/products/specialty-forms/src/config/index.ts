export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'specialty_forms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'change-me-in-production-32bytes!!',
    algorithm: 'aes-256-gcm',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    uploadDir: process.env.UPLOAD_DIR || '/var/data/specialty-forms/uploads',
    xraysDir: process.env.XRAYS_DIR || '/var/data/specialty-forms/xrays',
    dermaPhotosDir: process.env.DERMA_PHOTOS_DIR || '/var/data/specialty-forms/derma-photos',
    dicomDir: process.env.DICOM_DIR || '/var/data/specialty-forms/dicom',
  },

  nphies: {
    baseUrl: process.env.NPHIES_BASE_URL || 'https://api.nphies.sa',
    facilityId: process.env.NPHIES_FACILITY_ID || '',
    clientId: process.env.NPHIES_CLIENT_ID || '',
    clientSecret: process.env.NPHIES_CLIENT_SECRET || '',
  },

  coding: {
    preAuthCostThreshold: parseFloat(process.env.PREAUTH_COST_THRESHOLD || '1000'),
  },
};

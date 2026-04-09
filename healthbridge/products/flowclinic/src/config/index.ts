import { z } from 'zod';

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3200),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('flowclinic'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_MAX_CONNECTIONS: z.coerce.number().default(20),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // Twilio (WhatsApp)
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_WHATSAPP_FROM: z.string().default('whatsapp:+14155238886'),

  // JWT
  JWT_SECRET: z.string().default('flowclinic-dev-secret-change-in-production'),

  // Google Cloud STT (optional)
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Kiosk
  KIOSK_STATIC_DIR: z.string().default('./kiosk'),

  // Clinic defaults
  DEFAULT_AVG_VISIT_DURATION: z.coerce.number().default(15), // minutes
  CLINIC_NAME_EN: z.string().default('FlowClinic PolyClinic'),
  CLINIC_NAME_AR: z.string().default('بوليكlinik فلوكلينيك'),

  // NPHIES (billing integration)
  NPHIES_API_URL: z.string().optional(),
  NPHIES_FACILITY_ID: z.string().optional(),
  NPHIES_CLIENT_ID: z.string().optional(),
  NPHIES_CLIENT_SECRET: z.string().optional(),

  // ZATCA
  ZATCA_CERT_PATH: z.string().optional(),
  ZATCA_PRIVATE_KEY_PATH: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export const SUPPORTED_LANGUAGES = ['ar', 'en', 'ur', 'tl', 'bn', 'hi'] as const;

export const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'العربية',
  en: 'English',
  ur: 'اردو',
  tl: 'Tagalog',
  bn: 'বাংলা',
  hi: 'हिन्दी',
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  ar: '🇸🇦',
  en: '🇬🇧',
  ur: '🇵🇰',
  tl: '🇵🇭',
  bn: '🇧🇩',
  hi: '🇮🇳',
};

export const DEFAULT_DEPARTMENTS = [
  { name_ar: 'الطب العام', name_en: 'General Medicine', avg_visit_duration_min: 12 },
  { name_ar: 'الأسنان', name_en: 'Dental', avg_visit_duration_min: 20 },
  { name_ar: 'العيون', name_en: 'Ophthalmology', avg_visit_duration_min: 15 },
  { name_ar: 'الجلدية', name_en: 'Dermatology', avg_visit_duration_min: 10 },
  { name_ar: 'النساء والتوليد', name_en: 'OB/GYN', avg_visit_duration_min: 18 },
  { name_ar: 'الأطفال', name_en: 'Pediatrics', avg_visit_duration_min: 12 },
  { name_ar: 'العظام', name_en: 'Orthopedics', avg_visit_duration_min: 15 },
  { name_ar: 'المختبر', name_en: 'Laboratory', avg_visit_duration_min: 8 },
  { name_ar: 'الأشعة', name_en: 'Radiology', avg_visit_duration_min: 10 },
];

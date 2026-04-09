-- NPHIES Bridge Database Schema
-- Version: 1.0.0

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'billing_staff' CHECK (role IN ('admin', 'billing_staff', 'clinician', 'viewer')),
  facility_id VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  national_id VARCHAR(20) UNIQUE,
  name_ar VARCHAR(255),
  name_en VARCHAR(255),
  dob DATE,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  phone VARCHAR(20),
  insurance_id VARCHAR(100),
  payer_id VARCHAR(100),
  payer_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_insurance_id ON patients(insurance_id);

-- Eligibility Checks
CREATE TABLE IF NOT EXISTS eligibility_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  status VARCHAR(50) NOT NULL,
  coverage_type VARCHAR(100),
  copay_amount DECIMAL(10,2),
  valid_until DATE,
  plan_name VARCHAR(255),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response JSONB,
  response_time_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_elig_patient ON eligibility_checks(patient_id);
CREATE INDEX IF NOT EXISTS idx_elig_checked ON eligibility_checks(checked_at DESC);

-- Claims
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id),
  encounter_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'paid', 'cancelled')),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  icd_codes TEXT[] DEFAULT '{}',
  service_date DATE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  adjudicated_at TIMESTAMP WITH TIME ZONE,
  nphies_claim_id VARCHAR(100),
  nphies_response JSONB,
  rejection_reason TEXT,
  rejection_codes TEXT[] DEFAULT '{}',
  zatca_invoice_id VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_service_date ON claims(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_claims_nphies ON claims(nphies_claim_id);

-- Claim Items
CREATE TABLE IF NOT EXISTS claim_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  code_system VARCHAR(100),
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items(claim_id);

-- Rejection Log
CREATE TABLE IF NOT EXISTS rejection_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id),
  rejection_code VARCHAR(20) NOT NULL,
  rejection_desc TEXT,
  category VARCHAR(100),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rejections_claim ON rejection_log(claim_id);
CREATE INDEX IF NOT EXISTS idx_rejections_code ON rejection_log(rejection_code);

-- Legacy Adapters
CREATE TABLE IF NOT EXISTS legacy_adapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_name VARCHAR(255) NOT NULL,
  pms_type VARCHAR(50) NOT NULL,
  adapter_config JSONB NOT NULL DEFAULT '{}',
  connection_status VARCHAR(20) DEFAULT 'pending',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  action VARCHAR(50) NOT NULL,
  user_id UUID,
  user_role VARCHAR(50),
  ip_address INET,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_trail(created_at DESC);

-- NPHIES Credentials (encrypted)
CREATE TABLE IF NOT EXISTS nphies_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id VARCHAR(100) UNIQUE NOT NULL,
  client_id_enc TEXT NOT NULL,
  client_secret_enc TEXT NOT NULL,
  sandbox BOOLEAN DEFAULT true,
  token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CCHI Rejection Codes Reference
CREATE TABLE IF NOT EXISTS cchi_rejection_codes (
  code VARCHAR(20) PRIMARY KEY,
  description TEXT NOT NULL,
  category VARCHAR(100),
  resolution_hint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed CCHI rejection codes
INSERT INTO cchi_rejection_codes (code, description, category, resolution_hint) VALUES
  ('E001', 'Patient eligibility not found or expired', 'Eligibility', 'Verify patient insurance ID and coverage dates'),
  ('E002', 'Service not covered under patient plan', 'Coverage', 'Check plan benefits and covered services'),
  ('E003', 'Duplicate claim submission', 'Duplicate', 'Search for existing claim with same service date'),
  ('E004', 'Missing or invalid referral number', 'Authorization', 'Obtain valid referral from primary provider'),
  ('E005', 'Prior authorization required', 'Authorization', 'Submit pre-authorization request before claim'),
  ('E006', 'Invalid ICD-10 diagnosis code', 'Coding', 'Verify diagnosis code format and validity'),
  ('E007', 'Mismatched procedure and diagnosis codes', 'Coding', 'Ensure procedure is clinically appropriate for diagnosis'),
  ('E008', 'Missing provider license number', 'Provider', 'Add facility/provider license to claim'),
  ('E009', 'Service date outside claim period', 'Date', 'Submit within payer''s claim filing deadline'),
  ('E010', 'Patient ID does not match payer records', 'Eligibility', 'Re-verify patient national ID and insurance card'),
  ('E011', 'Exceeded benefit limit for service', 'Coverage', 'Check annual/lifetime benefit maximums'),
  ('E012', 'Provider not contracted with payer', 'Provider', 'Verify provider network status with payer'),
  ('E013', 'Missing ZATCA tax registration', 'Billing', 'Ensure VAT number is registered and active'),
  ('E014', 'Incomplete claim information', 'Completeness', 'Review all required fields in claim submission'),
  ('E015', 'Service rendered by unauthorized provider', 'Provider', 'Ensure rendering provider has valid credentials'),
  ('E016', 'Claim amount exceeds fee schedule', 'Amount', 'Adjust to payer''s allowed amount or appeal'),
  ('E017', 'Missing clinical documentation', 'Documentation', 'Attach required clinical notes and reports'),
  ('E018', 'Coordination of benefits required', 'COB', 'Submit primary payer EOB with secondary claim'),
  ('E019', 'Invalid facility NPHIES ID', 'Facility', 'Verify facility registration in NPHIES'),
  ('E020', 'Claim submitted to wrong payer', 'Routing', 'Verify correct payer ID for patient''s plan')
ON CONFLICT (code) DO NOTHING;

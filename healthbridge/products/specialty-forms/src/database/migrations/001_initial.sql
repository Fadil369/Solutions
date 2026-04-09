-- Specialty Smart-Forms: Initial Schema Migration
-- Created: 2026-04-09

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Patients ──
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  national_id VARCHAR(20) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  dob DATE NOT NULL,
  phone VARCHAR(20),
  insurance_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patients_national_id ON patients(national_id);
CREATE INDEX idx_patients_insurance_id ON patients(insurance_id);

-- ── Visits ──
CREATE TYPE visit_specialty AS ENUM ('dental', 'derma', 'ophthalmology');
CREATE TYPE visit_status AS ENUM ('in_progress', 'completed', 'billed');

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  specialty visit_specialty NOT NULL,
  doctor_id VARCHAR(100) NOT NULL,
  status visit_status DEFAULT 'in_progress',
  chief_complaint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_specialty ON visits(specialty);
CREATE INDEX idx_visits_status ON visits(status);

-- ── Dental ──
CREATE TABLE IF NOT EXISTS dental_charts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  tooth_number INT NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  surface VARCHAR(10),
  procedure_code VARCHAR(20) NOT NULL,
  procedure_desc VARCHAR(500),
  notes TEXT,
  performed_by VARCHAR(100) NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  nphies_preauth_id VARCHAR(100)
);

CREATE INDEX idx_dental_charts_patient ON dental_charts(patient_id);
CREATE INDEX idx_dental_charts_tooth ON dental_charts(tooth_number);

CREATE TYPE dental_treatment_status AS ENUM ('planned', 'in_progress', 'completed');

CREATE TABLE IF NOT EXISTS dental_treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  chart_id UUID REFERENCES dental_charts(id),
  procedure_code VARCHAR(20) NOT NULL,
  procedure_desc VARCHAR(500),
  ada_code VARCHAR(20),
  cost DECIMAL(10,2) DEFAULT 0,
  status dental_treatment_status DEFAULT 'planned',
  preauth_required BOOLEAN DEFAULT FALSE,
  preauth_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dental_treatments_patient ON dental_treatments(patient_id);
CREATE INDEX idx_dental_treatments_status ON dental_treatments(status);

CREATE TABLE IF NOT EXISTS dental_xrays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  tooth_number INT CHECK (tooth_number BETWEEN 1 AND 32),
  image_path VARCHAR(500) NOT NULL,
  image_type VARCHAR(50) DEFAULT 'periapical',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dental_xrays_patient ON dental_xrays(patient_id);

-- ── Dermatology ──
CREATE TABLE IF NOT EXISTS derma_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  body_region VARCHAR(50) NOT NULL,
  lesion_type VARCHAR(100),
  size_mm DECIMAL(8,2),
  color VARCHAR(50),
  border_regularity VARCHAR(20),
  notes TEXT,
  assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assessed_by VARCHAR(100) NOT NULL
);

CREATE INDEX idx_derma_assessments_patient ON derma_assessments(patient_id);
CREATE INDEX idx_derma_assessments_region ON derma_assessments(body_region);

CREATE TYPE derma_photo_type AS ENUM ('lesion', 'body_map', 'before', 'after');

CREATE TABLE IF NOT EXISTS derma_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  assessment_id UUID NOT NULL REFERENCES derma_assessments(id),
  photo_type derma_photo_type DEFAULT 'lesion',
  file_path VARCHAR(500) NOT NULL,
  encrypted BOOLEAN DEFAULT TRUE,
  consent_given BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  taken_by VARCHAR(100) NOT NULL
);

CREATE INDEX idx_derma_photos_patient ON derma_photos(patient_id);
CREATE INDEX idx_derma_photos_assessment ON derma_photos(assessment_id);

CREATE TABLE IF NOT EXISTS derma_treatments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  assessment_id UUID NOT NULL REFERENCES derma_assessments(id),
  treatment_plan TEXT NOT NULL,
  medications JSONB DEFAULT '[]',
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_derma_treatments_patient ON derma_treatments(patient_id);

-- ── Ophthalmology ──
CREATE TYPE ophthal_eye AS ENUM ('left', 'right', 'both');

CREATE TABLE IF NOT EXISTS ophthal_exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  exam_type VARCHAR(100) NOT NULL,
  eye ophthal_eye DEFAULT 'both',
  visual_acuity VARCHAR(20),
  iop DECIMAL(5,2),
  refraction_sphere DECIMAL(6,2),
  refraction_cylinder DECIMAL(6,2),
  refraction_axis INT CHECK (refraction_axis BETWEEN 0 AND 180),
  notes TEXT,
  examined_by VARCHAR(100) NOT NULL,
  examined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ophthal_exams_patient ON ophthal_exams(patient_id);
CREATE INDEX idx_ophthal_exams_type ON ophthal_exams(exam_type);

CREATE TYPE ophthal_image_type AS ENUM ('oct', 'hvf', 'fundus', 'topography');

CREATE TABLE IF NOT EXISTS ophthal_imaging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  exam_id UUID NOT NULL REFERENCES ophthal_exams(id),
  image_type ophthal_image_type NOT NULL,
  dicom_path VARCHAR(500),
  findings TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ophthal_imaging_patient ON ophthal_imaging(patient_id);
CREATE INDEX idx_ophthal_imaging_exam ON ophthal_imaging(exam_id);

CREATE TABLE IF NOT EXISTS ophthal_prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  exam_id UUID NOT NULL REFERENCES ophthal_exams(id),
  lens_type VARCHAR(50) DEFAULT 'single_vision',
  sphere DECIMAL(6,2) NOT NULL,
  cylinder DECIMAL(6,2) DEFAULT 0,
  axis INT DEFAULT 0 CHECK (axis BETWEEN 0 AND 180),
  add_power DECIMAL(4,2) DEFAULT 0,
  pd DECIMAL(5,2),
  notes TEXT,
  prescribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ophthal_prescriptions_patient ON ophthal_prescriptions(patient_id);
CREATE INDEX idx_ophthal_prescriptions_exam ON ophthal_prescriptions(exam_id);

-- ── Coding Cache ──
CREATE TABLE IF NOT EXISTS coding_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  specialty VARCHAR(20) NOT NULL,
  local_code VARCHAR(50) NOT NULL,
  local_desc VARCHAR(500),
  nphies_code VARCHAR(50) NOT NULL,
  nphies_system VARCHAR(200) NOT NULL,
  mapped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(specialty, local_code)
);

CREATE INDEX idx_coding_cache_specialty ON coding_cache(specialty);
CREATE INDEX idx_coding_cache_local ON coding_cache(specialty, local_code);

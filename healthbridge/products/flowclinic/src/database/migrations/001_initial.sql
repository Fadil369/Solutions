-- FlowClinic Initial Migration
-- Creates all core tables for patient flow management

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    national_id VARCHAR(20) UNIQUE NOT NULL,
    name_ar VARCHAR(200) NOT NULL DEFAULT '',
    name_en VARCHAR(200) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ar',
    insurance_id VARCHAR(50),
    last_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_national_id ON patients(national_id);
CREATE INDEX idx_patients_phone ON patients(phone);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    queue_enabled BOOLEAN NOT NULL DEFAULT true,
    avg_visit_duration_min INT NOT NULL DEFAULT 15
);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'busy', 'off'))
);

CREATE INDEX idx_doctors_department ON doctors(department);

-- Queue entries table
CREATE TABLE IF NOT EXISTS queue_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    queue_number INT NOT NULL,
    department VARCHAR(100) NOT NULL,
    doctor_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'in_progress', 'completed', 'no_show')),
    priority BOOLEAN NOT NULL DEFAULT false,
    estimated_wait_min INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_entries_department ON queue_entries(department);
CREATE INDEX idx_queue_entries_status ON queue_entries(status);
CREATE INDEX idx_queue_entries_patient ON queue_entries(patient_id);
CREATE INDEX idx_queue_entries_dept_status ON queue_entries(department, status);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    chief_complaint TEXT,
    soap_note JSONB,
    vitals JSONB,
    diagnosis_codes TEXT[] DEFAULT '{}',
    prescriptions JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'billed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_doctor ON visits(doctor_id);
CREATE INDEX idx_visits_status ON visits(status);
CREATE INDEX idx_visits_created ON visits(created_at);

-- Billing records table
CREATE TABLE IF NOT EXISTS billing_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    insurance_covered DECIMAL(10, 2) NOT NULL DEFAULT 0,
    copay DECIMAL(10, 2) NOT NULL DEFAULT 0,
    nphies_claim_id VARCHAR(100),
    zatca_invoice_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'paid')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_visit ON billing_records(visit_id);
CREATE INDEX idx_billing_patient ON billing_records(patient_id);
CREATE INDEX idx_billing_status ON billing_records(status);

-- SMS/WhatsApp logs table
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_patient ON sms_logs(patient_id);
CREATE INDEX idx_sms_logs_sent ON sms_logs(sent_at);

-- Seed default departments
INSERT INTO departments (name_ar, name_en, avg_visit_duration_min) VALUES
    ('الطب العام', 'General Medicine', 12),
    ('الأسنان', 'Dental', 20),
    ('العيون', 'Ophthalmology', 15),
    ('الجلدية', 'Dermatology', 10),
    ('النساء والتوليد', 'OB/GYN', 18),
    ('الأطفال', 'Pediatrics', 12),
    ('العظام', 'Orthopedics', 15),
    ('المختبر', 'Laboratory', 8),
    ('الأشعة', 'Radiology', 10)
ON CONFLICT DO NOTHING;

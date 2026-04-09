export type SupportedLanguage = 'ar' | 'en' | 'ur' | 'tl' | 'bn' | 'hi';

export interface Patient {
  id: string;
  national_id: string;
  name_ar: string;
  name_en: string;
  phone: string;
  preferred_language: SupportedLanguage;
  insurance_id?: string;
  last_visit?: Date;
  created_at: Date;
}

export type QueueStatus = 'waiting' | 'in_progress' | 'completed' | 'no_show';

export interface QueueEntry {
  id: string;
  patient_id: string;
  queue_number: number;
  department: string;
  doctor_id?: string;
  status: QueueStatus;
  priority: boolean;
  estimated_wait_min: number;
  created_at: Date;
  called_at?: Date;
  completed_at?: Date;
  // Joined fields
  patient?: Patient;
}

export interface Vitals {
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature: number;
  weight: number;
  height: number;
  spo2: number;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  medications: Medication[];
  notes?: string;
}

export type VisitStatus = 'in_progress' | 'completed' | 'billed';

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string;
  department: string;
  chief_complaint?: string;
  soap_note?: SoapNote;
  vitals?: Vitals;
  diagnosis_codes: string[];
  prescriptions?: Prescription;
  status: VisitStatus;
  created_at: Date;
  completed_at?: Date;
  patient?: Patient;
}

export type DoctorStatus = 'available' | 'busy' | 'off';

export interface Doctor {
  id: string;
  name_ar: string;
  name_en: string;
  department: string;
  specialty: string;
  status: DoctorStatus;
}

export interface Department {
  id: string;
  name_ar: string;
  name_en: string;
  queue_enabled: boolean;
  avg_visit_duration_min: number;
}

export type BillingStatus = 'pending' | 'submitted' | 'paid';

export interface BillingRecord {
  id: string;
  visit_id: string;
  patient_id: string;
  amount: number;
  insurance_covered: number;
  copay: number;
  nphies_claim_id?: string;
  zatca_invoice_id?: string;
  status: BillingStatus;
  created_at: Date;
  visit?: Visit;
  patient?: Patient;
}

export interface SmsLog {
  id: string;
  patient_id: string;
  phone: string;
  message: string;
  type: string;
  status: string;
  sent_at: Date;
}

export interface QueueStats {
  total_waiting: number;
  total_served_today: number;
  total_no_show_today: number;
  avg_wait_min: number;
  avg_service_min: number;
  no_show_rate: number;
}

export interface QueuePosition {
  position: number;
  estimatedWait: number;
  currentServing?: number;
}

export interface DashboardOverview {
  patients_seen_today: number;
  patients_waiting: number;
  avg_wait_min: number;
  revenue_today: number;
  no_show_rate: number;
  busiest_department: string;
}

export interface DepartmentQueueStatus {
  department: string;
  department_ar: string;
  waiting: number;
  current_serving?: number;
  avg_wait_min: number;
}

export interface DoctorLoad {
  doctor_id: string;
  doctor_name: string;
  department: string;
  patients_today: number;
  patients_per_hour: number;
  status: DoctorStatus;
}

export interface WaitTimeEstimate {
  department: string;
  department_ar: string;
  waiting_count: number;
  estimated_wait_min: number;
}

// API Request types
export interface JoinQueueRequest {
  patientId: string;
  department: string;
  doctorId?: string;
  priority?: boolean;
}

export interface RegisterPatientRequest {
  nationalId: string;
  nameAr?: string;
  nameEn?: string;
  phone: string;
  preferredLanguage: SupportedLanguage;
  insuranceId?: string;
}

export interface CheckInRequest {
  nationalId?: string;
  phone?: string;
  department: string;
  doctorId?: string;
}

export interface StartVisitRequest {
  patientId: string;
  doctorId: string;
  department: string;
  queueEntryId?: string;
  chiefComplaint?: string;
}

export interface VitalsRequest {
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature: number;
  weight: number;
  height: number;
  spo2: number;
}

export interface SoapNoteRequest {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface DiagnosisRequest {
  icdCodes: string[];
}

export interface PrescriptionRequest {
  medications: Medication[];
}

// Socket events
export interface QueueUpdatedEvent {
  department: string;
  queue: QueueEntry[];
}

export interface PatientCalledEvent {
  entry: QueueEntry;
  department: string;
  room?: string;
}

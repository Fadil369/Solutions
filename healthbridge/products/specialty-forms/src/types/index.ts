// ── Patient ──
export interface Patient {
  id: string;
  national_id: string;
  name_ar: string;
  name_en: string;
  dob: string;
  phone: string;
  insurance_id?: string;
  created_at: string;
}

// ── Dental ──
export interface DentalChart {
  id: string;
  patient_id: string;
  tooth_number: number;
  surface: string;
  procedure_code: string;
  procedure_desc: string;
  notes?: string;
  performed_by: string;
  performed_at: string;
  nphies_preauth_id?: string;
}

export interface DentalTreatment {
  id: string;
  patient_id: string;
  chart_id?: string;
  procedure_code: string;
  procedure_desc: string;
  ada_code: string;
  cost: number;
  status: 'planned' | 'in_progress' | 'completed';
  preauth_required: boolean;
  preauth_id?: string;
  created_at: string;
}

export interface DentalXray {
  id: string;
  patient_id: string;
  tooth_number?: number;
  image_path: string;
  image_type: string;
  uploaded_at: string;
}

export interface DentalTooth {
  number: number;
  surfaces: {
    mesial: SurfaceStatus;
    distal: SurfaceStatus;
    occlusal: SurfaceStatus;
    buccal: SurfaceStatus;
    lingual: SurfaceStatus;
  };
  procedures: DentalChart[];
}

export interface SurfaceStatus {
  status: 'healthy' | 'treated' | 'needs_attention' | 'missing';
  procedure_code?: string;
}

// ── Dermatology ──
export interface DermaAssessment {
  id: string;
  patient_id: string;
  body_region: string;
  lesion_type: string;
  size_mm: number;
  color: string;
  border_regularity: string;
  notes?: string;
  assessed_at: string;
  assessed_by: string;
}

export interface DermaPhoto {
  id: string;
  patient_id: string;
  assessment_id: string;
  photo_type: 'lesion' | 'body_map' | 'before' | 'after';
  file_path: string;
  encrypted: boolean;
  consent_given: boolean;
  taken_at: string;
  taken_by: string;
}

export interface DermaTreatment {
  id: string;
  patient_id: string;
  assessment_id: string;
  treatment_plan: string;
  medications: Medication[];
  follow_up_date?: string;
  created_at: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface BodyRegion {
  region: string;
  label: string;
  labelAr: string;
  svgPath: string;
}

// ── Ophthalmology ──
export interface OphthalExam {
  id: string;
  patient_id: string;
  exam_type: string;
  eye: 'left' | 'right' | 'both';
  visual_acuity?: string;
  iop?: number;
  refraction_sphere?: number;
  refraction_cylinder?: number;
  refraction_axis?: number;
  notes?: string;
  examined_by: string;
  examined_at: string;
}

export interface OphthalImaging {
  id: string;
  patient_id: string;
  exam_id: string;
  image_type: 'oct' | 'hvf' | 'fundus' | 'topography';
  dicom_path: string;
  findings?: string;
  uploaded_at: string;
}

export interface OphthalPrescription {
  id: string;
  patient_id: string;
  exam_id: string;
  lens_type: string;
  sphere: number;
  cylinder: number;
  axis: number;
  add_power: number;
  pd: number;
  notes?: string;
  prescribed_at: string;
}

export interface RefractionData {
  sphere: number;
  cylinder: number;
  axis: number;
  age?: number;
}

export interface LensPrescription {
  sphere: number;
  cylinder: number;
  axis: number;
  add_power: number;
  pd: number;
  lens_type: string;
  notes: string;
}

// ── Shared ──
export interface Visit {
  id: string;
  patient_id: string;
  specialty: 'dental' | 'derma' | 'ophthalmology';
  doctor_id: string;
  status: 'in_progress' | 'completed' | 'billed';
  chief_complaint?: string;
  created_at: string;
  completed_at?: string;
}

export interface CodingCache {
  id: string;
  specialty: string;
  local_code: string;
  local_desc: string;
  nphies_code: string;
  nphies_system: string;
  mapped_at: string;
}

export interface MappedCode {
  nphiesCode: string;
  nphiesSystem: string;
  description: string;
  localCode: string;
  specialty: string;
}

export interface Procedure {
  code: string;
  adaCode: string;
  description: string;
  costRange: [number, number];
  preAuthRequired: boolean;
  category: string;
}

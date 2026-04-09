// Core domain types for NPHIES Bridge

export interface Patient {
  id: string;
  national_id: string;
  name_ar?: string;
  name_en?: string;
  dob?: string;
  gender?: 'male' | 'female';
  phone?: string;
  insurance_id?: string;
  payer_id?: string;
  payer_name?: string;
  created_at: string;
  updated_at: string;
}

export interface EligibilityCheck {
  id: string;
  patient_id: string;
  status: string;
  coverage_type?: string;
  copay_amount?: number;
  valid_until?: string;
  plan_name?: string;
  checked_at: string;
  response?: Record<string, any>;
  response_time_ms?: number;
}

export interface Claim {
  id: string;
  claim_number: string;
  patient_id: string;
  encounter_id?: string;
  status: ClaimStatus;
  total_amount: number;
  currency: string;
  icd_codes: string[];
  service_date: string;
  submitted_at?: string;
  adjudicated_at?: string;
  nphies_claim_id?: string;
  nphies_response?: Record<string, any>;
  rejection_reason?: string;
  rejection_codes: string[];
  zatca_invoice_id?: string;
  created_by?: string;
  items?: ClaimItem[];
  patient?: Patient;
  rejections?: RejectionLog[];
}

export type ClaimStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'cancelled';

export interface ClaimItem {
  id: string;
  claim_id: string;
  line_number: number;
  code: string;
  code_system?: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface RejectionLog {
  id: string;
  claim_id: string;
  rejection_code: string;
  rejection_desc?: string;
  category?: string;
  resolved: boolean;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface CchiRejectionCode {
  code: string;
  description: string;
  category: string;
  resolution_hint: string;
}

// NPHIES API types
export interface EligibilityRequest {
  patientNationalId: string;
  payerId: string;
  serviceDate?: string;
}

export interface EligibilityResponse {
  eligible: boolean;
  status: string;
  coverageType?: string;
  copayAmount?: number;
  copayPercentage?: number;
  validUntil?: string;
  planName?: string;
  memberName?: string;
  rawResponse?: any;
  responseTimeMs: number;
}

export interface ClaimSubmissionRequest {
  patientId: string;
  encounterId?: string;
  items: {
    code: string;
    codeSystem?: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  icdCodes: string[];
  serviceDate: string;
  totalAmount: number;
}

export interface ClaimSubmissionResponse {
  claimId: string;
  nphiesClaimId?: string;
  status: ClaimStatus;
  adjudication?: {
    approved: boolean;
    approvedAmount?: number;
    patientShare?: number;
    insurerShare?: number;
  };
  rejectionCodes?: string[];
  rejectionReason?: string;
  rawResponse?: any;
}

export interface ClaimStatusResponse {
  claimId: string;
  status: ClaimStatus;
  adjudication?: any;
  lastUpdated: string;
}

// FHIR types (simplified)
export interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  identifier: { system: string; value: string }[];
  name?: { use?: string; text?: string; family?: string; given?: string[] }[];
  gender?: string;
  birthDate?: string;
  telecom?: { system: string; value: string }[];
}

export interface FhirClaim {
  resourceType: 'Claim';
  id?: string;
  status: string;
  type: { coding: { system: string; code: string }[] };
  use: string;
  patient: { reference: string };
  created: string;
  insurer: { reference: string };
  provider: { reference: string };
  priority: { coding: { code: string }[] };
  diagnosis?: { sequence: number; diagnosisCodeableConcept: { coding: { system: string; code: string }[] } }[];
  item?: {
    sequence: number;
    productOrService: { coding: { system: string; code: string }[] };
    quantity?: { value: number };
    unitPrice?: { value: number; currency: string };
    net?: { value: number; currency: string };
  }[];
  total?: { value: number; currency: string };
}

export interface FhirCoverage {
  resourceType: 'Coverage';
  id?: string;
  status: string;
  type?: { coding: { system: string; code: string }[] };
  beneficiary: { reference: string };
  payor: { reference: string }[];
  period?: { start?: string; end?: string };
}

export interface FhirExplanationOfBenefit {
  resourceType: 'ExplanationOfBenefit';
  id?: string;
  status: string;
  outcome: string;
  claim: { reference: string };
  patient: { reference: string };
  insurer: { reference: string };
  item?: {
    adjudication: {
      category: { coding: { code: string }[] };
      amount?: { value: number; currency: string };
    }[];
  }[];
  total?: { category: { coding: { code: string }[] }; amount: { value: number; currency: string } }[];
}

// Scrubber types
export interface ScrubberResult {
  valid: boolean;
  errors: ScrubberIssue[];
  warnings: ScrubberIssue[];
  score: number; // 0-100 confidence score
}

export interface ScrubberIssue {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalClaims: number;
  claimsToday: number;
  acceptanceRate: number;
  totalRevenue: number;
  revenueRecovered: number;
  avgResponseTimeMs: number;
  eligibilityChecksToday: number;
  pendingClaims: number;
  rejectedClaims: number;
  topRejectionCodes: { code: string; count: number; description: string }[];
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  changes?: Record<string, any>;
  created_at: string;
}

import {
  Patient, Claim, ClaimItem, EligibilityCheck,
  FhirPatient, FhirClaim, FhirCoverage, FhirExplanationOfBenefit
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class FhirMapperService {

  // === Patient ===

  toFhirPatient(patient: Patient): FhirPatient {
    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        { system: 'http://nphies.sa/identifier/national-id', value: patient.national_id },
        ...(patient.insurance_id ? [{ system: 'http://nphies.sa/identifier/insurance', value: patient.insurance_id }] : []),
      ],
      name: [
        ...(patient.name_ar ? [{ use: 'official', text: patient.name_ar }] : []),
        ...(patient.name_en ? [{ use: 'official', text: patient.name_en }] : []),
      ],
      gender: patient.gender,
      birthDate: patient.dob,
      telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
    };
  }

  fromFhirPatient(fhir: FhirPatient): Partial<Patient> {
    const nationalId = fhir.identifier?.find(i => i.system.includes('national-id'))?.value;
    const insuranceId = fhir.identifier?.find(i => i.system.includes('insurance'))?.value;

    return {
      id: fhir.id || uuidv4(),
      national_id: nationalId || '',
      name_ar: fhir.name?.find(n => n.use === 'official')?.text,
      name_en: fhir.name?.find(n => n.use === 'usual')?.text,
      gender: fhir.gender as 'male' | 'female',
      dob: fhir.birthDate,
      phone: fhir.telecom?.find(t => t.system === 'phone')?.value,
      insurance_id: insuranceId,
    };
  }

  // === Claim ===

  toFhirClaim(claim: Claim, items: ClaimItem[], patient: Patient): FhirClaim {
    return {
      resourceType: 'Claim',
      id: claim.id,
      status: claim.status === 'draft' ? 'draft' : 'active',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      use: 'claim',
      patient: { reference: `Patient/${patient.id}`, display: patient.name_en || patient.name_ar },
      created: claim.service_date,
      insurer: { reference: `Organization/${claim.patient_id}` },
      provider: { reference: `Organization/healthbridge-facility` },
      priority: { coding: [{ code: 'normal' }] },
      diagnosis: claim.icd_codes.map((code, i) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: {
          coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-am', code }],
        },
      })),
      item: items.map((item, i) => ({
        sequence: i + 1,
        productOrService: {
          coding: [{
            system: item.code_system || 'http://nphies.sa/code-system/procedure',
            code: item.code,
          }],
          text: item.description,
        },
        quantity: { value: item.quantity },
        unitPrice: { value: item.unit_price, currency: claim.currency },
        net: { value: item.total, currency: claim.currency },
      })),
      total: { value: claim.total_amount, currency: claim.currency },
    };
  }

  // === Coverage ===

  toFhirCoverage(patientId: string, eligibility: EligibilityCheck): FhirCoverage {
    return {
      resourceType: 'Coverage',
      status: 'active',
      type: eligibility.coverage_type ? {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-type', code: eligibility.coverage_type }],
      } : undefined,
      beneficiary: { reference: `Patient/${patientId}` },
      payor: [{ reference: 'Organization/payer' }],
      period: eligibility.valid_until ? {
        start: eligibility.checked_at,
        end: eligibility.valid_until,
      } : undefined,
    };
  }

  // === ExplanationOfBenefit ===

  fromFhirEob(fhir: FhirExplanationOfBenefit): {
    claimId: string;
    status: string;
    approvedAmount?: number;
    patientShare?: number;
    insurerShare?: number;
    rejectionCodes?: string[];
  } {
    const claimRef = fhir.claim?.reference?.replace('Claim/', '') || '';

    const totalApproved = fhir.total?.find(t => t.category?.coding?.[0]?.code === 'benefit')?.amount?.value;
    const totalPatient = fhir.total?.find(t => t.category?.coding?.[0]?.code === 'patient')?.amount?.value;

    const rejectionCodes: string[] = [];
    if (fhir.item) {
      for (const item of fhir.item) {
        for (const adj of item.adjudication || []) {
          const code = adj.category?.coding?.[0]?.code;
          if (code === 'denied' || code === 'rejected') {
            rejectionCodes.push(code);
          }
        }
      }
    }

    return {
      claimId: claimRef,
      status: fhir.outcome === 'complete' ? 'accepted' : fhir.outcome === 'error' ? 'rejected' : 'submitted',
      approvedAmount: totalApproved,
      patientShare: totalPatient,
      insurerShare: totalApproved && totalPatient ? totalApproved - totalPatient : undefined,
      rejectionCodes: rejectionCodes.length > 0 ? rejectionCodes : undefined,
    };
  }

  // === Bundle Builder ===

  buildClaimBundle(claim: Claim, items: ClaimItem[], patient: Patient): any {
    const fhirClaim = this.toFhirClaim(claim, items, patient);
    const fhirPatient = this.toFhirPatient(patient);

    return {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: fhirPatient },
        { resource: fhirClaim },
      ],
    };
  }
}

export const fhirMapper = new FhirMapperService();

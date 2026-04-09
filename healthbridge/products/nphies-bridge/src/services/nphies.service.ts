import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  EligibilityRequest, EligibilityResponse,
  ClaimSubmissionRequest, ClaimSubmissionResponse,
  ClaimStatusResponse, ClaimStatus
} from '../types';

interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

export class NphiesService {
  private client: AxiosInstance;
  private token: AuthToken | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.nphiesBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          logger.info('Token expired, refreshing...');
          this.token = null;
          await this.authenticate();
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${this.token?.access_token}`;
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async authenticate(): Promise<AuthToken> {
    if (this.token && this.token.expires_at > Date.now() + 60000) {
      return this.token;
    }

    try {
      const response = await axios.post(`${config.nphiesBaseUrl}/auth/token`, {
        grant_type: 'client_credentials',
        client_id: config.nphiesClientId,
        client_secret: config.nphiesClientSecret,
        scope: 'eligibility claim preauth',
      });

      this.token = {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        expires_at: Date.now() + response.data.expires_in * 1000,
      };

      logger.info('NPHIES authentication successful');
      return this.token;
    } catch (err: any) {
      logger.error('NPHIES authentication failed', { error: err.message });
      throw new Error(`NPHIES authentication failed: ${err.message}`);
    }
  }

  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    const token = await this.authenticate();
    const start = Date.now();

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'X-Facility-ID': config.nphiesFacilityId,
        },
      });

      const duration = Date.now() - start;
      logger.info(`NPHIES ${method} ${path}`, { status: response.status, duration });

      if (duration > 5000) {
        logger.warn('Slow NPHIES response', { path, duration });
      }

      return response.data;
    } catch (err: any) {
      const duration = Date.now() - start;
      logger.error(`NPHIES ${method} ${path} failed`, {
        status: err.response?.status,
        error: err.message,
        duration,
      });
      throw err;
    }
  }

  // === Tameen: Eligibility Verification ===

  async checkEligibility(req: EligibilityRequest): Promise<EligibilityResponse> {
    const start = Date.now();

    const fhirRequest = {
      resourceType: 'CoverageEligibilityRequest',
      status: 'active',
      priority: { coding: [{ code: 'stat' }] },
      purpose: ['benefits'],
      patient: { identifier: { system: 'http://nphies.sa/identifier/national-id', value: req.patientNationalId } },
      insurer: { identifier: { system: 'http://nphies.sa/identifier/payer', value: req.payerId } },
      facility: { identifier: { system: 'http://nphies.sa/identifier/facility', value: config.nphiesFacilityId } },
      created: req.serviceDate || new Date().toISOString().split('T')[0],
      insurance: [{ coverage: { reference: `Coverage/${req.payerId}` } }],
    };

    try {
      const response = await this.request<any>('POST', '/eligibility/v1/check', fhirRequest);

      const outcome = response.outcome || 'complete';
      const insurance = response.insurance?.[0];

      return {
        eligible: outcome === 'complete' && insurance?.item?.length > 0,
        status: outcome,
        coverageType: insurance?.item?.[0]?.name,
        copayAmount: insurance?.item?.[0]?.benefit?.[0]?.allowedMoney?.value,
        copayPercentage: insurance?.item?.[0]?.benefit?.[0]?.allowedUnsignedInt,
        validUntil: insurance?.item?.[0]?.benefit?.[0]?.allowedMoney?.end,
        planName: insurance?.coverage?.display,
        memberName: response.patient?.display,
        rawResponse: response,
        responseTimeMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        eligible: false,
        status: 'error',
        rawResponse: { error: err.message },
        responseTimeMs: Date.now() - start,
      };
    }
  }

  // === Masdar: Claims Submission ===

  async submitClaim(claim: any): Promise<ClaimSubmissionResponse> {
    try {
      const response = await this.request<any>('POST', '/claim/v1/submit', claim);

      const outcome = response.outcome;
      const adjudication = response.item?.[0]?.adjudication;

      let status: ClaimStatus = 'submitted';
      const rejectionCodes: string[] = [];

      if (outcome === 'complete') {
        status = 'accepted';
      } else if (outcome === 'error' || outcome === 'partial') {
        status = 'rejected';
        if (response.error) {
          for (const err of response.error) {
            rejectionCodes.push(err.code?.coding?.[0]?.code || 'UNKNOWN');
          }
        }
      }

      return {
        claimId: response.id,
        nphiesClaimId: response.id,
        status,
        adjudication: adjudication ? {
          approved: outcome === 'complete',
          approvedAmount: adjudication.find((a: any) => a.category?.coding?.[0]?.code === 'benefit')?.amount?.value,
          patientShare: adjudication.find((a: any) => a.category?.coding?.[0]?.code === 'patient')?.amount?.value,
          insurerShare: adjudication.find((a: any) => a.category?.coding?.[0]?.code === 'insurer')?.amount?.value,
        } : undefined,
        rejectionCodes: rejectionCodes.length > 0 ? rejectionCodes : undefined,
        rejectionReason: response.error?.[0]?.diagnostics,
        rawResponse: response,
      };
    } catch (err: any) {
      return {
        claimId: '',
        status: 'rejected',
        rejectionReason: err.message,
        rawResponse: { error: err.message },
      };
    }
  }

  async getClaimStatus(claimId: string): Promise<ClaimStatusResponse> {
    const response = await this.request<any>('GET', `/claim/v1/status/${claimId}`);

    let status: ClaimStatus = 'submitted';
    if (response.outcome === 'complete') status = 'accepted';
    else if (response.outcome === 'error') status = 'rejected';

    return {
      claimId: response.id,
      status,
      adjudication: response.item?.[0]?.adjudication,
      lastUpdated: response.meta?.lastUpdated || new Date().toISOString(),
    };
  }

  async resubmitClaim(claimId: string, correctedClaim: any): Promise<ClaimSubmissionResponse> {
    const claimWithCorrection = { ...correctedClaim, related: [{ claim: { reference: `Claim/${claimId}` }, relationship: { coding: [{ code: 'prior' }] } }] };
    return this.submitClaim(claimWithCorrection);
  }

  // === Pre-Authorization ===

  async requestPreAuth(authData: any): Promise<any> {
    const fhirRequest = {
      resourceType: 'Claim',
      status: 'active',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      use: 'preauthorization',
      patient: { identifier: { system: 'http://nphies.sa/identifier/national-id', value: authData.patientNationalId } },
      insurer: { identifier: { system: 'http://nphies.sa/identifier/payer', value: authData.payerId } },
      provider: { identifier: { system: 'http://nphies.sa/identifier/facility', value: config.nphiesFacilityId } },
      created: new Date().toISOString(),
      diagnosis: authData.diagnosisCodes?.map((code: string, i: number) => ({
        sequence: i + 1,
        diagnosisCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-am', code }] },
      })) || [],
      item: authData.items?.map((item: any, i: number) => ({
        sequence: i + 1,
        productOrService: { coding: [{ system: 'http://nphies.sa/code-system/procedure', code: item.code }] },
        quantity: { value: item.quantity || 1 },
      })) || [],
    };

    return this.request('POST', '/claim/v1/submit', fhirRequest);
  }

  // === Utilities ===

  mapRejectionCode(code: string): { code: string; description: string; category: string } {
    const codes: Record<string, { description: string; category: string }> = {
      'E001': { description: 'Patient eligibility not found or expired', category: 'Eligibility' },
      'E002': { description: 'Service not covered under patient plan', category: 'Coverage' },
      'E003': { description: 'Duplicate claim submission', category: 'Duplicate' },
      'E004': { description: 'Missing or invalid referral number', category: 'Authorization' },
      'E005': { description: 'Prior authorization required', category: 'Authorization' },
      'E006': { description: 'Invalid ICD-10 diagnosis code', category: 'Coding' },
      'E007': { description: 'Mismatched procedure and diagnosis codes', category: 'Coding' },
      'E008': { description: 'Missing provider license number', category: 'Provider' },
      'E009': { description: 'Service date outside claim period', category: 'Date' },
      'E010': { description: 'Patient ID does not match payer records', category: 'Eligibility' },
    };
    return { code, ...(codes[code] || { description: 'Unknown rejection code', category: 'Other' }) };
  }
}

export const nphiesService = new NphiesService();

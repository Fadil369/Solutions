import { ScrubberResult, ScrubberIssue, ClaimSubmissionRequest } from '../types';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

// CCHI Top-50 Rejection Codes validation rules
const CCHI_RULES: Array<{
  code: string;
  description: string;
  check: (claim: ClaimSubmissionRequest, context: ValidationContext) => ScrubberIssue | null;
}> = [
  {
    code: 'E001',
    description: 'Patient eligibility not found or expired',
    check: (claim, ctx) => {
      if (!ctx.hasActiveEligibility) {
        return { code: 'E001', message: 'Patient has no active eligibility check. Verify insurance before submitting.', field: 'patientId', severity: 'error' };
      }
      if (ctx.eligibilityExpired) {
        return { code: 'E001', message: 'Patient eligibility has expired. Request a new eligibility check.', field: 'patientId', severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E003',
    description: 'Duplicate claim submission',
    check: (claim, ctx) => {
      if (ctx.duplicateClaimFound) {
        return { code: 'E003', message: `Duplicate claim detected for patient on ${claim.serviceDate}. Existing claim: ${ctx.duplicateClaimId}`, field: 'serviceDate', severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E006',
    description: 'Invalid ICD-10 diagnosis code',
    check: (claim) => {
      const invalidCodes = claim.icdCodes.filter(code => !/^[A-Z]\d{2}(\.\d{1,2})?$/.test(code));
      if (invalidCodes.length > 0) {
        return { code: 'E006', message: `Invalid ICD-10 format: ${invalidCodes.join(', ')}. Expected format: A00 or A00.0`, field: 'icdCodes', severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E009',
    description: 'Service date outside claim period',
    check: (claim) => {
      const serviceDate = new Date(claim.serviceDate);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - serviceDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        return { code: 'E009', message: `Service date is ${daysDiff} days old. Most payers require claims within 90 days.`, field: 'serviceDate', severity: 'warning' };
      }
      if (serviceDate > now) {
        return { code: 'E009', message: 'Service date is in the future.', field: 'serviceDate', severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E013',
    description: 'Missing ZATCA tax registration',
    check: (claim) => {
      // ZATCA check would verify facility VAT registration
      // For now, just a format check
      return null;
    },
  },
  {
    code: 'E014',
    description: 'Incomplete claim information',
    check: (claim) => {
      const missing: string[] = [];
      if (!claim.patientId) missing.push('patientId');
      if (!claim.serviceDate) missing.push('serviceDate');
      if (!claim.icdCodes || claim.icdCodes.length === 0) missing.push('icdCodes');
      if (!claim.items || claim.items.length === 0) missing.push('items');
      if (missing.length > 0) {
        return { code: 'E014', message: `Missing required fields: ${missing.join(', ')}`, severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E016',
    description: 'Claim amount exceeds fee schedule',
    check: (claim) => {
      const calculatedTotal = claim.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      if (Math.abs(calculatedTotal - claim.totalAmount) > 0.01) {
        return { code: 'E016', message: `Claim total (${claim.totalAmount}) does not match sum of items (${calculatedTotal}).`, field: 'totalAmount', severity: 'error' };
      }
      if (calculatedTotal <= 0) {
        return { code: 'E016', message: 'Claim total must be greater than zero.', field: 'totalAmount', severity: 'error' };
      }
      return null;
    },
  },
  {
    code: 'E014-B',
    description: 'Claim items validation',
    check: (claim) => {
      if (!claim.items || claim.items.length === 0) return null;
      const issues: string[] = [];
      claim.items.forEach((item, i) => {
        if (!item.code) issues.push(`Item ${i + 1}: missing procedure code`);
        if (!item.description) issues.push(`Item ${i + 1}: missing description`);
        if (item.quantity <= 0) issues.push(`Item ${i + 1}: invalid quantity`);
        if (item.unitPrice < 0) issues.push(`Item ${i + 1}: negative unit price`);
      });
      if (issues.length > 0) {
        return { code: 'E014', message: issues.join('; '), severity: 'warning' };
      }
      return null;
    },
  },
];

interface ValidationContext {
  hasActiveEligibility: boolean;
  eligibilityExpired: boolean;
  duplicateClaimFound: boolean;
  duplicateClaimId?: string;
}

export class ClaimScrubber {
  async validateClaim(claim: ClaimSubmissionRequest): Promise<ScrubberResult> {
    const errors: ScrubberIssue[] = [];
    const warnings: ScrubberIssue[] = [];

    // Build validation context from database
    const context = await this.buildContext(claim);

    // Run all rules
    for (const rule of CCHI_RULES) {
      try {
        const issue = rule.check(claim, context);
        if (issue) {
          if (issue.severity === 'error') {
            errors.push(issue);
          } else {
            warnings.push(issue);
          }
        }
      } catch (err: any) {
        logger.error(`Scrubber rule ${rule.code} failed`, { error: err.message });
      }
    }

    // Calculate confidence score (100 = perfect, 0 = no-go)
    const score = Math.max(0, 100 - (errors.length * 25) - (warnings.length * 5));

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  private async buildContext(claim: ClaimSubmissionRequest): Promise<ValidationContext> {
    const context: ValidationContext = {
      hasActiveEligibility: false,
      eligibilityExpired: false,
      duplicateClaimFound: false,
    };

    try {
      // Check for active eligibility
      const eligibilityResult = await query(
        `SELECT status, valid_until FROM eligibility_checks
         WHERE patient_id = $1 ORDER BY checked_at DESC LIMIT 1`,
        [claim.patientId]
      );

      if (eligibilityResult.rows.length > 0) {
        const eligibility = eligibilityResult.rows[0];
        context.hasActiveEligibility = eligibility.status === 'active' || eligibility.status === 'eligible';
        if (eligibility.valid_until) {
          context.eligibilityExpired = new Date(eligibility.valid_until) < new Date();
        }
      }

      // Check for duplicate claims
      const duplicateResult = await query(
        `SELECT id FROM claims
         WHERE patient_id = $1 AND service_date = $2 AND status != 'cancelled'`,
        [claim.patientId, claim.serviceDate]
      );

      if (duplicateResult.rows.length > 0) {
        context.duplicateClaimFound = true;
        context.duplicateClaimId = duplicateResult.rows[0].id;
      }
    } catch (err: any) {
      logger.error('Failed to build scrubber context', { error: err.message });
    }

    return context;
  }
}

export const claimScrubber = new ClaimScrubber();

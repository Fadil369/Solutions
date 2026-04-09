import { RefractionData, LensPrescription } from '../types';

export class RefractionCalculator {
  /**
   * Calculate add power for presbyopia based on age
   */
  calculateAddPower(age: number): number {
    if (age < 40) return 0;
    if (age < 45) return 1.0;
    if (age < 50) return 1.5;
    if (age < 55) return 2.0;
    if (age < 60) return 2.5;
    return 3.0;
  }

  /**
   * Calculate full lens prescription from exam refraction data
   */
  calculatePrescription(data: RefractionData): LensPrescription {
    const { sphere, cylinder, axis, age } = data;

    // Round to nearest 0.25 diopter (standard lens increment)
    const roundToQuarter = (val: number): number => Math.round(val * 4) / 4;

    const roundedSphere = roundToQuarter(sphere);
    const roundedCylinder = roundToQuarter(cylinder);
    const roundedAxis = Math.round(axis / 5) * 5; // Round to nearest 5 degrees

    // Determine add power for presbyopia
    const addPower = age ? this.calculateAddPower(age) : 0;

    // Determine lens type
    let lensType = 'single_vision';
    if (addPower > 0) {
      lensType = 'progressive'; // or bifocal depending on patient preference
    }

    // Estimate PD (pupillary distance) — typically 60-66mm for adults
    // In production, this would be measured
    const pd = 63;

    // Generate clinical notes
    const notes = this.generateNotes(roundedSphere, roundedCylinder, roundedAxis, addPower);

    return {
      sphere: roundedSphere,
      cylinder: roundedCylinder,
      axis: roundedAxis,
      add_power: addPower,
      pd,
      lens_type: lensType,
      notes,
    };
  }

  /**
   * Generate human-readable clinical notes
   */
  private generateNotes(sphere: number, cylinder: number, axis: number, addPower: number): string {
    const parts: string[] = [];

    // Sphere interpretation
    if (sphere < 0) {
      parts.push(`Myopia: ${Math.abs(sphere).toFixed(2)}D`);
    } else if (sphere > 0) {
      parts.push(`Hyperopia: +${sphere.toFixed(2)}D`);
    }

    // Cylinder interpretation
    if (cylinder !== 0) {
      const direction = axis <= 90 ? 'with-the-rule' : 'against-the-rule';
      parts.push(`Astigmatism: ${cylinder.toFixed(2)}D × ${axis}° (${direction})`);
    }

    // Add power
    if (addPower > 0) {
      parts.push(`Presbyopia add: +${addPower.toFixed(2)}D`);
    }

    if (parts.length === 0) {
      parts.push('Emmetropia — no correction required');
    }

    return parts.join('; ');
  }

  /**
   * Convert Snellen fraction to decimal acuity
   */
  snellenToDecimal(numerator: number, denominator: number): number {
    return numerator / denominator;
  }

  /**
   * Convert decimal acuity to Snellen notation
   */
  decimalToSnellen(decimal: number): string {
    const standardDenominator = 20;
    const numerator = Math.round(decimal * standardDenominator);
    return `${numerator}/${standardDenominator}`;
  }

  /**
   * Validate IOP reading
   */
  validateIOP(iop: number): { valid: boolean; alert?: string; severity: 'normal' | 'borderline' | 'high' | 'critical' } {
    if (iop < 5) return { valid: false, alert: 'IOP critically low — possible hypotony', severity: 'critical' };
    if (iop > 40) return { valid: false, alert: 'IOP critically high — possible acute glaucoma', severity: 'critical' };
    if (iop > 21) return { valid: true, alert: 'IOP elevated — consider glaucoma workup', severity: 'high' };
    if (iop > 18) return { valid: true, alert: 'IOP borderline — monitor', severity: 'borderline' };
    return { valid: true, severity: 'normal' };
  }
}

export const refractionCalculator = new RefractionCalculator();

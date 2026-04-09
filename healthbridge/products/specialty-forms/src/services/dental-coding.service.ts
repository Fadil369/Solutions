import { Procedure } from '../types';
import dentalProcedures from '../data/dental-procedures.json';

const procedures: Procedure[] = dentalProcedures as Procedure[];

const PREAUTH_COST_THRESHOLD = 1000; // SAR

export class DentalCodingService {
  private procedures: Procedure[];

  constructor() {
    this.procedures = procedures;
  }

  mapToAda(procedureCode: string): { adaCode: string; description: string; cost: number } | null {
    const proc = this.procedures.find(
      (p) => p.code === procedureCode || p.adaCode === procedureCode
    );
    if (!proc) return null;
    return {
      adaCode: proc.adaCode,
      description: proc.description,
      cost: proc.costRange[0], // use minimum cost
    };
  }

  requiresPreAuth(procedureCode: string, cost: number): boolean {
    const proc = this.procedures.find(
      (p) => p.code === procedureCode || p.adaCode === procedureCode
    );
    if (proc?.preAuthRequired) return true;
    return cost >= PREAUTH_COST_THRESHOLD;
  }

  searchProcedures(query: string): Procedure[] {
    const q = query.toLowerCase();
    return this.procedures.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.adaCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  getProcedure(code: string): Procedure | undefined {
    return this.procedures.find((p) => p.code === code || p.adaCode === code);
  }

  getAllProcedures(): Procedure[] {
    return this.procedures;
  }

  getProceduresByCategory(category: string): Procedure[] {
    return this.procedures.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
}

export const dentalCodingService = new DentalCodingService();

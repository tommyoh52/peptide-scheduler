export type SyringeType = "U-100" | "U-50" | "U-40";

export const SYRINGE_UNITS_PER_ML: Record<SyringeType, number> = {
  "U-100": 100,
  "U-50": 50,
  "U-40": 40,
};

// Max capacity (1mL barrel). Some insulin syringes are 0.3mL or 0.5mL but
// we assume a 1mL barrel for common peptide use; users can split.
export const SYRINGE_MAX_UNITS: Record<SyringeType, number> = {
  "U-100": 100,
  "U-50": 50,
  "U-40": 40,
};

export interface ReconstitutionInput {
  vialMg: number;
  bacWaterMl: number;
  doseMcg: number;
  syringeType: SyringeType;
}

export interface ReconstitutionResult {
  concentrationMcgPerMl: number;
  drawVolumeMl: number;
  units: number;
  maxUnits: number;
  unitsPerMl: number;
  warnings: string[];
  valid: boolean;
}

export function calculateReconstitution(input: ReconstitutionInput): ReconstitutionResult {
  const { vialMg, bacWaterMl, doseMcg, syringeType } = input;
  const unitsPerMl = SYRINGE_UNITS_PER_ML[syringeType];
  const maxUnits = SYRINGE_MAX_UNITS[syringeType];
  const warnings: string[] = [];

  if (!vialMg || !bacWaterMl || !doseMcg) {
    return {
      concentrationMcgPerMl: 0,
      drawVolumeMl: 0,
      units: 0,
      maxUnits,
      unitsPerMl,
      warnings: [],
      valid: false,
    };
  }

  const concentrationMcgPerMl = (vialMg * 1000) / bacWaterMl;
  const drawVolumeMl = doseMcg / concentrationMcgPerMl;
  const units = drawVolumeMl * unitsPerMl;

  if (doseMcg > vialMg * 1000) {
    warnings.push("Dose exceeds vial contents");
  }
  if (units < 2) {
    warnings.push("Draw too small — measurement error high, add more water");
  }
  if (units > maxUnits) {
    warnings.push("Exceeds syringe capacity — reduce water or split dose");
  }

  return {
    concentrationMcgPerMl,
    drawVolumeMl,
    units,
    maxUnits,
    unitsPerMl,
    warnings,
    valid: true,
  };
}

// Snap suggested water to nearest standard value.
const SNAP_VALUES = [1, 2, 3, 5];

export function suggestBacWater(vialMg: number, typicalDoseMcg: number): number {
  if (!vialMg || !typicalDoseMcg) return 2;
  const raw = (typicalDoseMcg * 2) / vialMg;
  // Snap to nearest allowed value
  let nearest = SNAP_VALUES[0];
  let bestDist = Math.abs(raw - nearest);
  for (const v of SNAP_VALUES) {
    const d = Math.abs(raw - v);
    if (d < bestDist) {
      nearest = v;
      bestDist = d;
    }
  }
  // Clamp to [1,5]
  return Math.min(5, Math.max(1, nearest));
}

export function formatUnits(units: number): string {
  if (!isFinite(units)) return "—";
  return units.toFixed(1);
}

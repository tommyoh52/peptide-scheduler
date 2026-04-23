export type Goal = "weight_loss" | "muscle_gain" | "recovery" | "anti_aging";

export interface DosingInput {
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  age: number;
  goal: Goal;
}

export interface RecommendedPeptide {
  name: string;
  doseRangeMcg: [number, number];
  frequency: string;
  durationWeeks: number;
  notes?: string;
}

export interface ProtocolRecommendation {
  goalLabel: string;
  summary: string;
  peptides: RecommendedPeptide[];
  disclaimer: string;
}

const WEIGHT_REFERENCE_KG = 70;
// Adjust dose ±20% based on bodyweight
function weightAdjust(doseRange: [number, number], weightKg: number): [number, number] {
  const factor = 1 + Math.max(-0.2, Math.min(0.2, (weightKg - WEIGHT_REFERENCE_KG) / WEIGHT_REFERENCE_KG));
  const [lo, hi] = doseRange;
  return [Math.round(lo * factor), Math.round(hi * factor)];
}

export function recommendProtocol(input: DosingInput): ProtocolRecommendation {
  const { goal, weightKg } = input;
  const disclaimer =
    "Consult your physician before starting any protocol. This is a mathematical suggestion only, not medical advice.";

  switch (goal) {
    case "weight_loss":
      return {
        goalLabel: "Weight Loss",
        summary:
          "GLP-1 agonist titration protocol. Start at the lowest dose and escalate only under clinical supervision.",
        peptides: [
          {
            name: "Semaglutide",
            doseRangeMcg: weightAdjust([250, 2400], weightKg),
            frequency: "Weekly",
            durationWeeks: 16,
            notes: "Titrate: 0.25mg → 0.5mg → 1.0mg → 1.7mg → 2.4mg (4 weeks each).",
          },
          {
            name: "Tirzepatide",
            doseRangeMcg: weightAdjust([2500, 15000], weightKg),
            frequency: "Weekly",
            durationWeeks: 20,
            notes: "Titrate: 2.5mg → 5mg → 7.5mg → 10mg → 12.5mg → 15mg (4 weeks each).",
          },
        ],
        disclaimer,
      };
    case "muscle_gain":
      return {
        goalLabel: "Muscle Gain",
        summary: "Growth-secretagogue stack plus systemic healing support.",
        peptides: [
          {
            name: "CJC-1295 (no DAC)",
            doseRangeMcg: weightAdjust([100, 100], weightKg),
            frequency: "2x daily",
            durationWeeks: 12,
            notes: "Pair with Ipamorelin, same injection. Pre-bed + AM.",
          },
          {
            name: "Ipamorelin",
            doseRangeMcg: weightAdjust([100, 100], weightKg),
            frequency: "2x daily",
            durationWeeks: 12,
            notes: "Clean GH pulse; minimal cortisol/prolactin.",
          },
          {
            name: "BPC-157",
            doseRangeMcg: weightAdjust([250, 250], weightKg),
            frequency: "Daily",
            durationWeeks: 8,
            notes: "Recovery and gut support during training cycle.",
          },
        ],
        disclaimer,
      };
    case "recovery":
      return {
        goalLabel: "Recovery",
        summary: "Tissue-repair focused: BPC-157 systemic + TB-500 for deeper injuries.",
        peptides: [
          {
            name: "BPC-157",
            doseRangeMcg: weightAdjust([250, 250], weightKg),
            frequency: "Daily",
            durationWeeks: 6,
            notes: "Can be split AM/PM near injury site if appropriate.",
          },
          {
            name: "TB-500",
            doseRangeMcg: weightAdjust([2000, 2000], weightKg),
            frequency: "2x weekly",
            durationWeeks: 6,
            notes: "Loading phase; taper to 1x weekly in maintenance.",
          },
        ],
        disclaimer,
      };
    case "anti_aging":
      return {
        goalLabel: "Anti-Aging",
        summary: "Epithalon cycle for telomere/melatonin support, plus GHK-Cu for skin/tissue.",
        peptides: [
          {
            name: "Epithalon",
            doseRangeMcg: weightAdjust([10000, 10000], weightKg),
            frequency: "Daily (10-day cycle)",
            durationWeeks: 2,
            notes: "Typical protocol: 10mg/day for 10 consecutive days, 1-2x per year.",
          },
          {
            name: "GHK-Cu",
            doseRangeMcg: weightAdjust([1000, 2000], weightKg),
            frequency: "Daily",
            durationWeeks: 8,
            notes: "Subcutaneous; topical variants also common.",
          },
        ],
        disclaimer,
      };
  }
}

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "weight_loss", label: "Weight Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "recovery", label: "Recovery" },
  { value: "anti_aging", label: "Anti-Aging" },
];

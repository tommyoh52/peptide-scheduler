// Stack recommender for the "Build My Stack" quiz.
// Maps goals + experience + lifestyle into a suggested peptide stack.
// This is a MATHEMATICAL/SCHEDULING tool only — NOT medical advice.

export interface QuizInput {
  goals: string[];            // e.g. ["fat-loss", "muscle"]
  focusAreas?: string[];      // e.g. ["joint", "cognitive"]
  experience: string;         // "none" | "beginner" | "intermediate" | "advanced"
  lifestyle?: string[];       // e.g. ["low-sleep", "high-stress"]
  advanced?: boolean;         // allow advanced protocols
}

export interface RecommendedPeptide {
  name: string;
  reason: string;
  defaultDoseMcg: number;
  defaultFrequency: string;   // matches ScheduleSpec frequencies
  vialMg: number;
  bacMl: number;
  category: string;
}

export interface Recommendation {
  peptides: RecommendedPeptide[];
  overview: string;
  phasesWeek: Array<{
    week: number;
    note: string;
  }>;
}

// Master catalog of candidate peptides used by the recommender.
// Kept in sync with the SEED_PEPTIDES list in server/storage.ts.
const CANDIDATES: Record<string, RecommendedPeptide> = {
  semaglutide: { name: "Semaglutide", reason: "Long-acting GLP-1 for appetite/weight", defaultDoseMcg: 500, defaultFrequency: "weekly", vialMg: 5, bacMl: 2, category: "GLP-1" },
  tirzepatide: { name: "Tirzepatide", reason: "Dual GIP/GLP-1 for strong fat loss", defaultDoseMcg: 2500, defaultFrequency: "weekly", vialMg: 10, bacMl: 2, category: "GLP-1" },
  retatrutide: { name: "Retatrutide", reason: "Triple agonist (advanced fat-loss protocols)", defaultDoseMcg: 2000, defaultFrequency: "weekly", vialMg: 10, bacMl: 2, category: "GLP-1" },
  cagrilintide: { name: "Cagrilintide", reason: "Amylin analog — appetite and satiety support", defaultDoseMcg: 300, defaultFrequency: "weekly", vialMg: 5, bacMl: 2, category: "Metabolic" },
  motsC: { name: "MOTS-c", reason: "Mitochondrial peptide — metabolic efficiency", defaultDoseMcg: 5000, defaultFrequency: "3x-weekly", vialMg: 10, bacMl: 2, category: "Mitochondrial" },
  amino1mq: { name: "5-Amino-1MQ", reason: "NNMT inhibitor — research on fat metabolism", defaultDoseMcg: 50000, defaultFrequency: "daily", vialMg: 50, bacMl: 2, category: "Metabolic" },
  bpc157: { name: "BPC-157", reason: "Tissue repair / gut lining research", defaultDoseMcg: 250, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "Healing" },
  tb500: { name: "TB-500", reason: "Systemic recovery / tissue repair", defaultDoseMcg: 2000, defaultFrequency: "twice-weekly", vialMg: 5, bacMl: 2, category: "Healing" },
  ghkCu: { name: "GHK-Cu", reason: "Skin, hair, and connective-tissue research", defaultDoseMcg: 1000, defaultFrequency: "daily", vialMg: 50, bacMl: 5, category: "Longevity" },
  cjc1295: { name: "CJC-1295 (no DAC)", reason: "GHRH pulse to pair with Ipamorelin", defaultDoseMcg: 100, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "GH Secretagogue" },
  ipamorelin: { name: "Ipamorelin", reason: "Selective GH secretagogue — recovery/sleep", defaultDoseMcg: 200, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "GH Secretagogue" },
  tesamorelin: { name: "Tesamorelin", reason: "Longer-acting GHRH analog", defaultDoseMcg: 1000, defaultFrequency: "daily", vialMg: 2, bacMl: 2, category: "GH Secretagogue" },
  epithalon: { name: "Epithalon", reason: "Longevity / telomerase research", defaultDoseMcg: 5000, defaultFrequency: "daily", vialMg: 50, bacMl: 5, category: "Longevity" },
  nad: { name: "NAD+", reason: "Cellular energy / longevity", defaultDoseMcg: 50000, defaultFrequency: "3x-weekly", vialMg: 500, bacMl: 5, category: "Longevity" },
  kisspeptin: { name: "Kisspeptin-10", reason: "Upstream hormone signaling research", defaultDoseMcg: 100, defaultFrequency: "eod", vialMg: 5, bacMl: 2, category: "Hormone" },
  hcg: { name: "HCG", reason: "Testicular function support research", defaultDoseMcg: 250, defaultFrequency: "twice-weekly", vialMg: 5, bacMl: 5, category: "Hormone" },
  selank: { name: "Selank", reason: "Anxiolytic / cognitive research", defaultDoseMcg: 250, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "Nootropic" },
  semax: { name: "Semax", reason: "Nootropic / neuroprotective research", defaultDoseMcg: 300, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "Nootropic" },
  dsip: { name: "DSIP", reason: "Sleep-regulation research peptide", defaultDoseMcg: 200, defaultFrequency: "daily", vialMg: 5, bacMl: 2, category: "Other" },
  thymosinA1: { name: "Thymosin Alpha-1", reason: "Immune modulation research", defaultDoseMcg: 1600, defaultFrequency: "twice-weekly", vialMg: 5, bacMl: 2, category: "Immune" },
  pt141: { name: "PT-141", reason: "Sexual-health research (PRN)", defaultDoseMcg: 1000, defaultFrequency: "prn", vialMg: 10, bacMl: 2, category: "Sexual Health" },
};

export function recommendStack(input: QuizInput): Recommendation {
  const goals = new Set(input.goals.map((g) => g.toLowerCase()));
  const focus = new Set((input.focusAreas || []).map((f) => f.toLowerCase()));
  const lifestyle = new Set((input.lifestyle || []).map((l) => l.toLowerCase()));

  const picks = new Map<string, RecommendedPeptide>();
  const add = (key: keyof typeof CANDIDATES) => {
    const p = CANDIDATES[key];
    if (p && !picks.has(p.name)) picks.set(p.name, p);
  };

  // Goals
  if (goals.has("fat-loss") || goals.has("weight-loss")) {
    add(input.advanced ? "retatrutide" : "semaglutide");
    if (input.advanced) add("motsC");
  }
  if (goals.has("muscle") || goals.has("lean-mass")) {
    add("cjc1295");
    add("ipamorelin");
  }
  if (goals.has("recovery") || goals.has("injury") || focus.has("joint")) {
    add("bpc157");
    add("tb500");
  }
  if (goals.has("longevity") || goals.has("anti-aging")) {
    add("epithalon");
    add("nad");
  }
  if (goals.has("hormone") || goals.has("hpta") || goals.has("testosterone")) {
    add("kisspeptin");
    if (input.advanced) add("hcg");
  }
  if (goals.has("cognitive") || focus.has("cognitive") || focus.has("focus")) {
    add("semax");
    add("selank");
  }
  if (goals.has("sleep") || focus.has("sleep") || lifestyle.has("low-sleep")) {
    add("dsip");
  }
  if (goals.has("immune") || focus.has("immune")) {
    add("thymosinA1");
  }
  if (goals.has("libido") || focus.has("libido") || goals.has("sexual")) {
    add("pt141");
  }
  if (focus.has("skin") || focus.has("hair")) {
    add("ghkCu");
  }

  // Default: if no goals matched, offer a foundational recovery pair
  if (picks.size === 0) {
    add("bpc157");
    add("ghkCu");
  }

  // Cap by experience
  let cap = 4;
  switch (input.experience) {
    case "none":
    case "beginner":
      cap = 2;
      break;
    case "intermediate":
      cap = 3;
      break;
    case "advanced":
      cap = 4;
      break;
  }
  const peptides = Array.from(picks.values()).slice(0, cap);

  const overview =
    `Based on your selections, this plan includes ${peptides.length} peptide${
      peptides.length === 1 ? "" : "s"
    } over a typical 8-week block. This is a mathematical calculation and scheduling tool only — NOT medical advice.`;

  const phasesWeek = [
    { week: 1, note: "Titration — start low to assess tolerance." },
    { week: 2, note: "Ramp to target dose if tolerated." },
    { week: 4, note: "Mid-cycle check-in — measure progress metrics." },
    { week: 6, note: "Steady-state; review side-effect log." },
    { week: 8, note: "Cycle complete — plan wash-out period." },
  ];

  return { peptides, overview, phasesWeek };
}

import {
  type User,
  type InsertUser,
  users,
  sessions,
  type Session,
  disclaimerAcceptances,
  type DisclaimerAcceptance,
  peptides,
  type Peptide,
  customPeptides,
  type CustomPeptide,
  type InsertCustomPeptide,
  clientProfiles,
  type ClientProfile,
  type InsertClientProfile,
  stacks,
  type Stack,
  type InsertStack,
  stackItems,
  type StackItem,
  type InsertStackItem,
  progressMetrics,
  type ProgressMetric,
  type InsertProgressMetric,
  sideEffects,
  type SideEffect,
  type InsertSideEffect,
  scheduledDoses,
  type ScheduledDose,
  doseLogs,
  type DoseLog,
  userHiddenPeptides,
  type UserHiddenPeptide,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { mkdirSync } from "fs";
import { join } from "path";

// Use persistent volume path on Railway, fallback to local dir in dev
const dataDir = process.env.DATA_DIR || ".";
try { mkdirSync(dataDir, { recursive: true }); } catch {}
const sqlite = new Database(join(dataDir, "data.db"));
sqlite.pragma("journal_mode = WAL");

// Ensure schema exists (simple migration on boot)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  unit_preference TEXT NOT NULL DEFAULT 'auto',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS disclaimer_acceptances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  session_id TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS peptides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  typical_vial_mg REAL NOT NULL,
  recommended_bac_ml REAL NOT NULL,
  typical_dose_mcg_min REAL NOT NULL,
  typical_dose_mcg_max REAL NOT NULL,
  default_frequency TEXT NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS client_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coach_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  dob TEXT,
  height_cm REAL,
  starting_weight_kg REAL,
  goal TEXT NOT NULL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  client_id INTEGER,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stack_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_id INTEGER NOT NULL,
  peptide_id INTEGER,
  custom_name TEXT,
  vial_mg REAL NOT NULL,
  bac_water_ml REAL NOT NULL,
  dose_mcg REAL NOT NULL,
  syringe_type TEXT NOT NULL DEFAULT 'U-100',
  frequency TEXT NOT NULL,
  time_of_day TEXT NOT NULL DEFAULT '08:00',
  duration_days INTEGER NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS progress_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  logged_at TEXT NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  energy_level INTEGER,
  mood INTEGER,
  sleep_hours REAL,
  waist_cm REAL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS side_effects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  logged_at TEXT NOT NULL,
  symptom TEXT NOT NULL,
  severity INTEGER NOT NULL,
  related_peptide_id INTEGER,
  resolved INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS custom_peptides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  typical_vial_mg REAL NOT NULL,
  recommended_bac_ml REAL NOT NULL,
  typical_dose_mcg_min REAL NOT NULL,
  typical_dose_mcg_max REAL NOT NULL,
  default_frequency TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scheduled_doses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stack_item_id INTEGER NOT NULL,
  scheduled_at INTEGER NOT NULL,
  notified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_scheduled_doses_at ON scheduled_doses(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_doses_item ON scheduled_doses(stack_item_id);
CREATE TABLE IF NOT EXISTS dose_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  scheduled_dose_id INTEGER NOT NULL,
  taken_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dose_logs_user ON dose_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_dose_logs_scheduled ON dose_logs(scheduled_dose_id);
CREATE TABLE IF NOT EXISTS user_hidden_peptides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  peptide_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, peptide_id)
);
CREATE INDEX IF NOT EXISTS idx_user_hidden_user ON user_hidden_peptides(user_id);
`);

// Additive migration: ensure new columns exist on older databases
function ensureCol(table: string, name: string, ddl: string) {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === name)) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  } catch (e) {
    console.error(`migration failure ${table}.${name}:`, e);
  }
}
ensureCol("users", "unit_preference", "unit_preference TEXT NOT NULL DEFAULT 'auto'");
ensureCol("users", "reminder_minutes_before", "reminder_minutes_before INTEGER NOT NULL DEFAULT 15");
ensureCol("users", "notify_desktop", "notify_desktop INTEGER NOT NULL DEFAULT 0");
ensureCol("users", "notify_email", "notify_email INTEGER NOT NULL DEFAULT 0");
ensureCol("users", "notify_sms", "notify_sms INTEGER NOT NULL DEFAULT 0");
ensureCol("users", "phone_e164", "phone_e164 TEXT");
ensureCol("users", "push_subscription", "push_subscription TEXT");
ensureCol("stacks", "notifications_enabled", "notifications_enabled INTEGER NOT NULL DEFAULT 1");
ensureCol("stack_items", "schedule_json", "schedule_json TEXT");
// v5 additive migrations
ensureCol("users", "weight_unit", "weight_unit TEXT NOT NULL DEFAULT 'lb'");
ensureCol("users", "height_unit", "height_unit TEXT NOT NULL DEFAULT 'imperial'");
ensureCol("users", "show_client_schedules_on_calendar", "show_client_schedules_on_calendar INTEGER NOT NULL DEFAULT 0");
ensureCol("client_profiles", "color", "color TEXT");
ensureCol("stacks", "share_token", "share_token TEXT");
ensureCol("dose_logs", "status", "status TEXT NOT NULL DEFAULT 'taken'");
ensureCol("dose_logs", "note", "note TEXT");
ensureCol("peptides", "summary", "summary TEXT");
ensureCol("peptides", "pros", "pros TEXT");
ensureCol("peptides", "cons", "cons TEXT");

// Auto-assign colors to any existing clients that don't have one
const CLIENT_COLOR_PALETTE = [
  "#F97316", // orange
  "#06B6D4", // cyan
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#84CC16", // lime
  "#F59E0B", // amber
  "#0EA5E9", // sky
  "#F43F5E", // rose
  "#14B8A6", // teal
  "#6366F1", // indigo
  "#D946EF", // fuchsia
  "#10B981", // emerald
];
function backfillClientColors() {
  try {
    const rows = sqlite.prepare("SELECT id FROM client_profiles WHERE color IS NULL OR color = '' ORDER BY id").all() as { id: number }[];
    for (let i = 0; i < rows.length; i++) {
      const color = CLIENT_COLOR_PALETTE[rows[i].id % CLIENT_COLOR_PALETTE.length];
      sqlite.prepare("UPDATE client_profiles SET color = ? WHERE id = ?").run(color, rows[i].id);
    }
  } catch (e) {
    console.warn("backfill client colors failed:", e);
  }
}
backfillClientColors();
export { CLIENT_COLOR_PALETTE };

export const db = drizzle(sqlite);

// Educational content per peptide. Plain-English, non-prescriptive.
type PeptideContent = { summary: string; pros: string[]; cons: string[] };
const PEPTIDE_CONTENT: Record<string, PeptideContent> = {
  "Semaglutide": {
    summary: "A GLP-1 receptor agonist commonly researched for appetite regulation and metabolic support.",
    pros: ["Well-studied molecule", "Long half-life enables once-weekly dosing", "Strong appetite-reduction effect"],
    cons: ["GI side effects are common during titration", "Slow dose ramp typically required", "Cost can be significant"],
  },
  "Tirzepatide": {
    summary: "Dual GIP/GLP-1 agonist researched for metabolic support and appetite regulation.",
    pros: ["Dual receptor activity", "Strong glycemic and weight effects in trials", "Once-weekly dosing"],
    cons: ["GI adverse events common early", "Titration required", "Higher effective dose ranges"],
  },
  "Retatrutide": {
    summary: "Triple GLP-1 / GIP / glucagon receptor agonist researched for metabolic support.",
    pros: ["Triple pathway activation", "Once-weekly schedule", "Promising trial data"],
    cons: ["Limited long-term human data", "Titration needed", "GI side effects common"],
  },
  "Cagrilintide": {
    summary: "An amylin analog often paired with GLP-1 agonists in metabolic research.",
    pros: ["Complements GLP-1 agonists", "Weekly dosing", "Satiety support"],
    cons: ["Often combined, making effects hard to isolate", "GI effects during titration", "Limited standalone data"],
  },
  "Survodutide": {
    summary: "A dual GLP-1 / glucagon receptor agonist in metabolic research.",
    pros: ["Dual pathway", "Weekly dosing", "Active clinical development"],
    cons: ["Earlier-stage data than Sema/Tirz", "GI side effects reported", "Titration recommended"],
  },
  "BPC-157": {
    summary: "The Body Protective Compound, a synthetic peptide fragment researched for tissue repair.",
    pros: ["Commonly used for soft-tissue research", "Flexible dosing frequency", "Minimal reported acute side effects"],
    cons: ["Limited human trial data", "Short half-life", "Legal/quality varies by region"],
  },
  "TB-500": {
    summary: "A synthetic fragment of Thymosin Beta-4 researched for tissue repair and recovery.",
    pros: ["Long half-life compared with BPC-157", "Twice-weekly is typical", "Researched for connective tissue"],
    cons: ["Limited clinical human data", "Higher effective doses", "Slow onset"],
  },
  "TB-4 Fragment": {
    summary: "An alternative thymosin-derived fragment researched for tissue repair.",
    pros: ["Alternative to full TB-500", "Flexible dosing", "Repair/recovery focus"],
    cons: ["Even thinner evidence base", "Quality varies", "Typically used alongside other agents"],
  },
  "Ipamorelin": {
    summary: "A selective GH secretagogue researched for pulsatile growth-hormone release.",
    pros: ["Selective action", "Short half-life mimics natural pulses", "Typically well-tolerated"],
    cons: ["Requires multiple daily injections for strong effect", "Often paired with a GHRH", "Modest standalone impact"],
  },
  "CJC-1295 (no DAC)": {
    summary: "A short-acting GHRH analog commonly paired with GH secretagogues.",
    pros: ["Synergy with GHRPs like Ipamorelin", "Short pulse profile", "Low cost"],
    cons: ["Requires daily dosing", "Limited effect alone", "Injection frequency"],
  },
  "CJC-1295 (DAC)": {
    summary: "A long-acting GHRH analog with Drug Affinity Complex for sustained exposure.",
    pros: ["Long half-life enables 1-2x/week dosing", "Sustained GH elevation", "Convenient schedule"],
    cons: ["Flattens natural GH pulses", "Potential tachyphylaxis", "Less physiological than non-DAC"],
  },
  "Sermorelin": {
    summary: "A classic GHRH analog researched to promote the body's own GH release.",
    pros: ["Endogenous GH pathway", "Long track record", "Evening dosing pairs with natural rhythm"],
    cons: ["Very short half-life", "Daily injections", "Modest magnitude of effect"],
  },
  "Tesamorelin": {
    summary: "A stabilized GHRH analog with more sustained activity than Sermorelin.",
    pros: ["Longer-acting than Sermorelin", "Studied in clinical populations", "Stable peptide"],
    cons: ["Higher cost", "Daily dosing", "Injection site reactions possible"],
  },
  "Hexarelin": {
    summary: "A potent GHRP researched for strong but short GH pulses.",
    pros: ["Very strong GH response", "Short-acting", "Usable 1-3x/day"],
    cons: ["Cortisol and prolactin effects reported", "Tachyphylaxis with chronic use", "Less selective than Ipamorelin"],
  },
  "GHRP-2": {
    summary: "A ghrelin receptor agonist researched for GH release and appetite.",
    pros: ["Strong GH pulse", "Well-characterized in literature", "Low cost"],
    cons: ["Raises cortisol and prolactin", "Appetite stimulation", "Daily dosing"],
  },
  "GHRP-6": {
    summary: "An older ghrelin agonist with strong appetite effects alongside GH release.",
    pros: ["Strong GH pulses", "Low cost", "Extensively studied"],
    cons: ["Marked appetite increase", "Prolactin/cortisol effects", "Newer options are cleaner"],
  },
  "GHK-Cu": {
    summary: "A copper-binding tripeptide researched for skin, hair, and tissue repair.",
    pros: ["Can be used subcutaneously or topically", "Gentle profile", "Broad cosmetic research"],
    cons: ["Effects are subtle and gradual", "Copper handling considerations", "Limited large-scale trials"],
  },
  "Epithalon": {
    summary: "A synthetic tetrapeptide researched for telomere biology and circadian rhythm.",
    pros: ["Short cycles are common (10-20 days)", "Simple schedule", "Anecdotal sleep support"],
    cons: ["Human data is limited", "Mechanism claims often over-stated", "Quality varies"],
  },
  "Humanin": {
    summary: "A mitochondrially-derived peptide researched for neuroprotection and metabolism.",
    pros: ["Novel mitochondrial pathway", "Researched in longevity contexts", "Active scientific interest"],
    cons: ["Very early human data", "Short half-life", "Limited supplier consistency"],
  },
  "SS-31 (Elamipretide)": {
    summary: "A mitochondrial-targeted peptide researched for bioenergetics and cardiac health.",
    pros: ["Targeted mechanism on mitochondria", "Clinical programs underway", "Researched in several diseases"],
    cons: ["Cost", "Large effective dose range", "Limited broadly-available outcome data"],
  },
  "MOTS-c": {
    summary: "A mitochondrial-derived peptide researched for metabolism and exercise adaptation.",
    pros: ["Unique mitochondrial signaling", "3x/week dosing is typical", "Active research"],
    cons: ["Short half-life", "Limited human trials", "Variable supply quality"],
  },
  "5-Amino-1MQ": {
    summary: "A small molecule researched as an NNMT inhibitor for metabolic support.",
    pros: ["Oral bioavailability possible", "Novel metabolic target", "Preclinical interest in adipose biology"],
    cons: ["Very early data", "Dosing is mg-scale, not mcg", "Quality and purity vary"],
  },
  "Melanotan II": {
    summary: "A non-selective melanocortin agonist researched for pigmentation and libido effects.",
    pros: ["Potent pigmentation effect", "Used at low titrated doses", "Widely available"],
    cons: ["Nausea and flushing are common", "Mole darkening reported", "Non-selective receptor activity"],
  },
  "PT-141": {
    summary: "Bremelanotide, a melanocortin agonist researched for sexual function on a PRN basis.",
    pros: ["PRN use", "Centrally acting mechanism", "FDA-approved form exists"],
    cons: ["Nausea and flushing possible", "Transient blood pressure changes", "Short-duration effect"],
  },
  "Kisspeptin-10": {
    summary: "An upstream regulator of LH/FSH researched for hormone axis support.",
    pros: ["Acts upstream of GnRH", "Short pulse profile", "Active research area"],
    cons: ["Very short half-life", "Limited outcome data", "Dosing protocols still evolving"],
  },
  "HCG": {
    summary: "Human chorionic gonadotropin, used in hormone-support research; dosed in IU.",
    pros: ["Long clinical history", "Supports endogenous testicular function", "Twice-weekly is typical"],
    cons: ["Requires reconstitution care", "Estrogen conversion possible", "Dosed in IU not mcg"],
  },
  "Selank": {
    summary: "A short Russian-developed anxiolytic research peptide, often delivered intranasally.",
    pros: ["Anxiolytic research profile", "Intranasal or SC", "Low reported side effects"],
    cons: ["Limited Western clinical data", "Short half-life", "Effects often subtle"],
  },
  "Semax": {
    summary: "A nootropic research peptide derived from ACTH, often delivered intranasally.",
    pros: ["Nootropic research profile", "Short-course use common", "Low reported side effects"],
    cons: ["Limited Western clinical data", "Short half-life", "Quality varies by source"],
  },
  "DSIP": {
    summary: "Delta Sleep-Inducing Peptide, researched for sleep modulation when dosed pre-sleep.",
    pros: ["Low side-effect profile in research", "Pre-sleep dosing simple", "Small molecule size"],
    cons: ["Evidence is limited", "Variable subjective effects", "Quality varies"],
  },
  "Thymosin Alpha-1": {
    summary: "A thymus-derived peptide researched for immune modulation.",
    pros: ["Well-studied immune pathway", "Twice-weekly schedule", "Clinical history in some regions"],
    cons: ["Cost", "Short half-life", "Slow-building effect"],
  },
  "NAD+": {
    summary: "A nicotinamide adenine dinucleotide precursor researched for cellular energy support.",
    pros: ["Broad cellular metabolism role", "Multiple dosing routes", "Popular in longevity research"],
    cons: ["Injection site reactions common", "Flushing possible", "Durability of effect debated"],
  },
  "Adipotide": {
    summary: "A pro-apoptotic research peptide with strong effects in animal adipose studies.",
    pros: ["Novel mechanism targeting adipose vasculature", "Strong preclinical signals", "Short intended courses"],
    cons: ["Significant toxicity signal in animal studies", "No human safety data", "Strictly research-only"],
  },
};

// Seed peptides — educational/mathematical calculation defaults. NOT medical advice.
// summary/pros/cons are filled in below from PEPTIDE_CONTENT map.
type SeedPeptide = Omit<Peptide, "id" | "summary" | "pros" | "cons">;
const SEED_PEPTIDES: SeedPeptide[] = [
  // GLP-1 / metabolic incretins
  { name: "Semaglutide", category: "GLP-1", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 2400, defaultFrequency: "weekly", notes: "Long-acting GLP-1 agonist. Titrate slowly." },
  { name: "Tirzepatide", category: "GLP-1", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 2500, typicalDoseMcgMax: 15000, defaultFrequency: "weekly", notes: "Dual GIP/GLP-1 agonist. Titrate." },
  { name: "Retatrutide", category: "GLP-1", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 2000, typicalDoseMcgMax: 12000, defaultFrequency: "weekly", notes: "Triple GLP-1/GIP/GCG agonist. ~6d half-life." },
  { name: "Cagrilintide", category: "Metabolic", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 300, typicalDoseMcgMax: 2400, defaultFrequency: "weekly", notes: "Amylin analog. ~7d half-life. Often paired with Sema." },
  { name: "Survodutide", category: "GLP-1", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 600, typicalDoseMcgMax: 4800, defaultFrequency: "weekly", notes: "Dual GLP-1/glucagon agonist." },
  // Healing
  { name: "BPC-157", category: "Healing", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 500, defaultFrequency: "daily", notes: "Body Protective Compound. Often 1–2x/day." },
  { name: "TB-500", category: "Healing", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 2000, typicalDoseMcgMax: 2500, defaultFrequency: "twice-weekly", notes: "Thymosin Beta-4. Loading then weekly." },
  { name: "TB-4 Fragment", category: "Healing", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 2000, typicalDoseMcgMax: 5000, defaultFrequency: "twice-weekly", notes: "Alt to TB-500. Tissue repair research." },
  // GH Secretagogues / Growth
  { name: "Ipamorelin", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 200, typicalDoseMcgMax: 300, defaultFrequency: "daily", notes: "GH secretagogue. 2–3x/day typical." },
  { name: "CJC-1295 (no DAC)", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 100, typicalDoseMcgMax: 100, defaultFrequency: "daily", notes: "Short-acting GHRH. Pairs with Ipamorelin." },
  { name: "CJC-1295 (DAC)", category: "GH Secretagogue", typicalVialMg: 2, recommendedBacMl: 2, typicalDoseMcgMin: 1000, typicalDoseMcgMax: 2000, defaultFrequency: "twice-weekly", notes: "Long-acting GHRH." },
  { name: "Sermorelin", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 200, typicalDoseMcgMax: 500, defaultFrequency: "daily", notes: "GHRH analog." },
  { name: "Tesamorelin", category: "GH Secretagogue", typicalVialMg: 2, recommendedBacMl: 2, typicalDoseMcgMin: 1000, typicalDoseMcgMax: 2000, defaultFrequency: "daily", notes: "Longer-acting GHRH analog." },
  { name: "Hexarelin", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 100, typicalDoseMcgMax: 200, defaultFrequency: "daily", notes: "Strong GHRP; 1–3x/day." },
  { name: "GHRP-2", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 100, typicalDoseMcgMax: 300, defaultFrequency: "daily", notes: "Ghrelin receptor agonist." },
  { name: "GHRP-6", category: "GH Secretagogue", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 100, typicalDoseMcgMax: 300, defaultFrequency: "daily", notes: "Ghrelin receptor agonist. Strong appetite effect." },
  // Anti-aging / Longevity
  { name: "GHK-Cu", category: "Longevity", typicalVialMg: 50, recommendedBacMl: 5, typicalDoseMcgMin: 1000, typicalDoseMcgMax: 2000, defaultFrequency: "daily", notes: "Copper peptide. SC or topical." },
  { name: "Epithalon", category: "Longevity", typicalVialMg: 50, recommendedBacMl: 5, typicalDoseMcgMin: 5000, typicalDoseMcgMax: 10000, defaultFrequency: "daily", notes: "Pineal peptide. Typical 10-day cycles." },
  { name: "Humanin", category: "Longevity", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 1000, defaultFrequency: "daily", notes: "Mito-derived peptide; neuroprotective research." },
  { name: "SS-31 (Elamipretide)", category: "Longevity", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 5000, typicalDoseMcgMax: 40000, defaultFrequency: "daily", notes: "Mitochondrial-targeted peptide." },
  // Mitochondrial / metabolic
  { name: "MOTS-c", category: "Mitochondrial", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 5000, typicalDoseMcgMax: 10000, defaultFrequency: "3x-weekly", notes: "Mitochondrial peptide; ~2h half-life." },
  { name: "5-Amino-1MQ", category: "Metabolic", typicalVialMg: 50, recommendedBacMl: 2, typicalDoseMcgMin: 50000, typicalDoseMcgMax: 150000, defaultFrequency: "daily", notes: "Often oral; some research SC dosing at 5–25mg/day." },
  // Melanocortin / pigmentation / sexual
  { name: "Melanotan II", category: "Melanocortin", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 1000, defaultFrequency: "daily", notes: "Start low to titrate tolerance." },
  { name: "PT-141", category: "Sexual Health", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 1000, typicalDoseMcgMax: 2000, defaultFrequency: "prn", notes: "Bremelanotide. PRN use." },
  { name: "Kisspeptin-10", category: "Hormone", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 50, typicalDoseMcgMax: 200, defaultFrequency: "eod", notes: "Upstream of LH/FSH. Short half-life." },
  { name: "HCG", category: "Hormone", typicalVialMg: 5, recommendedBacMl: 5, typicalDoseMcgMin: 250, typicalDoseMcgMax: 500, defaultFrequency: "twice-weekly", notes: "Dose in IU (typical 250–500 IU); mcg field used for scheduling math only." },
  // Nootropic
  { name: "Selank", category: "Nootropic", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 500, defaultFrequency: "daily", notes: "Anxiolytic research peptide; intranasal or SC." },
  { name: "Semax", category: "Nootropic", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 250, typicalDoseMcgMax: 600, defaultFrequency: "daily", notes: "Nootropic research peptide; intranasal or SC." },
  { name: "DSIP", category: "Other", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 100, typicalDoseMcgMax: 300, defaultFrequency: "daily", notes: "Delta Sleep-Inducing Peptide. Pre-sleep dosing." },
  // Immune
  { name: "Thymosin Alpha-1", category: "Immune", typicalVialMg: 5, recommendedBacMl: 2, typicalDoseMcgMin: 1600, typicalDoseMcgMax: 1600, defaultFrequency: "twice-weekly", notes: "Immune modulator; ~2h half-life." },
  // NAD+ / other
  { name: "NAD+", category: "Longevity", typicalVialMg: 500, recommendedBacMl: 5, typicalDoseMcgMin: 50000, typicalDoseMcgMax: 200000, defaultFrequency: "3x-weekly", notes: "NAD+ precursor. Injection site reactions common." },
  // Research
  { name: "Adipotide", category: "Other", typicalVialMg: 10, recommendedBacMl: 2, typicalDoseMcgMin: 1000, typicalDoseMcgMax: 2000, defaultFrequency: "daily", notes: "Research-only; significant toxicity signal in animal studies." },
];

function seedPeptides() {
  const existing = db.select().from(peptides).all();
  const existingNames = new Set(existing.map((p) => p.name));
  for (const p of SEED_PEPTIDES) {
    if (existingNames.has(p.name)) continue;
    try {
      const content = PEPTIDE_CONTENT[p.name];
      db.insert(peptides).values({
        ...p,
        summary: content?.summary ?? null,
        pros: content ? JSON.stringify(content.pros) : null,
        cons: content ? JSON.stringify(content.cons) : null,
      } as any).run();
    } catch (e) {
      console.warn(`seed peptide ${p.name} failed:`, e);
    }
  }
  // Backfill summary/pros/cons for existing rows that don't have them
  for (const name of Object.keys(PEPTIDE_CONTENT)) {
    try {
      const content = PEPTIDE_CONTENT[name];
      sqlite.prepare(
        "UPDATE peptides SET summary = COALESCE(summary, ?), pros = COALESCE(pros, ?), cons = COALESCE(cons, ?) WHERE name = ?"
      ).run(content.summary, JSON.stringify(content.pros), JSON.stringify(content.cons), name);
    } catch (e) {
      console.warn(`backfill content for ${name} failed:`, e);
    }
  }
}
seedPeptides();

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, passwordHash: string, displayName: string): Promise<User>;
  updateUserTier(id: number, tier: string): Promise<User | undefined>;
  updateUserUnitPreference(id: number, pref: string): Promise<User | undefined>;
  updateUserProfile(id: number, patch: Partial<User>): Promise<User | undefined>;
  updateUserNotifications(
    id: number,
    patch: {
      reminderMinutesBefore?: number;
      notifyDesktop?: number;
      notifyEmail?: number;
      notifySms?: number;
      phoneE164?: string | null;
      pushSubscription?: string | null;
    },
  ): Promise<User | undefined>;
  replaceScheduledDoses(stackItemId: number, timestamps: number[]): Promise<void>;
  listScheduledDosesForItem(stackItemId: number): Promise<ScheduledDose[]>;

  createSession(deviceId: string, userId?: number): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  attachSessionUser(sessionId: string, userId: number): Promise<void>;
  deleteSession(id: string): Promise<void>;

  recordDisclaimer(sessionId: string, userId: number | null, version: string): Promise<DisclaimerAcceptance>;
  hasAcceptedDisclaimer(sessionId: string, userId: number | null, version: string): Promise<boolean>;

  listPeptides(): Promise<Peptide[]>;

  // Custom peptides
  listCustomPeptides(userId: number): Promise<CustomPeptide[]>;
  createCustomPeptide(userId: number, data: InsertCustomPeptide): Promise<CustomPeptide>;
  deleteCustomPeptide(id: number, userId: number): Promise<boolean>;

  // Clients
  listClients(coachId: number): Promise<ClientProfile[]>;
  getClient(id: number): Promise<ClientProfile | undefined>;
  createClient(coachId: number, data: InsertClientProfile): Promise<ClientProfile>;
  updateClient(id: number, data: Partial<InsertClientProfile>): Promise<ClientProfile | undefined>;
  deleteClient(id: number): Promise<void>;

  // Stacks
  listStacks(ownerId: number, clientId?: number): Promise<Stack[]>;
  getStack(id: number): Promise<Stack | undefined>;
  createStack(ownerId: number, data: InsertStack): Promise<Stack>;
  updateStack(id: number, data: Partial<InsertStack>): Promise<Stack | undefined>;
  deleteStack(id: number): Promise<void>;

  // Stack items
  listStackItems(stackId: number): Promise<StackItem[]>;
  createStackItem(data: InsertStackItem): Promise<StackItem>;
  updateStackItem(id: number, data: Partial<InsertStackItem>): Promise<StackItem | undefined>;
  deleteStackItem(id: number): Promise<void>;

  // Progress metrics
  listMetrics(clientId: number): Promise<ProgressMetric[]>;
  createMetric(data: InsertProgressMetric): Promise<ProgressMetric>;
  updateMetric(id: number, data: Partial<InsertProgressMetric>): Promise<ProgressMetric | undefined>;
  deleteMetric(id: number): Promise<void>;

  // Side effects
  listSideEffects(clientId: number): Promise<SideEffect[]>;
  createSideEffect(data: InsertSideEffect): Promise<SideEffect>;
  updateSideEffect(id: number, data: Partial<InsertSideEffect>): Promise<SideEffect | undefined>;
  deleteSideEffect(id: number): Promise<void>;

  // Dose logs (doses marked taken or skipped by user)
  listDoseLogsForUser(userId: number, since?: number): Promise<DoseLog[]>;
  createDoseLog(userId: number, scheduledDoseId: number, status?: string, note?: string | null, takenAt?: number): Promise<DoseLog>;
  deleteDoseLog(id: number, userId: number): Promise<boolean>;

  // Clone a stack to a client (v5)
  cloneStackToClient(stackId: number, ownerId: number, clientId: number): Promise<Stack | null>;
  ensureStackShareToken(stackId: number, ownerId: number): Promise<string>;
  regenerateStackShareToken(stackId: number, ownerId: number): Promise<string>;
  getStackByShareToken(token: string): Promise<Stack | undefined>;

  // Hidden peptides (user preference to hide from pickers)
  listHiddenPeptideIds(userId: number): Promise<number[]>;
  hidePeptide(userId: number, peptideId: number): Promise<UserHiddenPeptide>;
  unhidePeptide(userId: number, peptideId: number): Promise<boolean>;

  // Upcoming doses for user — joins scheduled_doses→stack_items→stacks→peptides
  getUpcomingDosesForUser(userId: number, fromMs: number, toMs: number, opts?: { includeInactive?: boolean; includeClientStacks?: boolean }): Promise<Array<{
    id: number;
    scheduledAt: number;
    stackItemId: number;
    stackId: number;
    stackName: string;
    peptideName: string;
    doseMcg: number;
    clientId: number | null;
    clientColor: string | null;
    clientName: string | null;
    isActive: number;
    taken: boolean;
    doseLogStatus: string | null;
    doseLogId: number | null;
  }>>;
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  async createUser(email: string, passwordHash: string, displayName: string) {
    return db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        displayName,
        tier: "free",
        createdAt: Date.now(),
      })
      .returning()
      .get();
  }
  async updateUserTier(id: number, tier: string) {
    return db.update(users).set({ tier }).where(eq(users.id, id)).returning().get();
  }
  async updateUserUnitPreference(id: number, pref: string) {
    return db.update(users).set({ unitPreference: pref }).where(eq(users.id, id)).returning().get();
  }
  async updateUserProfile(id: number, patch: Partial<User>) {
    return db.update(users).set(patch as any).where(eq(users.id, id)).returning().get();
  }

  async createSession(deviceId: string, userId?: number) {
    const id = randomBytes(24).toString("hex");
    const now = Date.now();
    return db
      .insert(sessions)
      .values({
        id,
        userId: userId ?? null,
        deviceId,
        createdAt: now,
        expiresAt: now + 1000 * 60 * 60 * 24 * 30,
      })
      .returning()
      .get();
  }
  async getSession(id: string) {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  }
  async attachSessionUser(sessionId: string, userId: number) {
    db.update(sessions).set({ userId }).where(eq(sessions.id, sessionId)).run();
  }
  async deleteSession(id: string) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  async recordDisclaimer(sessionId: string, userId: number | null, version: string) {
    return db
      .insert(disclaimerAcceptances)
      .values({
        sessionId,
        userId: userId ?? null,
        version,
        acceptedAt: Date.now(),
      })
      .returning()
      .get();
  }
  async hasAcceptedDisclaimer(sessionId: string, userId: number | null, version: string) {
    const row = db
      .select()
      .from(disclaimerAcceptances)
      .where(
        and(
          eq(disclaimerAcceptances.version, version),
          userId
            ? eq(disclaimerAcceptances.userId, userId)
            : eq(disclaimerAcceptances.sessionId, sessionId),
        ),
      )
      .get();
    return !!row;
  }

  async listPeptides() {
    return db.select().from(peptides).all();
  }

  async listCustomPeptides(userId: number) {
    return db
      .select()
      .from(customPeptides)
      .where(eq(customPeptides.userId, userId))
      .orderBy(customPeptides.name)
      .all();
  }
  async createCustomPeptide(userId: number, data: InsertCustomPeptide) {
    return db
      .insert(customPeptides)
      .values({ ...data, userId, createdAt: Date.now() })
      .returning()
      .get();
  }
  async deleteCustomPeptide(id: number, userId: number) {
    const existing = db
      .select()
      .from(customPeptides)
      .where(and(eq(customPeptides.id, id), eq(customPeptides.userId, userId)))
      .get();
    if (!existing) return false;
    db.delete(customPeptides).where(eq(customPeptides.id, id)).run();
    return true;
  }

  async listClients(coachId: number) {
    return db
      .select()
      .from(clientProfiles)
      .where(and(eq(clientProfiles.coachId, coachId), eq(clientProfiles.archived, 0)))
      .all();
  }
  async getClient(id: number) {
    return db.select().from(clientProfiles).where(eq(clientProfiles.id, id)).get();
  }
  async createClient(coachId: number, data: InsertClientProfile) {
    return db
      .insert(clientProfiles)
      .values({ ...data, coachId, archived: 0, createdAt: Date.now() })
      .returning()
      .get();
  }
  async updateClient(id: number, data: Partial<InsertClientProfile>) {
    return db.update(clientProfiles).set(data).where(eq(clientProfiles.id, id)).returning().get();
  }
  async deleteClient(id: number) {
    db.delete(clientProfiles).where(eq(clientProfiles.id, id)).run();
  }

  async listStacks(ownerId: number, clientId?: number) {
    if (clientId !== undefined) {
      return db
        .select()
        .from(stacks)
        .where(and(eq(stacks.ownerId, ownerId), eq(stacks.clientId, clientId)))
        .all();
    }
    return db.select().from(stacks).where(eq(stacks.ownerId, ownerId)).orderBy(desc(stacks.createdAt)).all();
  }
  async getStack(id: number) {
    return db.select().from(stacks).where(eq(stacks.id, id)).get();
  }
  async createStack(ownerId: number, data: InsertStack) {
    return db
      .insert(stacks)
      .values({ ...data, ownerId, isActive: 1, createdAt: Date.now() })
      .returning()
      .get();
  }
  async updateStack(id: number, data: Partial<InsertStack>) {
    return db.update(stacks).set(data).where(eq(stacks.id, id)).returning().get();
  }
  async deleteStack(id: number) {
    const itemRows = db.select().from(stackItems).where(eq(stackItems.stackId, id)).all();
    for (const it of itemRows) {
      db.delete(scheduledDoses).where(eq(scheduledDoses.stackItemId, it.id)).run();
    }
    db.delete(stackItems).where(eq(stackItems.stackId, id)).run();
    db.delete(stacks).where(eq(stacks.id, id)).run();
  }

  async listStackItems(stackId: number) {
    return db.select().from(stackItems).where(eq(stackItems.stackId, stackId)).all();
  }
  async createStackItem(data: InsertStackItem) {
    return db.insert(stackItems).values(data).returning().get();
  }
  async updateStackItem(id: number, data: Partial<InsertStackItem>) {
    return db.update(stackItems).set(data).where(eq(stackItems.id, id)).returning().get();
  }
  async deleteStackItem(id: number) {
    db.delete(scheduledDoses).where(eq(scheduledDoses.stackItemId, id)).run();
    db.delete(stackItems).where(eq(stackItems.id, id)).run();
  }

  // Scheduled doses
  async replaceScheduledDoses(stackItemId: number, timestamps: number[]) {
    db.delete(scheduledDoses).where(eq(scheduledDoses.stackItemId, stackItemId)).run();
    if (timestamps.length === 0) return;
    const insert = sqlite.prepare(
      "INSERT INTO scheduled_doses (stack_item_id, scheduled_at, notified_at) VALUES (?, ?, NULL)",
    );
    const tx = sqlite.transaction((rows: number[]) => {
      for (const t of rows) insert.run(stackItemId, t);
    });
    tx(timestamps);
  }
  async listScheduledDosesForItem(stackItemId: number): Promise<ScheduledDose[]> {
    return db
      .select()
      .from(scheduledDoses)
      .where(eq(scheduledDoses.stackItemId, stackItemId))
      .orderBy(scheduledDoses.scheduledAt)
      .all();
  }
  async updateUserNotifications(
    id: number,
    patch: {
      reminderMinutesBefore?: number;
      notifyDesktop?: number;
      notifyEmail?: number;
      notifySms?: number;
      phoneE164?: string | null;
      pushSubscription?: string | null;
    },
  ) {
    return db.update(users).set(patch).where(eq(users.id, id)).returning().get();
  }

  async listMetrics(clientId: number) {
    return db
      .select()
      .from(progressMetrics)
      .where(eq(progressMetrics.clientId, clientId))
      .orderBy(progressMetrics.loggedAt)
      .all();
  }
  async createMetric(data: InsertProgressMetric) {
    return db.insert(progressMetrics).values(data).returning().get();
  }
  async updateMetric(id: number, data: Partial<InsertProgressMetric>) {
    return db.update(progressMetrics).set(data).where(eq(progressMetrics.id, id)).returning().get();
  }
  async deleteMetric(id: number) {
    db.delete(progressMetrics).where(eq(progressMetrics.id, id)).run();
  }

  async listSideEffects(clientId: number) {
    return db
      .select()
      .from(sideEffects)
      .where(eq(sideEffects.clientId, clientId))
      .orderBy(desc(sideEffects.loggedAt))
      .all();
  }
  async createSideEffect(data: InsertSideEffect) {
    return db.insert(sideEffects).values(data).returning().get();
  }
  async updateSideEffect(id: number, data: Partial<InsertSideEffect>) {
    return db.update(sideEffects).set(data).where(eq(sideEffects.id, id)).returning().get();
  }
  async deleteSideEffect(id: number) {
    db.delete(sideEffects).where(eq(sideEffects.id, id)).run();
  }

  // Dose logs
  async listDoseLogsForUser(userId: number, since?: number) {
    if (since !== undefined) {
      return db
        .select()
        .from(doseLogs)
        .where(and(eq(doseLogs.userId, userId), sql`${doseLogs.takenAt} >= ${since}`))
        .orderBy(desc(doseLogs.takenAt))
        .all();
    }
    return db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.userId, userId))
      .orderBy(desc(doseLogs.takenAt))
      .all();
  }
  async createDoseLog(userId: number, scheduledDoseId: number, status: string = "taken", note: string | null = null, takenAt?: number) {
    const now = Date.now();
    const safeStatus = status === "skipped" ? "skipped" : "taken";
    // De-dup: if already logged for this scheduled dose by this user, update & return
    const existing = db
      .select()
      .from(doseLogs)
      .where(and(eq(doseLogs.userId, userId), eq(doseLogs.scheduledDoseId, scheduledDoseId)))
      .get();
    if (existing) {
      return db
        .update(doseLogs)
        .set({ status: safeStatus, note, takenAt: takenAt ?? now })
        .where(eq(doseLogs.id, existing.id))
        .returning()
        .get();
    }
    return db
      .insert(doseLogs)
      .values({ userId, scheduledDoseId, takenAt: takenAt ?? now, status: safeStatus, note, createdAt: now })
      .returning()
      .get();
  }
  async deleteDoseLog(id: number, userId: number) {
    const res = db
      .delete(doseLogs)
      .where(and(eq(doseLogs.id, id), eq(doseLogs.userId, userId)))
      .run();
    return res.changes > 0;
  }

  // Hidden peptides
  async listHiddenPeptideIds(userId: number) {
    const rows = db
      .select({ peptideId: userHiddenPeptides.peptideId })
      .from(userHiddenPeptides)
      .where(eq(userHiddenPeptides.userId, userId))
      .all();
    return rows.map((r) => r.peptideId);
  }
  async hidePeptide(userId: number, peptideId: number) {
    const now = Date.now();
    const existing = db
      .select()
      .from(userHiddenPeptides)
      .where(and(eq(userHiddenPeptides.userId, userId), eq(userHiddenPeptides.peptideId, peptideId)))
      .get();
    if (existing) return existing;
    return db
      .insert(userHiddenPeptides)
      .values({ userId, peptideId, createdAt: now })
      .returning()
      .get();
  }
  async unhidePeptide(userId: number, peptideId: number) {
    const res = db
      .delete(userHiddenPeptides)
      .where(and(eq(userHiddenPeptides.userId, userId), eq(userHiddenPeptides.peptideId, peptideId)))
      .run();
    return res.changes > 0;
  }

  // Upcoming doses (raw SQL join for simplicity)
  async getUpcomingDosesForUser(
    userId: number,
    fromMs: number,
    toMs: number,
    opts?: { includeInactive?: boolean; includeClientStacks?: boolean },
  ) {
    const includeInactive = opts?.includeInactive === true;
    const includeClientStacks = opts?.includeClientStacks === true;
    const activeFilter = includeInactive ? "" : " AND s.is_active = 1 ";
    const clientFilter = includeClientStacks ? "" : " AND s.client_id IS NULL ";
    const rows = sqlite
      .prepare(
        `SELECT
           sd.id AS id,
           sd.scheduled_at AS scheduledAt,
           sd.stack_item_id AS stackItemId,
           si.stack_id AS stackId,
           s.name AS stackName,
           s.client_id AS clientId,
           s.is_active AS isActive,
           cp.color AS clientColor,
           cp.full_name AS clientName,
           COALESCE(p.name, si.custom_name, 'Peptide') AS peptideName,
           si.dose_mcg AS doseMcg,
           dl.id AS doseLogId,
           dl.status AS doseLogStatus
         FROM scheduled_doses sd
         JOIN stack_items si ON si.id = sd.stack_item_id
         JOIN stacks s ON s.id = si.stack_id
         LEFT JOIN client_profiles cp ON cp.id = s.client_id
         LEFT JOIN peptides p ON p.id = si.peptide_id
         LEFT JOIN dose_logs dl ON dl.scheduled_dose_id = sd.id AND dl.user_id = ?
         WHERE s.owner_id = ?
           ${activeFilter}
           ${clientFilter}
           AND sd.scheduled_at >= ?
           AND sd.scheduled_at < ?
         ORDER BY sd.scheduled_at ASC`,
      )
      .all(userId, userId, fromMs, toMs) as Array<{
        id: number;
        scheduledAt: number;
        stackItemId: number;
        stackId: number;
        stackName: string;
        clientId: number | null;
        clientColor: string | null;
        clientName: string | null;
        isActive: number;
        peptideName: string;
        doseMcg: number;
        doseLogId: number | null;
        doseLogStatus: string | null;
      }>;
    return rows.map((r) => ({
      ...r,
      taken: r.doseLogId !== null && r.doseLogStatus !== "skipped",
    }));
  }

  // Clone a stack and its items to a client
  async cloneStackToClient(stackId: number, ownerId: number, clientId: number): Promise<Stack | null> {
    const src = db.select().from(stacks).where(and(eq(stacks.id, stackId), eq(stacks.ownerId, ownerId))).get();
    if (!src) return null;
    const client = db.select().from(clientProfiles).where(eq(clientProfiles.id, clientId)).get();
    if (!client || client.coachId !== ownerId) return null;
    const newStack = db
      .insert(stacks)
      .values({
        ownerId,
        clientId,
        name: `${src.name} (for ${client.fullName})`,
        startDate: new Date().toISOString().slice(0, 10),
        durationWeeks: src.durationWeeks,
        isActive: 1,
        notificationsEnabled: src.notificationsEnabled,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    const items = db.select().from(stackItems).where(eq(stackItems.stackId, stackId)).all();
    for (const it of items) {
      const newItem = db
        .insert(stackItems)
        .values({
          stackId: newStack.id,
          peptideId: it.peptideId,
          customName: it.customName,
          vialMg: it.vialMg,
          bacWaterMl: it.bacWaterMl,
          doseMcg: it.doseMcg,
          syringeType: it.syringeType,
          frequency: it.frequency,
          timeOfDay: it.timeOfDay,
          durationDays: it.durationDays,
          notes: it.notes,
          scheduleJson: it.scheduleJson,
        })
        .returning()
        .get();
      // regenerate scheduled doses for new item using same schedule, new start date
      const srcDoses = db.select().from(scheduledDoses).where(eq(scheduledDoses.stackItemId, it.id)).all();
      const offset = new Date(newStack.startDate).getTime() - new Date(src.startDate).getTime();
      if (srcDoses.length) {
        const insertStmt = sqlite.prepare("INSERT INTO scheduled_doses (stack_item_id, scheduled_at, notified_at) VALUES (?, ?, NULL)");
        const tx = sqlite.transaction(() => {
          for (const d of srcDoses) insertStmt.run(newItem.id, d.scheduledAt + offset);
        });
        tx();
      }
    }
    return newStack;
  }

  async ensureStackShareToken(stackId: number, ownerId: number) {
    const existing = db.select().from(stacks).where(and(eq(stacks.id, stackId), eq(stacks.ownerId, ownerId))).get();
    if (!existing) throw new Error("not_found");
    if (existing.shareToken) return existing.shareToken;
    const token = randomBytes(16).toString("hex");
    db.update(stacks).set({ shareToken: token }).where(eq(stacks.id, stackId)).run();
    return token;
  }

  async regenerateStackShareToken(stackId: number, ownerId: number) {
    const existing = db.select().from(stacks).where(and(eq(stacks.id, stackId), eq(stacks.ownerId, ownerId))).get();
    if (!existing) throw new Error("not_found");
    const token = randomBytes(16).toString("hex");
    db.update(stacks).set({ shareToken: token }).where(eq(stacks.id, stackId)).run();
    return token;
  }

  async getStackByShareToken(token: string): Promise<Stack | undefined> {
    return db.select().from(stacks).where(eq(stacks.shareToken, token)).get();
  }
}

export const storage = new DatabaseStorage();

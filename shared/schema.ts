import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  tier: text("tier").notNull().default("free"),
  unitPreference: text("unit_preference").notNull().default("auto"),
  weightUnit: text("weight_unit").notNull().default("lb"),
  heightUnit: text("height_unit").notNull().default("imperial"),
  showClientSchedulesOnCalendar: integer("show_client_schedules_on_calendar").notNull().default(0),
  reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(15),
  notifyDesktop: integer("notify_desktop").notNull().default(0),
  notifyEmail: integer("notify_email").notNull().default(0),
  notifySms: integer("notify_sms").notNull().default(0),
  phoneE164: text("phone_e164"),
  pushSubscription: text("push_subscription"),
  createdAt: integer("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
  tier: true,
  unitPreference: true,
});

export const UNIT_PREFERENCES = ["auto", "mcg", "mg"] as const;
export type UnitPreference = typeof UNIT_PREFERENCES[number];

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id"),
  deviceId: text("device_id").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Disclaimer acceptances
export const disclaimerAcceptances = sqliteTable("disclaimer_acceptances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  sessionId: text("session_id").notNull(),
  version: text("version").notNull(),
  acceptedAt: integer("accepted_at").notNull(),
});

export type DisclaimerAcceptance = typeof disclaimerAcceptances.$inferSelect;

// Peptides
export const peptides = sqliteTable("peptides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  typicalVialMg: real("typical_vial_mg").notNull(),
  recommendedBacMl: real("recommended_bac_ml").notNull(),
  typicalDoseMcgMin: real("typical_dose_mcg_min").notNull(),
  typicalDoseMcgMax: real("typical_dose_mcg_max").notNull(),
  defaultFrequency: text("default_frequency").notNull(),
  notes: text("notes"),
  summary: text("summary"),
  pros: text("pros"), // JSON array
  cons: text("cons"), // JSON array
});

export type Peptide = typeof peptides.$inferSelect;

// Custom peptides (per-user)
export const customPeptides = sqliteTable("custom_peptides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  typicalVialMg: real("typical_vial_mg").notNull(),
  recommendedBacMl: real("recommended_bac_ml").notNull(),
  typicalDoseMcgMin: real("typical_dose_mcg_min").notNull(),
  typicalDoseMcgMax: real("typical_dose_mcg_max").notNull(),
  defaultFrequency: text("default_frequency").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const insertCustomPeptideSchema = createInsertSchema(customPeptides).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertCustomPeptide = z.infer<typeof insertCustomPeptideSchema>;
export type CustomPeptide = typeof customPeptides.$inferSelect;

// Client profiles
export const clientProfiles = sqliteTable("client_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  coachId: integer("coach_id").notNull(),
  fullName: text("full_name").notNull(),
  gender: text("gender").notNull(),
  dob: text("dob"),
  heightCm: real("height_cm"),
  startingWeightKg: real("starting_weight_kg"),
  goal: text("goal").notNull(),
  notes: text("notes"),
  color: text("color"),
  archived: integer("archived").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertClientProfileSchema = createInsertSchema(clientProfiles).omit({
  id: true,
  createdAt: true,
  coachId: true,
  archived: true,
});
export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfiles.$inferSelect;

// Stacks
export const stacks = sqliteTable("stacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id").notNull(),
  clientId: integer("client_id"),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  isActive: integer("is_active").notNull().default(1),
  notificationsEnabled: integer("notifications_enabled").notNull().default(1),
  shareToken: text("share_token"),
  createdAt: integer("created_at").notNull(),
});

export const insertStackSchema = createInsertSchema(stacks).omit({
  id: true,
  createdAt: true,
  ownerId: true,
  isActive: true,
  shareToken: true,
});
export type InsertStack = z.infer<typeof insertStackSchema>;
export type Stack = typeof stacks.$inferSelect;

// Stack items
export const stackItems = sqliteTable("stack_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stackId: integer("stack_id").notNull(),
  peptideId: integer("peptide_id"),
  customName: text("custom_name"),
  vialMg: real("vial_mg").notNull(),
  bacWaterMl: real("bac_water_ml").notNull(),
  doseMcg: real("dose_mcg").notNull(),
  syringeType: text("syringe_type").notNull().default("U-100"),
  frequency: text("frequency").notNull(),
  timeOfDay: text("time_of_day").notNull().default("08:00"),
  durationDays: integer("duration_days").notNull(),
  notes: text("notes"),
  scheduleJson: text("schedule_json"),
});

// Scheduled individual doses (expanded from schedule spec)
export const scheduledDoses = sqliteTable("scheduled_doses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stackItemId: integer("stack_item_id").notNull(),
  scheduledAt: integer("scheduled_at").notNull(), // unix ms
  notifiedAt: integer("notified_at"), // null if not sent
});
export type ScheduledDose = typeof scheduledDoses.$inferSelect;

// Dose logs — records when a user marks a dose as taken or skipped
export const doseLogs = sqliteTable("dose_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  scheduledDoseId: integer("scheduled_dose_id").notNull(),
  takenAt: integer("taken_at").notNull(), // unix ms
  status: text("status").notNull().default("taken"), // 'taken' | 'skipped'
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});
export type DoseLog = typeof doseLogs.$inferSelect;

// User-hidden peptides — lets users hide stock peptides they don't use
export const userHiddenPeptides = sqliteTable("user_hidden_peptides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  peptideId: integer("peptide_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
export type UserHiddenPeptide = typeof userHiddenPeptides.$inferSelect;

// Schedule spec stored in stack_items.scheduleJson
export type ScheduleType =
  | "daily"
  | "eod"
  | "days-of-week"
  | "times-per-week"
  | "weekly"
  | "custom-interval"
  | "prn";

export interface ScheduleSpec {
  type: ScheduleType;
  daysOfWeek?: number[]; // 0-6 (Sun-Sat)
  timesPerWeek?: number; // 1-7
  timesOfDay: string[]; // HH:MM
  intervalDays?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // optional explicit end
  durationWeeks?: number; // alt to endDate
}

export const insertStackItemSchema = createInsertSchema(stackItems).omit({
  id: true,
});
export type InsertStackItem = z.infer<typeof insertStackItemSchema>;
export type StackItem = typeof stackItems.$inferSelect;

// Progress metrics
export const progressMetrics = sqliteTable("progress_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  loggedAt: text("logged_at").notNull(),
  weightKg: real("weight_kg"),
  bodyFatPct: real("body_fat_pct"),
  energyLevel: integer("energy_level"),
  mood: integer("mood"),
  sleepHours: real("sleep_hours"),
  waistCm: real("waist_cm"),
  notes: text("notes"),
});

export const insertProgressMetricSchema = createInsertSchema(progressMetrics).omit({
  id: true,
});
export type InsertProgressMetric = z.infer<typeof insertProgressMetricSchema>;
export type ProgressMetric = typeof progressMetrics.$inferSelect;

// Side effects
export const sideEffects = sqliteTable("side_effects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull(),
  loggedAt: text("logged_at").notNull(),
  symptom: text("symptom").notNull(),
  severity: integer("severity").notNull(),
  relatedPeptideId: integer("related_peptide_id"),
  resolved: integer("resolved").notNull().default(0),
  notes: text("notes"),
});

export const insertSideEffectSchema = createInsertSchema(sideEffects).omit({
  id: true,
});
export type InsertSideEffect = z.infer<typeof insertSideEffectSchema>;
export type SideEffect = typeof sideEffects.$inferSelect;

export const DISCLAIMER_VERSION = "2026-04-17-v1";
export const DISCLAIMER_TEXT =
  "This application is a MATHEMATICAL CALCULATION AND SCHEDULING TOOL ONLY. It is NOT medical advice, diagnosis, or treatment. You MUST consult a licensed medical professional before using any peptide, medication, or supplement. The developers make no warranties regarding accuracy, safety, or suitability. You assume all risk and agree to hold the developers harmless from any and all claims, damages, or liabilities. By continuing, you confirm you are 18+ and agree to these terms.";

// Register (auth) schema
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

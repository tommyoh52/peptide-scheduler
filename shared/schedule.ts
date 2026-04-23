// Schedule computation utilities — pure JS, no DB. Used by both client (preview) and server (generation).
import type { ScheduleSpec, ScheduleType } from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface GenerateOptions {
  maxDoses?: number; // safety cap
}

function parseYmd(s: string): Date {
  // Interpret as local date at midnight
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function computeEndDate(spec: ScheduleSpec): Date {
  const start = parseYmd(spec.startDate);
  if (spec.endDate) return parseYmd(spec.endDate);
  const weeks = spec.durationWeeks ?? 8;
  return addDays(start, weeks * 7 - 1);
}

/**
 * Evenly-spread days of week for "times per week": spread across Mon..Sun.
 * e.g. 3 → [1, 3, 5] (Mon Wed Fri); 5 → [1, 2, 4, 5, 6] (Mon Tue Thu Fri Sat)
 */
export function spreadDaysForTimesPerWeek(n: number): number[] {
  if (n <= 0) return [];
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  // Standard spread patterns
  const patterns: Record<number, number[]> = {
    1: [1], // Mon
    2: [1, 4], // Mon Thu
    3: [1, 3, 5], // Mon Wed Fri
    4: [1, 2, 4, 5], // Mon Tue Thu Fri
    5: [1, 2, 4, 5, 6], // Mon Tue Thu Fri Sat
    6: [1, 2, 3, 4, 5, 6], // Mon-Sat
  };
  return patterns[n] ?? [];
}

/**
 * Generate dose timestamps (unix ms) for a given spec.
 * PRN returns [] (no scheduled entries).
 */
export function generateDoses(
  spec: ScheduleSpec,
  options: GenerateOptions = {},
): number[] {
  if (spec.type === "prn") return [];
  const start = parseYmd(spec.startDate);
  const end = computeEndDate(spec);
  const times = spec.timesOfDay && spec.timesOfDay.length > 0 ? spec.timesOfDay : ["09:00"];
  const maxDoses = options.maxDoses ?? 5000;
  const out: number[] = [];

  function dayMatches(d: Date): boolean {
    switch (spec.type) {
      case "daily":
        return true;
      case "eod": {
        const daysSinceStart = Math.round((d.getTime() - start.getTime()) / DAY_MS);
        return daysSinceStart % 2 === 0;
      }
      case "days-of-week":
        return !!spec.daysOfWeek?.includes(d.getDay());
      case "times-per-week": {
        const days = spreadDaysForTimesPerWeek(spec.timesPerWeek ?? 0);
        return days.includes(d.getDay());
      }
      case "weekly": {
        // Use first day in daysOfWeek[0] or fallback to start's day
        const target =
          spec.daysOfWeek && spec.daysOfWeek.length > 0 ? spec.daysOfWeek[0] : start.getDay();
        return d.getDay() === target;
      }
      case "custom-interval": {
        const every = spec.intervalDays && spec.intervalDays > 0 ? spec.intervalDays : 1;
        const daysSinceStart = Math.round((d.getTime() - start.getTime()) / DAY_MS);
        return daysSinceStart % every === 0;
      }
      default:
        return false;
    }
  }

  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    if (!dayMatches(d)) continue;
    for (const t of times) {
      const [hh, mm] = t.split(":").map((n) => parseInt(n, 10) || 0);
      const dose = new Date(d);
      dose.setHours(hh, mm, 0, 0);
      out.push(dose.getTime());
      if (out.length >= maxDoses) return out;
    }
  }
  return out;
}

export interface SummaryResult {
  totalDoses: number;
  perWeekText: string;
  daysText: string;
  timesText: string;
  durationText: string;
  fullSentence: string;
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(":").map((n) => parseInt(n, 10) || 0);
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export function summarizeSchedule(spec: ScheduleSpec): SummaryResult {
  const times = spec.timesOfDay && spec.timesOfDay.length > 0 ? spec.timesOfDay : ["09:00"];
  const start = parseYmd(spec.startDate);
  const end = computeEndDate(spec);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const doseTimes = generateDoses(spec, { maxDoses: 10000 });
  const totalDoses = doseTimes.length;

  let daysText = "";
  let perWeekText = "";
  const t = spec.type as ScheduleType;
  switch (t) {
    case "daily":
      daysText = "every day";
      perWeekText = `7 days per week × ${times.length} time${times.length > 1 ? "s" : ""}`;
      break;
    case "eod":
      daysText = "every other day";
      perWeekText = `~3.5 days per week × ${times.length} time${times.length > 1 ? "s" : ""}`;
      break;
    case "days-of-week": {
      const dow = spec.daysOfWeek ?? [];
      const sorted = [...dow].sort();
      daysText = sorted.map((i) => DAY_LABELS[i]).join("/") || "(pick days)";
      perWeekText = `${sorted.length} day${sorted.length !== 1 ? "s" : ""} per week`;
      break;
    }
    case "times-per-week": {
      const n = spec.timesPerWeek ?? 0;
      const autoDays = spreadDaysForTimesPerWeek(n);
      daysText = autoDays.map((i) => DAY_LABELS[i]).join("/");
      perWeekText = `${n} day${n !== 1 ? "s" : ""} per week`;
      break;
    }
    case "weekly": {
      const target = spec.daysOfWeek && spec.daysOfWeek.length ? spec.daysOfWeek[0] : start.getDay();
      daysText = `every ${DAY_LABELS[target]}`;
      perWeekText = `1 day per week`;
      break;
    }
    case "custom-interval": {
      const every = spec.intervalDays && spec.intervalDays > 0 ? spec.intervalDays : 1;
      daysText = every === 1 ? "every day" : `every ${every} days`;
      perWeekText = `~${(7 / every).toFixed(1)} days per week`;
      break;
    }
    case "prn":
      daysText = "as needed";
      perWeekText = "PRN";
      break;
  }

  const timesText = times.map(formatTime12).join(", ");
  let durationText = "";
  if (spec.type === "prn") {
    durationText = "";
  } else if (spec.endDate) {
    durationText = `through ${spec.endDate}`;
  } else if (spec.durationWeeks) {
    durationText = `for ${spec.durationWeeks} week${spec.durationWeeks !== 1 ? "s" : ""}`;
  } else {
    durationText = `${totalDays} days`;
  }

  let fullSentence: string;
  if (spec.type === "prn") {
    fullSentence = "As-needed (PRN) — no fixed schedule. Reminders disabled.";
  } else {
    fullSentence = `${totalDoses} total dose${totalDoses !== 1 ? "s" : ""}, ${daysText} at ${timesText} ${durationText}`.trim();
  }

  return { totalDoses, perWeekText, daysText, timesText, durationText, fullSentence };
}

// Map schedule spec type → legacy `frequency` column value (for backward compat)
export function scheduleTypeToLegacyFrequency(spec: ScheduleSpec): string {
  switch (spec.type) {
    case "daily":
      return "daily";
    case "eod":
      return "eod";
    case "weekly":
      return "weekly";
    case "days-of-week":
    case "times-per-week":
    case "custom-interval":
      return "custom";
    case "prn":
      return "prn";
    default:
      return "daily";
  }
}

// Legacy frequency → minimal ScheduleSpec (for ICS of old stacks without scheduleJson)
export function legacyFrequencyToSpec(
  frequency: string,
  timeOfDay: string,
  startDate: string,
  durationDays: number,
): ScheduleSpec {
  const dwMap: Record<string, Partial<ScheduleSpec>> = {
    daily: { type: "daily" },
    eod: { type: "eod" },
    weekly: { type: "weekly" },
    "twice-weekly": { type: "times-per-week", timesPerWeek: 2 },
    "3x-weekly": { type: "times-per-week", timesPerWeek: 3 },
    prn: { type: "prn" },
  };
  const durationWeeks = Math.max(1, Math.ceil(durationDays / 7));
  return {
    type: "daily",
    timesOfDay: [timeOfDay || "09:00"],
    startDate,
    durationWeeks,
    ...(dwMap[frequency] ?? { type: "daily" }),
  } as ScheduleSpec;
}

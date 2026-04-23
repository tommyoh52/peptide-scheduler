import { db } from "../storage";
import {
  scheduledDoses,
  stackItems,
  stacks,
  users,
  peptides,
  doseLogs,
  type User,
} from "@shared/schema";
import { and, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { log } from "./log";
import { sendPush, isPushConfigured } from "./push";
import { sendEmail, isEmailConfigured } from "./email";
import { sendSms, isSmsConfigured } from "./sms";
import { calcUnitsForRow, formatDoseMcg } from "./formatting";

// Runs every RUN_INTERVAL_MS and looks for doses that need to fire a reminder.
// For each user, doses that fall within [now + userMinutes, now + userMinutes + 2 min)
// and have notifiedAt IS NULL are sent, then marked.

const RUN_INTERVAL_MS = 60 * 1000;
const WINDOW_MS = 2 * 60 * 1000; // 2 min look-ahead window to avoid missing ticks

let timer: NodeJS.Timeout | null = null;

export function startReminderLoop() {
  if (timer) return;
  // Run once on boot, then every minute
  tick().catch((e) => console.error("reminder tick error:", e));
  timer = setInterval(() => {
    tick().catch((e) => console.error("reminder tick error:", e));
  }, RUN_INTERVAL_MS);
  log(
    `reminders: loop started (interval ${RUN_INTERVAL_MS / 1000}s). ` +
      `push=${isPushConfigured()} email=${isEmailConfigured()} sms=${isSmsConfigured()}`,
    "reminders",
  );
}

async function tick() {
  const now = Date.now();
  // Pull candidate doses: unsent, within a broad window (next 70 minutes).
  // We then filter per-user by their reminderMinutesBefore.
  const candidates = db
    .select({
      doseId: scheduledDoses.id,
      scheduledAt: scheduledDoses.scheduledAt,
      notifiedAt: scheduledDoses.notifiedAt,
      stackItemId: scheduledDoses.stackItemId,
      stackId: stackItems.stackId,
      peptideId: stackItems.peptideId,
      customName: stackItems.customName,
      vialMg: stackItems.vialMg,
      bacWaterMl: stackItems.bacWaterMl,
      doseMcg: stackItems.doseMcg,
      syringeType: stackItems.syringeType,
      stackName: stacks.name,
      stackNotificationsEnabled: stacks.notificationsEnabled,
      stackIsActive: stacks.isActive,
      ownerId: stacks.ownerId,
    })
    .from(scheduledDoses)
    .leftJoin(stackItems, eq(stackItems.id, scheduledDoses.stackItemId))
    .leftJoin(stacks, eq(stacks.id, stackItems.stackId))
    .where(
      and(
        isNull(scheduledDoses.notifiedAt),
        gte(scheduledDoses.scheduledAt, now),
        lte(scheduledDoses.scheduledAt, now + 70 * 60 * 1000),
        eq(stacks.isActive, 1),
      ),
    )
    .all();

  // Load all skipped dose_log entries for these dose IDs; we'll filter candidates out
  const candidateIds = candidates.map((c) => c.doseId);
  const skippedSet = new Set<number>();
  if (candidateIds.length > 0) {
    const skipped = db
      .select({ scheduledDoseId: doseLogs.scheduledDoseId, status: doseLogs.status })
      .from(doseLogs)
      .all();
    for (const s of skipped) {
      if (s.status === "skipped" && candidateIds.includes(s.scheduledDoseId)) {
        skippedSet.add(s.scheduledDoseId);
      }
    }
  }

  if (candidates.length === 0) return;

  // Per-user cache
  const userCache = new Map<number, User | undefined>();
  async function getUser(id: number): Promise<User | undefined> {
    if (userCache.has(id)) return userCache.get(id);
    const u = db.select().from(users).where(eq(users.id, id)).get();
    userCache.set(id, u);
    return u;
  }

  for (const row of candidates) {
    if (!row.stackNotificationsEnabled) continue;
    if (!row.stackIsActive) continue;
    if (skippedSet.has(row.doseId)) continue;
    if (row.ownerId == null) continue;
    const user = await getUser(row.ownerId);
    if (!user) continue;
    const leadMs = (user.reminderMinutesBefore ?? 15) * 60 * 1000;
    const fireAt = row.scheduledAt - leadMs;
    if (fireAt > now + WINDOW_MS) continue; // not yet
    if (fireAt < now - WINDOW_MS) {
      // Overdue — mark as notified to avoid repeated noise and skip.
      db.update(scheduledDoses)
        .set({ notifiedAt: now })
        .where(eq(scheduledDoses.id, row.doseId))
        .run();
      continue;
    }

    // Peptide name
    let peptideName = row.customName ?? "Peptide";
    if (row.peptideId) {
      const p = db.select().from(peptides).where(eq(peptides.id, row.peptideId)).get();
      if (p) peptideName = p.name;
    }

    const units = calcUnitsForRow({
      vialMg: row.vialMg ?? 0,
      bacWaterMl: row.bacWaterMl ?? 0,
      doseMcg: row.doseMcg ?? 0,
      syringeType: (row.syringeType as any) ?? "U-100",
    });
    const doseDisplay = formatDoseMcg(row.doseMcg ?? 0);
    const hhmm = new Date(row.scheduledAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const minutesText = `${user.reminderMinutesBefore ?? 15} min`;
    const title = `Reminder: ${peptideName} dose in ${minutesText}`;
    const body = `${peptideName} ${doseDisplay} · pull to ${units.toFixed(1)} units (${row.syringeType}) · ${row.stackName} at ${hhmm}. Not medical advice.`;

    // Desktop push
    if (user.notifyDesktop && user.pushSubscription && isPushConfigured()) {
      try {
        await sendPush(user.pushSubscription, { title, body, url: "/#/stacks" });
      } catch (e) {
        console.error("push send failed:", e);
      }
    }
    // Email
    if (user.notifyEmail && isEmailConfigured()) {
      try {
        await sendEmail({
          to: user.email,
          subject: title,
          text:
            `${peptideName} ${doseDisplay} dose is due at ${hhmm}.\n\n` +
            `Pull to ${units.toFixed(1)} units on a ${row.syringeType} syringe.\n` +
            `Stack: ${row.stackName}\n\n` +
            `— This is a reminder from your Peptide Calculator tool. It is NOT medical advice. ` +
            `Consult your physician before any injection.`,
          html:
            `<p><strong>${peptideName} ${doseDisplay}</strong> dose is due at <strong>${hhmm}</strong>.</p>` +
            `<p>Pull to <strong>${units.toFixed(1)} units</strong> on a ${row.syringeType} syringe.</p>` +
            `<p>Stack: ${row.stackName}</p>` +
            `<hr><p style="color:#888;font-size:12px">This is a reminder from your Peptide Calculator tool. It is NOT medical advice. Consult your physician before any injection.</p>`,
        });
      } catch (e) {
        console.error("email send failed:", e);
      }
    }
    // SMS
    if (user.notifySms && user.phoneE164 && isSmsConfigured()) {
      try {
        await sendSms({
          to: user.phoneE164,
          body: `Peptide reminder: ${peptideName} ${doseDisplay} dose due at ${hhmm}. Pull to ${units.toFixed(1)} units on ${row.syringeType}. Not medical advice.`,
        });
      } catch (e) {
        console.error("sms send failed:", e);
      }
    }

    // Mark notified
    db.update(scheduledDoses)
      .set({ notifiedAt: Date.now() })
      .where(eq(scheduledDoses.id, row.doseId))
      .run();
  }
}

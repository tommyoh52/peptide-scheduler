import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import {
  DISCLAIMER_VERSION,
  insertClientProfileSchema,
  insertCustomPeptideSchema,
  insertProgressMetricSchema,
  insertSideEffectSchema,
  insertStackItemSchema,
  insertStackSchema,
  loginSchema,
  registerSchema,
  UNIT_PREFERENCES,
  type ScheduleSpec,
} from "@shared/schema";
import { generateDoses, legacyFrequencyToSpec } from "@shared/schedule";
import { getVapidPublicKey, isPushConfigured } from "./lib/push";
import { isEmailConfigured } from "./lib/email";
import { isSmsConfigured } from "./lib/sms";
import { recommendStack, type QuizInput } from "./lib/stackRecommender";

// Augment Express Request
declare module "express-serve-static-core" {
  interface Request {
    sessionData?: {
      id: string;
      userId: number | null;
      deviceId: string;
    };
    user?: {
      id: number;
      email: string;
      displayName: string;
      tier: string;
      unitPreference: string;
      weightUnit: string;
      heightUnit: string;
      showClientSchedulesOnCalendar: number;
    };
  }
}

async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const tokenHeader = req.headers["x-session-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (token) {
    const session = await storage.getSession(token);
    if (session && session.expiresAt > Date.now()) {
      req.sessionData = {
        id: session.id,
        userId: session.userId,
        deviceId: session.deviceId,
      };
      if (session.userId) {
        const user = await storage.getUserById(session.userId);
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            tier: user.tier,
            unitPreference: user.unitPreference ?? "auto",
            weightUnit: (user as any).weightUnit ?? "lb",
            heightUnit: (user as any).heightUnit ?? "imperial",
            showClientSchedulesOnCalendar: (user as any).showClientSchedulesOnCalendar ?? 0,
          };
        }
      }
    }
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (req.user.tier !== "pro") return res.status(403).json({ error: "pro_required" });
  next();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(sessionMiddleware);

  // ===== Session bootstrap =====
  app.post("/api/session/init", async (req, res) => {
    const { deviceId: providedDeviceId } = req.body ?? {};
    const deviceId = providedDeviceId || randomBytes(16).toString("hex");
    const session = await storage.createSession(deviceId);
    const hasAccepted = await storage.hasAcceptedDisclaimer(session.id, null, DISCLAIMER_VERSION);
    res.json({
      sessionToken: session.id,
      deviceId,
      disclaimerAccepted: hasAccepted,
      disclaimerVersion: DISCLAIMER_VERSION,
    });
  });

  app.get("/api/session/me", async (req, res) => {
    if (!req.sessionData) {
      return res.json({ user: null, disclaimerAccepted: false });
    }
    const hasAccepted = await storage.hasAcceptedDisclaimer(
      req.sessionData.id,
      req.user?.id ?? null,
      DISCLAIMER_VERSION,
    );
    res.json({
      user: req.user ?? null,
      sessionId: req.sessionData.id,
      disclaimerAccepted: hasAccepted,
      disclaimerVersion: DISCLAIMER_VERSION,
      unitPreference: req.user?.unitPreference ?? "auto",
    });
  });

  // ===== Disclaimer =====
  app.post("/api/disclaimer/accept", async (req, res) => {
    if (!req.sessionData) return res.status(400).json({ error: "no_session" });
    const { version } = req.body ?? {};
    if (version !== DISCLAIMER_VERSION) {
      return res.status(400).json({ error: "version_mismatch", expected: DISCLAIMER_VERSION });
    }
    const acc = await storage.recordDisclaimer(req.sessionData.id, req.user?.id ?? null, version);
    res.json({ ok: true, acceptance: acc });
  });

  // ===== Auth =====
  app.post("/api/auth/register", async (req, res) => {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const { email, password, displayName } = parse.data;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "email_taken" });
    const hash = await bcrypt.hash(password, 10);
    const user = await storage.createUser(email, hash, displayName);
    // Create session
    const session = await storage.createSession(
      req.sessionData?.deviceId ?? randomBytes(16).toString("hex"),
      user.id,
    );
    res.json({
      sessionToken: session.id,
      user: { id: user.id, email: user.email, displayName: user.displayName, tier: user.tier, unitPreference: user.unitPreference ?? "auto" },
      requireDisclaimer: true,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid" });
    const { email, password } = parse.data;
    const user = await storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
    const session = await storage.createSession(
      req.sessionData?.deviceId ?? randomBytes(16).toString("hex"),
      user.id,
    );
    res.json({
      sessionToken: session.id,
      user: { id: user.id, email: user.email, displayName: user.displayName, tier: user.tier, unitPreference: user.unitPreference ?? "auto" },
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (req.sessionData) {
      await storage.deleteSession(req.sessionData.id);
    }
    res.json({ ok: true });
  });

  app.post("/api/auth/upgrade", requireAuth, async (req, res) => {
    const updated = await storage.updateUserTier(req.user!.id, "pro");
    res.json({ user: updated });
  });

  // Update user preferences (unit preference)
  app.patch("/api/me", requireAuth, async (req, res) => {
    const { unitPreference, weightUnit, heightUnit, showClientSchedulesOnCalendar } = req.body ?? {};
    const patch: any = {};
    if (unitPreference !== undefined) {
      if (!UNIT_PREFERENCES.includes(unitPreference)) {
        return res.status(400).json({ error: "invalid_unit_preference" });
      }
      patch.unitPreference = unitPreference;
    }
    if (weightUnit !== undefined) {
      if (weightUnit !== "lb" && weightUnit !== "kg") {
        return res.status(400).json({ error: "invalid_weight_unit" });
      }
      patch.weightUnit = weightUnit;
    }
    if (heightUnit !== undefined) {
      if (heightUnit !== "imperial" && heightUnit !== "metric") {
        return res.status(400).json({ error: "invalid_height_unit" });
      }
      patch.heightUnit = heightUnit;
    }
    if (showClientSchedulesOnCalendar !== undefined) {
      patch.showClientSchedulesOnCalendar = showClientSchedulesOnCalendar ? 1 : 0;
    }
    if (Object.keys(patch).length === 0) {
      return res.json({ user: req.user });
    }
    const updated = await storage.updateUserProfile(req.user!.id, patch);
    res.json({
      user: updated
        ? {
            id: updated.id,
            email: updated.email,
            displayName: updated.displayName,
            tier: updated.tier,
            unitPreference: updated.unitPreference,
            weightUnit: updated.weightUnit,
            heightUnit: updated.heightUnit,
            showClientSchedulesOnCalendar: updated.showClientSchedulesOnCalendar,
          }
        : null,
    });
  });

  app.post("/api/auth/downgrade", requireAuth, async (req, res) => {
    const updated = await storage.updateUserTier(req.user!.id, "free");
    res.json({ user: updated });
  });

  // ===== Peptides =====
  app.get("/api/peptides", async (_req, res) => {
    const list = await storage.listPeptides();
    res.json(list);
  });

  // ===== Custom peptides (user-owned) =====
  app.get("/api/custom-peptides", requireAuth, async (req, res) => {
    const list = await storage.listCustomPeptides(req.user!.id);
    res.json(list);
  });

  app.post("/api/custom-peptides", requireAuth, async (req, res) => {
    const parse = insertCustomPeptideSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    }
    const created = await storage.createCustomPeptide(req.user!.id, parse.data);
    res.json(created);
  });

  app.delete("/api/custom-peptides/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteCustomPeptide(id, req.user!.id);
    if (!ok) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  // ===== Clients (pro) =====
  app.get("/api/clients", requirePro, async (req, res) => {
    const list = await storage.listClients(req.user!.id);
    res.json(list);
  });

  app.get("/api/clients/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    const c = await storage.getClient(id);
    if (!c || c.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    res.json(c);
  });

  app.post("/api/clients", requirePro, async (req, res) => {
    const parse = insertClientProfileSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const created = await storage.createClient(req.user!.id, parse.data);
    res.json(created);
  });

  app.patch("/api/clients/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getClient(id);
    if (!existing || existing.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const updated = await storage.updateClient(id, req.body);
    res.json(updated);
  });

  app.delete("/api/clients/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getClient(id);
    if (!existing || existing.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    await storage.deleteClient(id);
    res.json({ ok: true });
  });

  // ===== Stacks =====
  app.get("/api/stacks", requireAuth, async (req, res) => {
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const list = await storage.listStacks(req.user!.id, clientId);
    res.json(list);
  });

  app.get("/api/stacks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const stack = await storage.getStack(id);
    if (!stack || stack.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const items = await storage.listStackItems(id);
    res.json({ ...stack, items });
  });

  app.post("/api/stacks", requireAuth, async (req, res) => {
    const parse = insertStackSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const created = await storage.createStack(req.user!.id, parse.data);
    res.json(created);
  });

  app.patch("/api/stacks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getStack(id);
    if (!existing || existing.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const updated = await storage.updateStack(id, req.body);
    res.json(updated);
  });

  app.delete("/api/stacks/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getStack(id);
    if (!existing || existing.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    await storage.deleteStack(id);
    res.json({ ok: true });
  });

  // ===== Stack items =====
  app.post("/api/stack-items", requireAuth, async (req, res) => {
    const parse = insertStackItemSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const stack = await storage.getStack(parse.data.stackId);
    if (!stack || stack.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const created = await storage.createStackItem(parse.data);
    await regenerateDosesForItem(created.id, parse.data.scheduleJson ?? null, {
      frequency: parse.data.frequency ?? "daily",
      timeOfDay: parse.data.timeOfDay ?? "08:00",
      startDate: stack.startDate,
      durationDays: parse.data.durationDays ?? 28,
    });
    res.json(created);
  });

  app.patch("/api/stack-items/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateStackItem(id, req.body);
    if (updated) {
      const parentStack = await storage.getStack(updated.stackId);
      await regenerateDosesForItem(id, updated.scheduleJson ?? null, {
        frequency: updated.frequency,
        timeOfDay: updated.timeOfDay,
        startDate: parentStack?.startDate ?? new Date().toISOString().slice(0, 10),
        durationDays: updated.durationDays,
      });
    }
    res.json(updated);
  });

  app.delete("/api/stack-items/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteStackItem(id);
    res.json({ ok: true });
  });

  // ===== Scheduled doses (read-only) =====
  app.get("/api/stack-items/:id/doses", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const doses = await storage.listScheduledDosesForItem(id);
    res.json(doses);
  });

  // ===== Notifications config & settings =====
  app.get("/api/notifications/config", (_req, res) => {
    res.json({
      desktopAvailable: isPushConfigured(),
      emailAvailable: isEmailConfigured(),
      smsAvailable: isSmsConfigured(),
      vapidPublicKey: getVapidPublicKey(),
    });
  });

  app.get("/api/push/vapid-public-key", (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.get("/api/me/notifications", requireAuth, async (req, res) => {
    const u = await storage.getUserById(req.user!.id);
    if (!u) return res.status(404).json({ error: "not_found" });
    res.json({
      reminderMinutesBefore: u.reminderMinutesBefore ?? 15,
      notifyDesktop: !!u.notifyDesktop,
      notifyEmail: !!u.notifyEmail,
      notifySms: !!u.notifySms,
      phoneE164: u.phoneE164 ?? null,
      hasPushSubscription: !!u.pushSubscription,
    });
  });

  app.patch("/api/me/notifications", requireAuth, async (req, res) => {
    const {
      reminderMinutesBefore,
      notifyDesktop,
      notifyEmail,
      notifySms,
      phoneE164,
    } = req.body ?? {};
    const patch: any = {};
    if (reminderMinutesBefore !== undefined) {
      const n = Number(reminderMinutesBefore);
      if (![0, 5, 15, 30, 60].includes(n)) return res.status(400).json({ error: "invalid_minutes" });
      patch.reminderMinutesBefore = n;
    }
    if (notifyDesktop !== undefined) patch.notifyDesktop = notifyDesktop ? 1 : 0;
    if (notifyEmail !== undefined) patch.notifyEmail = notifyEmail ? 1 : 0;
    if (notifySms !== undefined) patch.notifySms = notifySms ? 1 : 0;
    if (phoneE164 !== undefined) {
      if (phoneE164 && !/^\+\d{7,15}$/.test(phoneE164)) {
        return res.status(400).json({ error: "invalid_phone" });
      }
      patch.phoneE164 = phoneE164 || null;
    }
    const updated = await storage.updateUserNotifications(req.user!.id, patch);
    res.json({ ok: true, user: updated });
  });

  app.post("/api/push/subscribe", requireAuth, async (req, res) => {
    const { subscription } = req.body ?? {};
    if (!subscription) return res.status(400).json({ error: "invalid" });
    await storage.updateUserNotifications(req.user!.id, {
      pushSubscription: JSON.stringify(subscription),
      notifyDesktop: 1,
    });
    res.json({ ok: true });
  });

  app.post("/api/push/unsubscribe", requireAuth, async (req, res) => {
    await storage.updateUserNotifications(req.user!.id, {
      pushSubscription: null,
      notifyDesktop: 0,
    });
    res.json({ ok: true });
  });

  // ===== Progress metrics (Pro) =====
  app.get("/api/clients/:id/metrics", requirePro, async (req, res) => {
    const clientId = Number(req.params.id);
    const client = await storage.getClient(clientId);
    if (!client || client.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const list = await storage.listMetrics(clientId);
    res.json(list);
  });

  app.post("/api/metrics", requirePro, async (req, res) => {
    const parse = insertProgressMetricSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const client = await storage.getClient(parse.data.clientId);
    if (!client || client.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const created = await storage.createMetric(parse.data);
    res.json(created);
  });

  app.patch("/api/metrics/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateMetric(id, req.body);
    res.json(updated);
  });

  app.delete("/api/metrics/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteMetric(id);
    res.json({ ok: true });
  });

  // ===== Side effects (Pro) =====
  app.get("/api/clients/:id/side-effects", requirePro, async (req, res) => {
    const clientId = Number(req.params.id);
    const client = await storage.getClient(clientId);
    if (!client || client.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const list = await storage.listSideEffects(clientId);
    res.json(list);
  });

  app.post("/api/side-effects", requirePro, async (req, res) => {
    const parse = insertSideEffectSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
    const client = await storage.getClient(parse.data.clientId);
    if (!client || client.coachId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const created = await storage.createSideEffect(parse.data);
    res.json(created);
  });

  app.patch("/api/side-effects/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateSideEffect(id, req.body);
    res.json(updated);
  });

  app.delete("/api/side-effects/:id", requirePro, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteSideEffect(id);
    res.json({ ok: true });
  });

  // ---------- Dose logs ----------
  app.get("/api/dose-logs", requireAuth, async (req, res) => {
    const since = req.query.since ? Number(req.query.since) : undefined;
    const logs = await storage.listDoseLogsForUser(req.user!.id, since);
    res.json(logs);
  });
  app.post("/api/dose-logs", requireAuth, async (req, res) => {
    const scheduledDoseId = Number(req.body?.scheduledDoseId);
    if (!scheduledDoseId) return res.status(400).json({ error: "scheduledDoseId required" });
    const takenAt = req.body?.takenAt ? Number(req.body.takenAt) : undefined;
    const status = req.body?.status === "skipped" ? "skipped" : "taken";
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    const log = await storage.createDoseLog(req.user!.id, scheduledDoseId, status, note, takenAt);
    res.json(log);
  });
  app.delete("/api/dose-logs/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteDoseLog(id, req.user!.id);
    res.json({ ok });
  });

  // ---------- Hidden peptides ----------
  app.get("/api/hidden-peptides", requireAuth, async (req, res) => {
    const ids = await storage.listHiddenPeptideIds(req.user!.id);
    res.json(ids);
  });
  app.post("/api/hidden-peptides", requireAuth, async (req, res) => {
    const peptideId = Number(req.body?.peptideId);
    if (!peptideId) return res.status(400).json({ error: "peptideId required" });
    const row = await storage.hidePeptide(req.user!.id, peptideId);
    res.json(row);
  });
  app.delete("/api/hidden-peptides/:peptideId", requireAuth, async (req, res) => {
    const peptideId = Number(req.params.peptideId);
    const ok = await storage.unhidePeptide(req.user!.id, peptideId);
    res.json({ ok });
  });

  // ---------- My upcoming doses (for ticker / today card) ----------
  app.get("/api/my-doses", requireAuth, async (req, res) => {
    const from = req.query.from ? Number(req.query.from) : Date.now();
    const to = req.query.to ? Number(req.query.to) : from + 7 * 24 * 3600 * 1000;
    const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const includeClientStacks = req.query.includeClientStacks === "1" || req.query.includeClientStacks === "true";
    const doses = await storage.getUpcomingDosesForUser(req.user!.id, from, to, {
      includeInactive,
      includeClientStacks,
    });
    res.json(doses);
  });

  // ---------- Stack sharing & clone-to-client ----------
  app.post("/api/stacks/:id/clone-to-client", requirePro, async (req, res) => {
    const stackId = Number(req.params.id);
    const clientId = Number(req.body?.clientId);
    if (!stackId || !clientId) return res.status(400).json({ error: "stackId and clientId required" });
    try {
      const cloned = await storage.cloneStackToClient(stackId, req.user!.id, clientId);
      res.json(cloned);
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "clone_failed" });
    }
  });

  app.post("/api/stacks/:id/share-token", requireAuth, async (req, res) => {
    const stackId = Number(req.params.id);
    const stack = await storage.getStack(stackId);
    if (!stack || stack.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const token = await storage.ensureStackShareToken(stackId, req.user!.id);
    res.json({ token });
  });

  app.post("/api/stacks/:id/share-token/regenerate", requireAuth, async (req, res) => {
    const stackId = Number(req.params.id);
    const stack = await storage.getStack(stackId);
    if (!stack || stack.ownerId !== req.user!.id) return res.status(404).json({ error: "not_found" });
    const token = await storage.regenerateStackShareToken(stackId, req.user!.id);
    res.json({ token });
  });

  // Public handout — no auth; exposes a read-only view of a stack via share token
  app.get("/api/handout/:token", async (req, res) => {
    const token = String(req.params.token);
    const data = await storage.getStackByShareToken(token);
    if (!data) return res.status(404).json({ error: "not_found" });
    res.json(data);
  });

  // ---------- Quiz recommender ----------
  app.post("/api/quiz/recommend", async (req, res) => {
    const body = (req.body ?? {}) as Partial<QuizInput>;
    const input: QuizInput = {
      goals: Array.isArray(body.goals) ? body.goals.map(String) : [],
      focusAreas: Array.isArray(body.focusAreas) ? body.focusAreas.map(String) : [],
      experience: typeof body.experience === "string" ? body.experience : "beginner",
      lifestyle: Array.isArray(body.lifestyle) ? body.lifestyle.map(String) : [],
      advanced: body.advanced === true,
    };
    const rec = recommendStack(input);
    res.json(rec);
  });

  return httpServer;
}

// Regenerate scheduled_doses for a given stack item based on its schedule spec
// (or a fallback legacy spec derived from the old frequency/timeOfDay columns).
async function regenerateDosesForItem(
  stackItemId: number,
  scheduleJson: string | null,
  fallback: {
    frequency: string;
    timeOfDay: string;
    startDate: string;
    durationDays: number;
  },
) {
  let spec: ScheduleSpec | null = null;
  if (scheduleJson) {
    try {
      spec = JSON.parse(scheduleJson) as ScheduleSpec;
    } catch {
      spec = null;
    }
  }
  if (!spec) {
    spec = legacyFrequencyToSpec(
      fallback.frequency,
      fallback.timeOfDay,
      fallback.startDate,
      fallback.durationDays,
    );
  }
  const timestamps = generateDoses(spec);
  await storage.replaceScheduledDoses(stackItemId, timestamps);
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Crown, LogOut, Bell, AlertTriangle, Eye, EyeOff, FlaskConical } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useUnitPreference } from "@/lib/unit-preference";
import type { UnitPreference } from "@/lib/units";

export default function AccountPage() {
  const { user, refetchMe, logout } = useSession();
  const { preference, setPreference } = useUnitPreference();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="px-4 md:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-muted-foreground mb-4">You are not signed in.</p>
        <Button onClick={() => setLocation("/auth")} data-testid="button-go-auth">
          Sign in
        </Button>
      </div>
    );
  }

  async function handleUpgrade() {
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/upgrade");
      await refetchMe();
      queryClient.invalidateQueries();
      setCheckoutOpen(false);
      toast({ title: "Welcome to Pro", description: "Client management is unlocked." });
    } catch (e: any) {
      toast({ title: "Upgrade failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDowngrade() {
    setBusy(true);
    try {
      await apiRequest("POST", "/api/auth/downgrade");
      await refetchMe();
      queryClient.invalidateQueries();
      toast({ title: "Downgraded to Free" });
    } catch (e: any) {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setLocation("/");
  }

  return (
    <div className="px-4 md:px-8 py-10 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and subscription.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-semibold">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-lg" data-testid="text-account-name">{user.displayName}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <div className="mt-1">
                <Badge variant={user.tier === "pro" ? "default" : "secondary"} data-testid="badge-account-tier">
                  {user.tier === "pro" ? <><Crown className="h-3 w-3 mr-1" /> Pro</> : "Free"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.tier === "free" ? (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Pro unlocks</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Unlimited client profiles</li>
                  <li>Interactive progress charts</li>
                  <li>Side-effect tracking</li>
                  <li>Priority updates</li>
                </ul>
              </div>
              <Button onClick={() => setCheckoutOpen(true)} data-testid="button-upgrade">
                Upgrade to Pro
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                You are on the Pro plan. All features unlocked.
              </p>
              <Button variant="outline" onClick={handleDowngrade} disabled={busy} data-testid="button-downgrade">
                Downgrade to Free
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Dose units</div>
            <p className="text-xs text-muted-foreground mb-3">
              Auto shows mg when the value is 1000 mcg or more.
            </p>
            <RadioGroup
              value={preference}
              onValueChange={async (v) => {
                await setPreference(v as UnitPreference);
                toast({ title: "Preference updated" });
              }}
              className="grid gap-2"
              data-testid="radio-unit-preference"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="unit-auto" data-testid="radio-unit-auto" />
                <Label htmlFor="unit-auto" className="font-normal cursor-pointer">
                  Auto (smart)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mcg" id="unit-mcg" data-testid="radio-unit-mcg" />
                <Label htmlFor="unit-mcg" className="font-normal cursor-pointer">
                  Always mcg
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mg" id="unit-mg" data-testid="radio-unit-mg" />
                <Label htmlFor="unit-mg" className="font-normal cursor-pointer">
                  Always mg
                </Label>
              </div>
            </RadioGroup>
          </div>

          <BodyUnitsAndCalendarPrefs />
        </CardContent>
      </Card>

      <NotificationsSection />

      <ManagePeptidesSection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleLogout} data-testid="button-account-logout">
            <LogOut className="h-4 w-4 mr-2" /> Log out
          </Button>
        </CardContent>
      </Card>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent data-testid="dialog-checkout">
          <DialogHeader>
            <DialogTitle>Mock checkout</DialogTitle>
            <DialogDescription>
              This demo skips payment. Click below to instantly activate Pro for testing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={busy} data-testid="button-confirm-upgrade">
              {busy ? "Activating…" : "Activate Pro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications section (push / email / sms)
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationsConfig {
  desktopAvailable: boolean;
  emailAvailable: boolean;
  smsAvailable: boolean;
  vapidPublicKey?: string;
}

interface UserNotifications {
  reminderMinutesBefore: number;
  notifyDesktop: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  phoneE164: string | null;
  hasPushSubscription: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function NotificationsSection() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  const { data: config } = useQuery<NotificationsConfig>({
    queryKey: ["/api/notifications/config"],
  });
  const { data: prefs } = useQuery<UserNotifications>({
    queryKey: ["/api/me/notifications"],
  });

  const [reminderMinutes, setReminderMinutes] = useState<number>(15);
  const [notifyDesktop, setNotifyDesktop] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySms, setNotifySms] = useState(false);
  const [phoneE164, setPhoneE164] = useState("");

  useEffect(() => {
    if (prefs) {
      setReminderMinutes(prefs.reminderMinutesBefore ?? 15);
      setNotifyDesktop(!!prefs.notifyDesktop);
      setNotifyEmail(!!prefs.notifyEmail);
      setNotifySms(!!prefs.notifySms);
      setPhoneE164(prefs.phoneE164 ?? "");
    }
  }, [prefs]);

  async function savePrefs(patch: Partial<UserNotifications>) {
    const payload: any = { ...patch };
    await apiRequest("PATCH", "/api/me/notifications", payload);
    queryClient.invalidateQueries({ queryKey: ["/api/me/notifications"] });
  }

  async function handleToggleDesktop(next: boolean) {
    if (!next) {
      setNotifyDesktop(false);
      try {
        setBusy(true);
        await apiRequest("POST", "/api/push/unsubscribe");
        queryClient.invalidateQueries({ queryKey: ["/api/me/notifications"] });
        toast({ title: "Desktop notifications off" });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      toast({
        title: "Not supported",
        description: "This browser does not support push notifications.",
        variant: "destructive",
      });
      return;
    }
    if (!config?.vapidPublicKey) {
      toast({
        title: "Not configured",
        description: "Server push is not configured.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast({
          title: "Permission denied",
          description: "Enable notifications in your browser settings.",
          variant: "destructive",
        });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      });
      await apiRequest("POST", "/api/push/subscribe", { subscription: sub.toJSON() });
      setNotifyDesktop(true);
      queryClient.invalidateQueries({ queryKey: ["/api/me/notifications"] });
      toast({ title: "Desktop notifications on" });
    } catch (e: any) {
      toast({
        title: "Could not enable push",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    try {
      await savePrefs({
        reminderMinutesBefore: reminderMinutes,
        notifyEmail,
        notifySms,
        phoneE164: phoneE164 || null,
      } as any);
      toast({ title: "Notification preferences saved" });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Choose how to be reminded of scheduled doses. Reminders fire per stack
          only when that stack has notifications turned on.
        </p>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Remind me before each dose
          </Label>
          <Select
            value={String(reminderMinutes)}
            onValueChange={(v) => setReminderMinutes(Number(v))}
          >
            <SelectTrigger
              className="max-w-[220px]"
              data-testid="select-reminder-minutes"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">At the time</SelectItem>
              <SelectItem value="5">5 minutes before</SelectItem>
              <SelectItem value="15">15 minutes before</SelectItem>
              <SelectItem value="30">30 minutes before</SelectItem>
              <SelectItem value="60">60 minutes before</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 pt-1">
          {/* Desktop push */}
          <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <div className="font-medium text-sm">Desktop push</div>
              <div className="text-xs text-muted-foreground">
                Browser notifications (works even when this tab is closed if
                your browser is open).
              </div>
              {!config?.desktopAvailable && (
                <ServerWarning text="Push VAPID keys not configured on server." />
              )}
              {permission === "denied" && (
                <ServerWarning text="Browser permission denied — enable it in site settings." />
              )}
            </div>
            <Switch
              checked={notifyDesktop}
              onCheckedChange={handleToggleDesktop}
              disabled={busy || !config?.desktopAvailable}
              data-testid="switch-notify-desktop"
            />
          </div>

          {/* Email */}
          <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <div className="font-medium text-sm">Email</div>
              <div className="text-xs text-muted-foreground">
                Send reminders to your account email.
              </div>
              {config && !config.emailAvailable && (
                <ServerWarning text="Not configured on server — add RESEND_API_KEY to enable." />
              )}
            </div>
            <Switch
              checked={notifyEmail}
              onCheckedChange={setNotifyEmail}
              disabled={busy || !config?.emailAvailable}
              data-testid="switch-notify-email"
            />
          </div>

          {/* SMS */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">Text message (SMS)</div>
                <div className="text-xs text-muted-foreground">
                  Requires a phone number in E.164 format (e.g. +15551234567).
                </div>
                {config && !config.smsAvailable && (
                  <ServerWarning text="Not configured on server — add TWILIO_* keys to enable." />
                )}
              </div>
              <Switch
                checked={notifySms}
                onCheckedChange={setNotifySms}
                disabled={busy || !config?.smsAvailable}
                data-testid="switch-notify-sms"
              />
            </div>
            {notifySms && (
              <Input
                type="tel"
                placeholder="+15551234567"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                data-testid="input-phone-e164"
                className="max-w-[240px]"
              />
            )}
          </div>
        </div>

        <div className="pt-1">
          <Button
            onClick={handleSave}
            disabled={busy}
            data-testid="button-save-notifications"
          >
            {busy ? "Saving…" : "Save notification settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage Peptides — hide/unhide peptides from library
// ─────────────────────────────────────────────────────────────────────────────

function ManagePeptidesSection() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  const { data: peptides } = useQuery<{ id: number; name: string; category: string }[]>({
    queryKey: ["/api/peptides"],
  });
  const { data: hiddenIds } = useQuery<number[]>({
    queryKey: ["/api/hidden-peptides"],
  });

  const hiddenSet = new Set(hiddenIds ?? []);

  async function toggleHide(peptideId: number, currentlyHidden: boolean) {
    setBusy(peptideId);
    try {
      if (currentlyHidden) {
        await apiRequest("DELETE", `/api/hidden-peptides/${peptideId}`);
        toast({ title: "Peptide visible" });
      } else {
        await apiRequest("POST", "/api/hidden-peptides", { peptideId });
        toast({ title: "Peptide hidden" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hidden-peptides"] });
    } catch (e: any) {
      toast({
        title: "Could not update",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  const sorted = (peptides ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Manage peptides
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Hide peptides you don't use so they won't appear in the calculator or
          stack picker. You can unhide them anytime. Mathematical calculation
          and scheduling tool only — not medical advice.
        </p>
        <div className="max-h-[420px] overflow-y-auto rounded-md border border-border divide-y divide-border">
          {sorted.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          )}
          {sorted.map((p) => {
            const hidden = hiddenSet.has(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
                data-testid={`row-peptide-${p.id}`}
              >
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${hidden ? "text-muted-foreground line-through" : ""}`}>
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.category}</div>
                </div>
                <Button
                  variant={hidden ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => toggleHide(p.id, hidden)}
                  disabled={busy === p.id}
                  data-testid={`button-toggle-peptide-${p.id}`}
                >
                  {hidden ? (
                    <><EyeOff className="h-4 w-4 mr-1.5" /> Hidden</>
                  ) : (
                    <><Eye className="h-4 w-4 mr-1.5" /> Visible</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        {hiddenSet.size > 0 && (
          <p className="text-xs text-muted-foreground">
            {hiddenSet.size} peptide{hiddenSet.size === 1 ? "" : "s"} currently hidden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body units + calendar preferences
// ─────────────────────────────────────────────────────────────────────────────
function BodyUnitsAndCalendarPrefs() {
  const { user, refetchMe } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const weightUnit = (user as any)?.weightUnit ?? "lb";
  const heightUnit = (user as any)?.heightUnit ?? "imperial";
  const showClientSchedules = !!(user as any)?.showClientSchedulesOnCalendar;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await apiRequest("PATCH", "/api/me", body);
      await refetchMe();
      toast({ title: "Preferences updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      <div>
        <div className="text-sm font-medium mb-1">Weight unit</div>
        <RadioGroup
          value={weightUnit}
          onValueChange={(v) => patch({ weightUnit: v })}
          className="flex gap-4"
          data-testid="radio-weight-unit"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="lb" id="weight-lb" data-testid="radio-weight-lb" />
            <Label htmlFor="weight-lb" className="font-normal cursor-pointer">Pounds (lb)</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="kg" id="weight-kg" data-testid="radio-weight-kg" />
            <Label htmlFor="weight-kg" className="font-normal cursor-pointer">Kilograms (kg)</Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Height unit</div>
        <RadioGroup
          value={heightUnit}
          onValueChange={(v) => patch({ heightUnit: v })}
          className="flex gap-4"
          data-testid="radio-height-unit"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="imperial" id="height-imperial" data-testid="radio-height-imperial" />
            <Label htmlFor="height-imperial" className="font-normal cursor-pointer">Feet / inches</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="metric" id="height-metric" data-testid="radio-height-metric" />
            <Label htmlFor="height-metric" className="font-normal cursor-pointer">Centimeters</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <div className="font-medium text-sm">Show client schedules on my calendar</div>
          <div className="text-xs text-muted-foreground">
            When on, client stack doses appear on your monthly calendar by default.
          </div>
        </div>
        <Switch
          checked={showClientSchedules}
          disabled={busy}
          onCheckedChange={(v) => patch({ showClientSchedulesOnCalendar: v })}
          data-testid="switch-show-client-schedules"
        />
      </div>
    </div>
  );
}

function ServerWarning({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-md border border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 px-2 py-1.5 text-[11px]">
      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Stack, ScheduleSpec } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScheduleBuilder, makeDefaultSpec } from "@/components/schedule/ScheduleBuilder";
import { useSession } from "@/lib/session";
import { useGuestStacks } from "@/contexts/GuestStackContext";
import { useUnitPreference } from "@/lib/unit-preference";
import { formatDose } from "@/lib/units";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { scheduleTypeToLegacyFrequency, summarizeSchedule } from "@shared/schedule";
import type { SyringeType } from "@/lib/reconstitution";

interface NotificationsConfig {
  desktopAvailable: boolean;
  emailAvailable: boolean;
  smsAvailable: boolean;
}

interface UserNotifications {
  notifyDesktop: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Calculator context snapshot
  defaultPeptideName?: string;
  peptideNameLocked?: boolean; // on Advanced, lock it
  defaultVialMg: number;
  defaultBacMl: number;
  defaultDoseMcg: number;
  defaultSyringeType: SyringeType;
  defaultFrequency?: string; // from peptide catalog (legacy)
}

export function AddToStackDialog({
  open,
  onOpenChange,
  defaultPeptideName,
  peptideNameLocked,
  defaultVialMg,
  defaultBacMl,
  defaultDoseMcg,
  defaultSyringeType,
  defaultFrequency,
}: Props) {
  const { user } = useSession();
  const { addGuestStack } = useGuestStacks();
  const { preference } = useUnitPreference();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [tab, setTab] = useState<"quick" | "advanced">("quick");
  const [peptideName, setPeptideName] = useState(defaultPeptideName ?? "");
  const [stackMode, setStackMode] = useState<"new" | "existing">("new");
  const [newStackName, setNewStackName] = useState("");
  const [existingStackId, setExistingStackId] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleSpec>(() => makeDefaultSpec());
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Keep peptideName synced to prop when dialog opens
  useEffect(() => {
    if (open) {
      setPeptideName(defaultPeptideName ?? "");
      setSchedule(makeDefaultSpec());
      setNewStackName(defaultPeptideName ? `${defaultPeptideName} stack` : "");
      setStackMode("new");
      setExistingStackId("");
      setTab("quick");
    }
  }, [open, defaultPeptideName]);

  const { data: stacks } = useQuery<Stack[]>({
    queryKey: ["/api/stacks"],
    enabled: open && !!user,
  });

  const { data: notifConfig } = useQuery<NotificationsConfig>({
    queryKey: ["/api/notifications/config"],
    enabled: open,
  });

  const { data: userNotif } = useQuery<UserNotifications>({
    queryKey: ["/api/me/notifications"],
    enabled: open && !!user,
  });

  const summary = useMemo(() => summarizeSchedule(schedule), [schedule]);

  const anyChannelEnabled =
    !!userNotif && (userNotif.notifyDesktop || userNotif.notifyEmail || userNotif.notifySms);

  useEffect(() => {
    // Default toggle on if user has any channel enabled; off otherwise but still allow
    if (userNotif) {
      setNotificationsEnabled(anyChannelEnabled);
    }
  }, [anyChannelEnabled, userNotif]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const effectiveName = peptideName.trim() || "Peptide";
      if (!user) {
        // Guest flow: store in context only
        const gsName = stackMode === "new" ? newStackName.trim() || `${effectiveName} stack` : effectiveName;
        addGuestStack({
          id: "",
          name: gsName,
          startDate: schedule.startDate,
          durationWeeks: schedule.durationWeeks ?? 8,
          notificationsEnabled,
          items: [
            {
              peptideId: null,
              customName: effectiveName,
              vialMg: defaultVialMg,
              bacWaterMl: defaultBacMl,
              doseMcg: defaultDoseMcg,
              syringeType: defaultSyringeType,
              frequency: scheduleTypeToLegacyFrequency(schedule),
              timeOfDay: schedule.timesOfDay?.[0] ?? "09:00",
              durationDays: (schedule.durationWeeks ?? 8) * 7,
              notes: null,
              scheduleJson: JSON.stringify(schedule),
            },
          ],
        });
        return { guest: true } as const;
      }

      // Authed flow
      let stackId: number;
      if (stackMode === "existing" && existingStackId) {
        stackId = Number(existingStackId);
      } else {
        const res = await apiRequest("POST", "/api/stacks", {
          name: newStackName.trim() || `${effectiveName} stack`,
          startDate: schedule.startDate,
          durationWeeks: schedule.durationWeeks ?? 8,
          notificationsEnabled: notificationsEnabled ? 1 : 0,
          clientId: null,
        });
        const created = await res.json();
        stackId = created.id;
      }
      await apiRequest("POST", "/api/stack-items", {
        stackId,
        peptideId: null,
        customName: effectiveName,
        vialMg: defaultVialMg,
        bacWaterMl: defaultBacMl,
        doseMcg: defaultDoseMcg,
        syringeType: defaultSyringeType,
        frequency: scheduleTypeToLegacyFrequency(schedule),
        timeOfDay: schedule.timesOfDay?.[0] ?? "09:00",
        durationDays: (schedule.durationWeeks ?? 8) * 7,
        notes: null,
        scheduleJson: JSON.stringify(schedule),
      });
      return { guest: false, stackId } as const;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      if (result.guest) {
        toast({
          title: "Saved to session stack",
          description: "Sign up to enable reminders and sync across devices.",
        });
      } else {
        toast({
          title: "Added to stack",
          description: "View schedule →",
        });
      }
      onOpenChange(false);
      if (!result.guest) {
        // Let the user manually navigate; link appears via toast action
        setTimeout(() => setLocation(`/stacks/${result.stackId}`), 200);
      }
    },
    onError: (e: any) => {
      toast({ title: "Could not save", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  function handleFullBuilder() {
    // Navigate to /stacks/new with prefill params
    const params = new URLSearchParams({
      name: peptideName.trim() || "",
      vialMg: String(defaultVialMg),
      bacWaterMl: String(defaultBacMl),
      doseMcg: String(defaultDoseMcg),
      syringeType: defaultSyringeType,
      schedule: JSON.stringify(schedule),
    });
    onOpenChange(false);
    setLocation(`/stacks/new?${params.toString()}`);
  }

  const nameInvalid = !peptideName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-add-to-stack"
      >
        <DialogHeader>
          <DialogTitle>Add to stack</DialogTitle>
          <DialogDescription>
            Save this dose to a stack. Set a schedule and (optionally) turn on reminders.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick" data-testid="tab-quick-add">Quick add</TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced-add">Advanced setup</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-5 mt-4">
            {/* Peptide name */}
            <div className="space-y-2">
              <Label htmlFor="ats-peptide">Peptide name</Label>
              <Input
                id="ats-peptide"
                value={peptideName}
                onChange={(e) => setPeptideName(e.target.value)}
                disabled={peptideNameLocked}
                placeholder="e.g. Semaglutide"
                data-testid="input-ats-peptide-name"
              />
              {nameInvalid && (
                <p className="text-[11px] text-destructive">Required.</p>
              )}
            </div>

            {/* Dose readout */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Dose:</span>{" "}
              <span className="font-semibold">{formatDose(defaultDoseMcg, preference)}</span>
              <span className="text-muted-foreground"> · vial {defaultVialMg} mg · BAC {defaultBacMl} mL · {defaultSyringeType}</span>
            </div>

            {/* Stack selection */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stack</Label>
              <RadioGroup
                value={stackMode}
                onValueChange={(v) => setStackMode(v as any)}
                className="space-y-2"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="new" id="ats-new" data-testid="radio-stack-new" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="ats-new" className="font-normal">Create new stack</Label>
                    {stackMode === "new" && (
                      <Input
                        value={newStackName}
                        onChange={(e) => setNewStackName(e.target.value)}
                        placeholder="Stack name"
                        data-testid="input-new-stack-name"
                      />
                    )}
                  </div>
                </div>
                {user && stacks && stacks.length > 0 && (
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="existing" id="ats-exist" data-testid="radio-stack-existing" />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="ats-exist" className="font-normal">Add to existing stack</Label>
                      {stackMode === "existing" && (
                        <Select value={existingStackId} onValueChange={setExistingStackId}>
                          <SelectTrigger data-testid="select-existing-stack">
                            <SelectValue placeholder="Choose stack" />
                          </SelectTrigger>
                          <SelectContent>
                            {stacks.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Schedule */}
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-sm font-semibold">Schedule</Label>
              <ScheduleBuilder
                value={schedule}
                onChange={setSchedule}
                compact
                idPrefix="quick-sched"
                doseMcg={defaultDoseMcg}
                vialMg={defaultVialMg}
                bacMl={defaultBacMl}
              />
            </div>

            {/* Notifications */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="ats-notif"
                  checked={notificationsEnabled}
                  onCheckedChange={(v) => setNotificationsEnabled(!!v)}
                  data-testid="checkbox-notifications"
                />
                <div className="space-y-1">
                  <Label htmlFor="ats-notif" className="font-normal">
                    Enable reminders for this stack
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {user
                      ? anyChannelEnabled
                        ? "Uses your Account → Notifications channel preferences."
                        : "Turn on a channel in Account → Notifications to actually receive reminders."
                      : "Sign up to enable real reminders (desktop, email, SMS)."}
                  </p>
                </div>
              </div>
            </div>

            {/* Full builder link */}
            <div className="pt-2 text-center">
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={handleFullBuilder}
                data-testid="link-full-builder"
              >
                Need more control? Full stack builder →
              </button>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="mb-3">
                The full stack builder lets you add multiple peptides, custom notes per item,
                and fine-tune per-item scheduling.
              </p>
              <Button
                type="button"
                onClick={handleFullBuilder}
                data-testid="button-open-full-builder"
              >
                Open full stack builder
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your current calculator values will be carried over as the first item.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-ats"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || nameInvalid || (stackMode === "existing" && !existingStackId)}
            data-testid="button-save-ats"
          >
            {saveMut.isPending ? "Saving…" : "Save to Stack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

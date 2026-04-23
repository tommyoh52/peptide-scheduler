import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  CustomPeptide,
  Peptide,
  Stack,
  StackItem,
  ScheduleSpec,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/session";
import { calculateReconstitution, SyringeType } from "@/lib/reconstitution";
import { Plus, Trash2, Download, ArrowLeft, Save, Printer, Share2, Copy, Link2, RefreshCw, Users as UsersIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { buildICS, downloadICS, expandDoseEventsFromSchedule } from "@/lib/ics";
import { formatDose } from "@/lib/units";
import { useUnitPreference } from "@/lib/unit-preference";
import {
  ScheduleBuilder,
  makeDefaultSpec,
} from "@/components/schedule/ScheduleBuilder";
import {
  legacyFrequencyToSpec,
  scheduleTypeToLegacyFrequency,
} from "@shared/schedule";

type StackWithItems = Stack & { items: StackItem[] };

function parseScheduleJson(raw: string | null | undefined): ScheduleSpec | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type) return parsed as ScheduleSpec;
  } catch {}
  return null;
}

function parseSearchParams(search: string): URLSearchParams {
  // wouter useSearch returns a string like "?name=BPC&vialMg=5"
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q);
}

export default function StackEditPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, loaded } = useSession();
  const { toast } = useToast();

  const isNew = !params.id || params.id === "new";
  const stackId = isNew ? null : Number(params.id);

  const { data: peptides } = useQuery<Peptide[]>({ queryKey: ["/api/peptides"] });
  const { data: customPeptides } = useQuery<CustomPeptide[]>({
    queryKey: ["/api/custom-peptides"],
    enabled: !!user,
  });
  const { data: hiddenIds } = useQuery<number[]>({
    queryKey: ["/api/hidden-peptides"],
    enabled: !!user,
  });
  const visiblePeptides = (peptides ?? []).filter(
    (p) => !(hiddenIds ?? []).includes(p.id),
  );
  const { data: existing } = useQuery<StackWithItems>({
    queryKey: ["/api/stacks", stackId],
    enabled: !!stackId && !!user,
  });

  // Stack metadata form
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [durationWeeks, setDurationWeeks] = useState("8");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [clientIdForStack, setClientIdForStack] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneClientId, setCloneClientId] = useState<string>("");

  // Prefill from URL (only for new stacks on first mount)
  useEffect(() => {
    if (!isNew) return;
    const sp = parseSearchParams(search || "");
    if (sp.size === 0) return;
    const pName = sp.get("name") || "";
    const vialMg = sp.get("vialMg") || "";
    const bacWaterMl = sp.get("bacWaterMl") || "";
    const doseMcg = sp.get("doseMcg") || "";
    const syringeType = (sp.get("syringeType") || "U-100") as SyringeType;
    const scheduleRaw = sp.get("schedule");

    let spec: ScheduleSpec;
    if (scheduleRaw) {
      try {
        spec = JSON.parse(decodeURIComponent(scheduleRaw)) as ScheduleSpec;
      } catch {
        spec = makeDefaultSpec({ startDate });
      }
    } else {
      spec = makeDefaultSpec({ startDate });
    }

    // Seed stack name from peptide name if name is empty
    if (pName && !name) setName(`${pName} cycle`);

    // Only add one prefilled item if items are still empty
    setItems((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          peptideId: null,
          customName: pName || "Custom",
          vialMg: vialMg || "5",
          bacWaterMl: bacWaterMl || "2",
          doseMcg: doseMcg || "250",
          syringeType,
          scheduleSpec: spec,
          notes: "",
        },
      ];
    });
    // Seed stack start/duration from spec
    if (spec.startDate) setStartDate(spec.startDate);
    if (spec.durationWeeks) setDurationWeeks(String(spec.durationWeeks));
    const cid = sp.get("clientId");
    if (cid) setClientIdForStack(parseInt(cid) || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, search]);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setStartDate(existing.startDate);
      setDurationWeeks(String(existing.durationWeeks));
      setNotificationsEnabled(existing.notificationsEnabled !== 0);
      setIsActive((existing as any).isActive !== 0);
      setShareToken((existing as any).shareToken ?? null);
      setItems(
        existing.items.map((it) => {
          const parsed = parseScheduleJson((it as any).scheduleJson);
          const spec: ScheduleSpec =
            parsed ??
            legacyFrequencyToSpec(
              it.frequency,
              it.timeOfDay,
              existing.startDate,
              it.durationDays,
            );
          return {
            id: it.id,
            peptideId: it.peptideId ?? null,
            customName: it.customName ?? "",
            vialMg: String(it.vialMg),
            bacWaterMl: String(it.bacWaterMl),
            doseMcg: String(it.doseMcg),
            syringeType: it.syringeType as SyringeType,
            scheduleSpec: spec,
            notes: it.notes ?? "",
          };
        }),
      );
    }
  }, [existing]);

  const createStackMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stacks", {
        name,
        startDate,
        durationWeeks: parseInt(durationWeeks) || 0,
        clientId: clientIdForStack,
        notificationsEnabled: notificationsEnabled ? 1 : 0,
      });
      return (await res.json()) as Stack;
    },
    onError: (e: any) =>
      toast({
        title: "Could not create stack",
        description: String(e?.message),
        variant: "destructive",
      }),
  });

  const updateStackMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/stacks/${id}`, {
        name,
        startDate,
        durationWeeks: parseInt(durationWeeks) || 0,
        notificationsEnabled: notificationsEnabled ? 1 : 0,
        isActive: isActive ? 1 : 0,
      });
      return (await res.json()) as Stack;
    },
  });

  // Load clients for clone target
  const { data: clients } = useQuery<Array<{ id: number; fullName: string }>>({
    queryKey: ["/api/clients"],
    enabled: !!user && user.tier === "pro",
  });

  const generateShareTokenMut = useMutation({
    mutationFn: async () => {
      if (!stackId) throw new Error("no_stack");
      const res = await apiRequest("POST", `/api/stacks/${stackId}/share-token`);
      const data = await res.json();
      return data.token as string;
    },
    onSuccess: (token) => {
      setShareToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/stacks", stackId] });
    },
    onError: (e: any) =>
      toast({ title: "Could not generate link", description: e?.message, variant: "destructive" }),
  });

  const regenerateShareTokenMut = useMutation({
    mutationFn: async () => {
      if (!stackId) throw new Error("no_stack");
      const res = await apiRequest("POST", `/api/stacks/${stackId}/share-token/regenerate`);
      const data = await res.json();
      return data.token as string;
    },
    onSuccess: (token) => {
      setShareToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/stacks", stackId] });
      toast({ title: "Link regenerated" });
    },
  });

  const cloneMut = useMutation({
    mutationFn: async (clientId: number) => {
      if (!stackId) throw new Error("no_stack");
      const res = await apiRequest("POST", `/api/stacks/${stackId}/clone-to-client`, { clientId });
      return (await res.json()) as Stack;
    },
    onSuccess: (newStack) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      toast({
        title: "Stack cloned",
        description: `Created “${newStack.name}” for the selected client.`,
      });
      setCloneOpen(false);
      setLocation(`/stacks/${newStack.id}`);
    },
    onError: (e: any) =>
      toast({ title: "Could not clone", description: e?.message, variant: "destructive" }),
  });

  function handoutUrl(token: string) {
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return `${base}#/handout/${token}`;
  }

  function copyToClipboard(text: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
      }
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  const createItemMut = useMutation({
    mutationFn: async ({
      stackId,
      item,
    }: {
      stackId: number;
      item: EditableItem;
    }) => {
      const payload = itemToPayload(stackId, item);
      const res = await apiRequest("POST", "/api/stack-items", payload);
      return (await res.json()) as StackItem;
    },
  });

  const updateItemMut = useMutation({
    mutationFn: async ({ id, item }: { id: number; item: EditableItem }) => {
      const payload = itemToPayload(0, item);
      delete (payload as any).stackId;
      await apiRequest("PATCH", `/api/stack-items/${id}`, payload);
    },
  });

  const deleteItemMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stack-items/${id}`);
    },
  });

  const deleteStackMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stacks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      setLocation("/stacks");
    },
  });

  if (loaded && !user) {
    setLocation("/auth");
    return null;
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        peptideId: null,
        customName: "",
        vialMg: "5",
        bacWaterMl: "2",
        doseMcg: "250",
        syringeType: "U-100",
        scheduleSpec: makeDefaultSpec({ startDate }),
        notes: "",
      },
    ]);
  }

  function updateItem(idx: number, patch: Partial<EditableItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function removeItemLocal(idx: number) {
    const it = items[idx];
    if (it.id) {
      deleteItemMut.mutate(it.id);
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handlePeptidePick(idx: number, value: string) {
    if (value === "custom") {
      updateItem(idx, {
        peptideId: null,
        customName: items[idx].customName || "Custom peptide",
      });
      return;
    }
    if (value.startsWith("mypep-")) {
      const id = Number(value.slice(6));
      const p = customPeptides?.find((pp) => pp.id === id);
      if (!p) return;
      const avg = Math.round((p.typicalDoseMcgMin + p.typicalDoseMcgMax) / 2);
      const spec = legacyFrequencyToSpec(
        p.defaultFrequency,
        items[idx].scheduleSpec.timesOfDay?.[0] ?? "09:00",
        items[idx].scheduleSpec.startDate,
        (items[idx].scheduleSpec.durationWeeks ?? 8) * 7,
      );
      updateItem(idx, {
        peptideId: null,
        customName: p.name,
        vialMg: String(p.typicalVialMg),
        bacWaterMl: String(p.recommendedBacMl),
        doseMcg: String(avg),
        scheduleSpec: spec,
      });
      return;
    }
    const p = peptides?.find((pp) => String(pp.id) === value);
    if (!p) return;
    const avg = Math.round((p.typicalDoseMcgMin + p.typicalDoseMcgMax) / 2);
    const spec = legacyFrequencyToSpec(
      p.defaultFrequency,
      items[idx].scheduleSpec.timesOfDay?.[0] ?? "09:00",
      items[idx].scheduleSpec.startDate,
      (items[idx].scheduleSpec.durationWeeks ?? 8) * 7,
    );
    updateItem(idx, {
      peptideId: p.id,
      customName: "",
      vialMg: String(p.typicalVialMg),
      bacWaterMl: String(p.recommendedBacMl),
      doseMcg: String(avg),
      scheduleSpec: spec,
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      let sid = stackId;
      if (isNew) {
        const s = await createStackMut.mutateAsync();
        sid = s.id;
      } else if (stackId) {
        await updateStackMut.mutateAsync(stackId);
      }
      if (!sid) return;
      for (const it of items) {
        if (it.id) {
          await updateItemMut.mutateAsync({ id: it.id, item: it });
        } else {
          await createItemMut.mutateAsync({ stackId: sid, item: it });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stacks", sid] });
      toast({ title: isNew ? "Stack created" : "Stack saved" });
      setLocation(`/stacks/${sid}`);
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: String(e?.message),
        variant: "destructive",
      });
    }
  }

  function getPeptideName(item: EditableItem): string {
    if (item.peptideId) {
      const p = peptides?.find((pp) => pp.id === item.peptideId);
      return p?.name ?? "Peptide";
    }
    return item.customName || "Custom";
  }

  function handleExport() {
    const allEvents = items.flatMap((it, idx) => {
      const units = calculateReconstitution({
        vialMg: parseFloat(it.vialMg) || 0,
        bacWaterMl: parseFloat(it.bacWaterMl) || 0,
        doseMcg: parseFloat(it.doseMcg) || 0,
        syringeType: it.syringeType,
      }).units;
      const pname = getPeptideName(it);
      return expandDoseEventsFromSchedule({
        peptideName: pname,
        units,
        stackName: name,
        stackNotes: it.notes,
        spec: it.scheduleSpec,
        uidPrefix: `${stackId ?? "draft"}-${idx}`,
      });
    });
    if (allEvents.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Add stack items first.",
        variant: "destructive",
      });
      return;
    }
    const ics = buildICS(allEvents, name || "Peptide stack");
    downloadICS(`${(name || "stack").replace(/\s+/g, "-")}.ics`, ics);
    toast({
      title: "Calendar exported",
      description: `${allEvents.length} events in .ics file.`,
    });
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/stacks")}
          data-testid="button-back-stacks"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && stackId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Delete this stack?")) deleteStackMut.mutate(stackId);
              }}
              data-testid="button-delete-stack"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-testid="button-export-ics"
          >
            <Download className="h-4 w-4 mr-1" /> Export .ics
          </Button>
          {!isNew && stackId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/stacks/${stackId}/print`)}
              data-testid="button-print-stack"
            >
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          )}
          {!isNew && stackId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-share-stack">
                  <Share2 className="h-4 w-4 mr-1" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    setShareOpen(true);
                    if (!shareToken) generateShareTokenMut.mutate();
                  }}
                  data-testid="menu-share-link"
                >
                  <Link2 className="h-4 w-4 mr-2" /> Public handout link
                </DropdownMenuItem>
                {user?.tier === "pro" && (
                  <DropdownMenuItem
                    onClick={() => setCloneOpen(true)}
                    data-testid="menu-clone-to-client"
                  >
                    <UsersIcon className="h-4 w-4 mr-2" /> Clone to client
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation(`/stacks/${stackId}/handout`)}
                  data-testid="menu-coach-handout"
                >
                  <Printer className="h-4 w-4 mr-2" /> Coach handout (print)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" onClick={handleSave} data-testid="button-save-stack">
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isNew ? "New stack" : "Edit stack"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="stack-name">Name</Label>
            <Input
              id="stack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 fat-loss stack"
              data-testid="input-stack-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stack-start">Start date</Label>
            <Input
              id="stack-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-stack-start"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stack-weeks">Duration (weeks)</Label>
            <Input
              id="stack-weeks"
              type="number"
              min="1"
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(e.target.value)}
              data-testid="input-stack-weeks"
            />
          </div>
          <div className="space-y-2 md:col-span-3 flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
            <div>
              <Label htmlFor="stack-active" className="text-sm">
                Active
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inactive stacks are hidden from the weekly ticker and calendar, and
                reminders are suppressed.
              </p>
            </div>
            <Switch
              id="stack-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-stack-active"
            />
          </div>
          <div className="space-y-2 md:col-span-3 flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
            <div>
              <Label htmlFor="stack-notifs" className="text-sm">
                Reminders for this stack
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, scheduled doses trigger notifications per your account
                settings.
              </p>
            </div>
            <Switch
              id="stack-notifs"
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
              data-testid="switch-stack-notifications"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Peptides in this stack</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={addItem}
            data-testid="button-add-item"
          >
            <Plus className="h-4 w-4 mr-1" /> Add peptide
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No peptides in this stack yet.
          </div>
        ) : (
          items.map((item, idx) => (
            <StackItemEditor
              key={item.id ?? `new-${idx}`}
              item={item}
              peptides={visiblePeptides}
              customPeptides={customPeptides ?? []}
              onChange={(patch) => updateItem(idx, patch)}
              onPeptidePick={(v) => handlePeptidePick(idx, v)}
              onRemove={() => removeItemLocal(idx)}
              index={idx}
            />
          ))
        )}
      </div>

      {/* Share handout link dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent data-testid="dialog-share">
          <DialogHeader>
            <DialogTitle>Public handout link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view a read-only, print-friendly version of this stack.
              No account required.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareToken ? handoutUrl(shareToken) : "Generating…"}
                data-testid="input-share-url"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => shareToken && copyToClipboard(handoutUrl(shareToken))}
                disabled={!shareToken}
                data-testid="button-copy-share"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => regenerateShareTokenMut.mutate()}
              disabled={regenerateShareTokenMut.isPending}
              data-testid="button-regenerate-share"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
            </Button>
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone-to-client dialog */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent data-testid="dialog-clone">
          <DialogHeader>
            <DialogTitle>Clone to client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a copy of this stack assigned to one of your clients. Scheduled doses
              are copied with the same offsets, starting today.
            </p>
            <Select value={cloneClientId} onValueChange={setCloneClientId}>
              <SelectTrigger data-testid="select-clone-client">
                <SelectValue placeholder="Select a client…" />
              </SelectTrigger>
              <SelectContent>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}
                  </SelectItem>
                ))}
                {(!clients || clients.length === 0) && (
                  <SelectItem value="none" disabled>
                    No clients yet
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!cloneClientId || cloneMut.isPending}
              onClick={() => cloneClientId && cloneMut.mutate(Number(cloneClientId))}
              data-testid="button-confirm-clone"
            >
              Clone stack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EditableItem {
  id?: number;
  peptideId: number | null;
  customName: string;
  vialMg: string;
  bacWaterMl: string;
  doseMcg: string;
  syringeType: SyringeType;
  scheduleSpec: ScheduleSpec;
  notes: string;
}

function itemToPayload(stackId: number, item: EditableItem) {
  const spec = item.scheduleSpec;
  // Legacy fields preserved for backward compatibility
  const timeOfDay = spec.timesOfDay?.[0] ?? "09:00";
  const frequency = scheduleTypeToLegacyFrequency(spec);
  const durationDays = spec.durationWeeks ? spec.durationWeeks * 7 : 28;
  return {
    stackId,
    peptideId: item.peptideId ?? null,
    customName: item.peptideId ? null : item.customName || "Custom",
    vialMg: parseFloat(item.vialMg) || 0,
    bacWaterMl: parseFloat(item.bacWaterMl) || 0,
    doseMcg: parseFloat(item.doseMcg) || 0,
    syringeType: item.syringeType,
    frequency,
    timeOfDay,
    durationDays,
    notes: item.notes || null,
    scheduleJson: JSON.stringify(spec),
  };
}

function DoseLabel({ doseMcg }: { doseMcg: number }) {
  const { preference } = useUnitPreference();
  if (doseMcg <= 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      · {formatDose(doseMcg, preference)}
    </span>
  );
}

function StackItemEditor({
  item,
  peptides,
  customPeptides,
  onChange,
  onPeptidePick,
  onRemove,
  index,
}: {
  item: EditableItem;
  peptides: Peptide[];
  customPeptides: CustomPeptide[];
  onChange: (p: Partial<EditableItem>) => void;
  onPeptidePick: (v: string) => void;
  onRemove: () => void;
  index: number;
}) {
  const recon = useMemo(
    () =>
      calculateReconstitution({
        vialMg: parseFloat(item.vialMg) || 0,
        bacWaterMl: parseFloat(item.bacWaterMl) || 0,
        doseMcg: parseFloat(item.doseMcg) || 0,
        syringeType: item.syringeType,
      }),
    [item.vialMg, item.bacWaterMl, item.doseMcg, item.syringeType],
  );

  const selectedValue = (() => {
    if (item.peptideId) return String(item.peptideId);
    if (item.customName) {
      const match = customPeptides.find((cp) => cp.name === item.customName);
      if (match) return `mypep-${match.id}`;
    }
    return "custom";
  })();

  return (
    <Card data-testid={`stack-item-${index}`}>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Peptide</Label>
            <Select value={selectedValue} onValueChange={onPeptidePick}>
              <SelectTrigger data-testid={`select-item-peptide-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Catalog</SelectLabel>
                  {peptides.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {customPeptides.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>My Peptides</SelectLabel>
                      {customPeptides.map((p) => (
                        <SelectItem key={`mp-${p.id}`} value={`mypep-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
            {!item.peptideId && (
              <Input
                placeholder="Custom peptide name"
                value={item.customName}
                onChange={(e) => onChange({ customName: e.target.value })}
                data-testid={`input-item-custom-${index}`}
              />
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label className="text-[11px]">Vial (mg)</Label>
              <Input
                type="number"
                value={item.vialMg}
                onChange={(e) => onChange({ vialMg: e.target.value })}
                data-testid={`input-item-vial-${index}`}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px]">BAC (mL)</Label>
              <Input
                type="number"
                value={item.bacWaterMl}
                onChange={(e) => onChange({ bacWaterMl: e.target.value })}
                data-testid={`input-item-bac-${index}`}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px]">Dose (mcg)</Label>
              <Input
                type="number"
                value={item.doseMcg}
                onChange={(e) => onChange({ doseMcg: e.target.value })}
                data-testid={`input-item-dose-${index}`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[11px]">Syringe</Label>
          <Select
            value={item.syringeType}
            onValueChange={(v) => onChange({ syringeType: v as SyringeType })}
          >
            <SelectTrigger
              className="max-w-[180px]"
              data-testid={`select-item-syringe-${index}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="U-100">U-100</SelectItem>
              <SelectItem value="U-50">U-50</SelectItem>
              <SelectItem value="U-40">U-40</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground block mb-3">
            Schedule
          </Label>
          <ScheduleBuilder
            value={item.scheduleSpec}
            onChange={(spec) => onChange({ scheduleSpec: spec })}
            idPrefix={`sched-${index}`}
            doseMcg={parseFloat(item.doseMcg) || 0}
            vialMg={parseFloat(item.vialMg) || 0}
            bacMl={parseFloat(item.bacWaterMl) || 0}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge variant="secondary" data-testid={`badge-item-units-${index}`}>
              {recon.valid ? `${recon.units.toFixed(1)} units` : "—"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {recon.valid
                ? `${Math.round(recon.concentrationMcgPerMl)} mcg/mL · ${recon.drawVolumeMl.toFixed(4)} mL`
                : "Fill in details"}
            </span>
            {recon.warnings.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {recon.warnings.length} warning
                {recon.warnings.length > 1 ? "s" : ""}
              </Badge>
            )}
            <DoseLabel doseMcg={parseFloat(item.doseMcg) || 0} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            data-testid={`button-remove-item-${index}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

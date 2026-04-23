import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientProfile, ProgressMetric, SideEffect, Stack } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/session";
import { ArrowLeft, Plus, Trash2, LineChart as LineChartIcon, AlertCircle, Calculator as CalcIcon, BookOpen, Sparkles } from "lucide-react";
import { StackQuizModal } from "@/components/StackQuizModal";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, loaded } = useSession();
  const [quizOpen, setQuizOpen] = useState(false);

  const clientId = Number(params.id);

  const { data: client, isLoading } = useQuery<ClientProfile>({
    queryKey: ["/api/clients", clientId],
    enabled: !!user && user.tier === "pro" && !!clientId,
  });

  const { data: stacks } = useQuery<Stack[]>({
    queryKey: ["/api/stacks", { clientId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/stacks?clientId=${clientId}`);
      return await res.json();
    },
    enabled: !!user && user.tier === "pro" && !!clientId,
  });

  if (loaded && (!user || user.tier !== "pro")) {
    setLocation("/clients");
    return null;
  }

  if (isLoading) {
    return (
      <div className="px-4 md:px-8 py-10 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="px-4 md:px-8 py-10 max-w-md mx-auto text-center">
        <p className="text-muted-foreground mb-4">Client not found.</p>
        <Button onClick={() => setLocation("/clients")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/clients")} data-testid="button-back-clients">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to clients
      </Button>

      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
            {client.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight" data-testid="text-client-name">
              {client.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline">{client.gender}</Badge>
              <Badge variant="outline">{client.goal.replace("_", " ")}</Badge>
              {client.heightCm ? <span>{client.heightCm} cm</span> : null}
              {client.startingWeightKg ? <span>· {client.startingWeightKg} kg starting</span> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="stacks" data-testid="tab-stacks">Stacks</TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">Progress</TabsTrigger>
          <TabsTrigger value="calculator" data-testid="tab-calculator">Calculator</TabsTrigger>
          <TabsTrigger value="dosing" data-testid="tab-dosing">Dosing</TabsTrigger>
          <TabsTrigger value="quiz" data-testid="tab-quiz">Quiz</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes || "No notes yet."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stacks" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => setLocation(`/stacks/new?clientId=${clientId}`)}
              data-testid="button-add-stack-for-client"
            >
              <Plus className="h-4 w-4 mr-1" /> Add stack for {client.fullName.split(" ")[0]}
            </Button>
          </div>
          {!stacks || stacks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No stacks assigned to this client yet.
            </div>
          ) : (
            stacks.map((s) => (
              <Link key={s.id} href={`/stacks/${s.id}`}>
                <Card className="cursor-pointer hover-elevate" data-testid={`card-client-stack-${s.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{s.name}</h3>
                      <div className="text-xs text-muted-foreground">
                        Starts {format(new Date(s.startDate), "PP")} · {s.durationWeeks} weeks
                      </div>
                    </div>
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Active" : "Archived"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>
        <TabsContent value="progress" className="mt-4">
          <ProgressTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="calculator" className="mt-4">
          <Card>
            <CardContent className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><CalcIcon className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="font-semibold">Reconstitution calculator</div>
                  <div className="text-xs text-muted-foreground">Open the calculator to compute units and concentration.</div>
                </div>
              </div>
              <Button onClick={() => setLocation("/calculator")} data-testid="button-open-calculator">Open</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dosing" className="mt-4">
          <Card>
            <CardContent className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><BookOpen className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="font-semibold">Dosing guide</div>
                  <div className="text-xs text-muted-foreground">Weight-adjusted ranges by peptide.</div>
                </div>
              </div>
              <Button onClick={() => setLocation("/dosing-guide")} data-testid="button-open-dosing">Open</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <Card>
            <CardContent className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2"><Sparkles className="h-5 w-5 text-primary" /></div>
                <div>
                  <div className="font-semibold">Build a stack</div>
                  <div className="text-xs text-muted-foreground">Run the 8-step quiz and assign results to this client.</div>
                </div>
              </div>
              <Button onClick={() => setQuizOpen(true)} data-testid="button-open-quiz">Start quiz</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StackQuizModal open={quizOpen} onOpenChange={setQuizOpen} />
    </div>
  );
}

function ProgressTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const { data: metrics } = useQuery<ProgressMetric[]>({
    queryKey: [`/api/clients/${clientId}/metrics`],
  });
  const { data: sideEffects } = useQuery<SideEffect[]>({
    queryKey: [`/api/clients/${clientId}/side-effects`],
  });

  const [loggedAt, setLoggedAt] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [energy, setEnergy] = useState<number[]>([6]);
  const [sleep, setSleep] = useState("");
  const [waist, setWaist] = useState("");
  const [notes, setNotes] = useState("");

  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState<number[]>([3]);
  const [resolved, setResolved] = useState(false);

  const createMetricMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/metrics", {
        clientId,
        loggedAt,
        weightKg: weight ? parseFloat(weight) : null,
        bodyFatPct: bodyFat ? parseFloat(bodyFat) : null,
        energyLevel: energy[0],
        sleepHours: sleep ? parseFloat(sleep) : null,
        waistCm: waist ? parseFloat(waist) : null,
        notes: notes || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/metrics`] });
      toast({ title: "Entry logged" });
      setWeight(""); setBodyFat(""); setSleep(""); setWaist(""); setNotes("");
    },
    onError: () => toast({ title: "Could not log metric", variant: "destructive" }),
  });

  const deleteMetricMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/metrics/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/metrics`] }),
  });

  const createSideEffectMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/side-effects", {
        clientId,
        loggedAt: new Date().toISOString().slice(0, 10),
        symptom,
        severity: severity[0],
        relatedPeptideId: null,
        resolved: resolved ? 1 : 0,
        notes: null,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/side-effects`] });
      toast({ title: "Side effect logged" });
      setSymptom("");
      setResolved(false);
    },
    onError: () => toast({ title: "Could not log side effect", variant: "destructive" }),
  });

  const deleteSideEffectMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/side-effects/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/side-effects`] }),
  });

  const sortedMetrics = [...(metrics ?? [])].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

  return (
    <div className="space-y-6">
      {/* Consolidated progress chart */}
      {sortedMetrics.length > 0 ? (
        <ConsolidatedProgress data={sortedMetrics} />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <LineChartIcon className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          Log your first entry below to see charts.
        </div>
      )}

      {/* Log metric form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Log entry</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); createMetricMut.mutate(); }}
            className="grid gap-3 md:grid-cols-4"
          >
            <div className="space-y-2 md:col-span-2">
              <Label>Date</Label>
              <Input type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} data-testid="input-metric-date" />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} data-testid="input-metric-weight" />
            </div>
            <div className="space-y-2">
              <Label>Body fat (%)</Label>
              <Input type="number" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} data-testid="input-metric-bf" />
            </div>
            <div className="space-y-2">
              <Label>Sleep (hours)</Label>
              <Input type="number" step="0.1" value={sleep} onChange={(e) => setSleep(e.target.value)} data-testid="input-metric-sleep" />
            </div>
            <div className="space-y-2">
              <Label>Waist (cm)</Label>
              <Input type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} data-testid="input-metric-waist" />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Energy: {energy[0]}/10</Label>
              <Slider min={1} max={10} step={1} value={energy} onValueChange={setEnergy} data-testid="slider-energy" />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} data-testid="input-metric-notes" />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={createMetricMut.isPending} data-testid="button-log-metric">
                <Plus className="h-4 w-4 mr-1" /> Log entry
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Metrics table */}
      {sortedMetrics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Entries</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground">Weight</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground">BF%</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground">Energy</th>
                  <th className="text-right px-2 py-2 font-medium text-muted-foreground">Sleep</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...sortedMetrics].reverse().map((m) => (
                  <tr key={m.id} className="border-b border-border/50" data-testid={`row-metric-${m.id}`}>
                    <td className="px-4 py-2">{m.loggedAt}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{m.weightKg ?? "—"}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{m.bodyFatPct ?? "—"}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{m.energyLevel ?? "—"}</td>
                    <td className="text-right px-2 py-2 tabular-nums">{m.sleepHours ?? "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMetricMut.mutate(m.id)}
                        data-testid={`button-delete-metric-${m.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Side effects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Side effects
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => { e.preventDefault(); if (!symptom.trim()) return; createSideEffectMut.mutate(); }}
            className="grid gap-3 md:grid-cols-4"
          >
            <div className="space-y-2 md:col-span-2">
              <Label>Symptom</Label>
              <Input value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="e.g. Nausea" data-testid="input-symptom" />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label>Severity: {severity[0]}/10</Label>
              <Slider min={1} max={10} step={1} value={severity} onValueChange={setSeverity} data-testid="slider-severity" />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={resolved} onCheckedChange={(v) => setResolved(!!v)} data-testid="checkbox-resolved" />
                Resolved
              </label>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={createSideEffectMut.isPending} data-testid="button-log-side-effect">
                <Plus className="h-4 w-4 mr-1" /> Log side effect
              </Button>
            </div>
          </form>

          {sideEffects && sideEffects.length > 0 && (
            <div className="space-y-2">
              {sideEffects.map((se) => (
                <div key={se.id} className="flex items-center justify-between rounded-lg border border-border p-3" data-testid={`row-side-effect-${se.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <SeverityBadge severity={se.severity} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{se.symptom}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {se.loggedAt}{se.resolved ? " · Resolved" : ""}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteSideEffectMut.mutate(se.id)} data-testid={`button-delete-se-${se.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: number }) {
  const color =
    severity <= 3
      ? "bg-chart-1/20 text-chart-1 border-chart-1/40"
      : severity <= 6
      ? "bg-chart-3/20 text-chart-3 border-chart-3/50"
      : "bg-destructive/20 text-destructive border-destructive/50";
  return (
    <span
      className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold border ${color}`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {severity}
    </span>
  );
}

// Rule-based blurb summarizing trend over the logged window.
function buildProgressBlurb(data: ProgressMetric[]): string | null {
  if (data.length < 2) return null;
  const first = data[0];
  const last = data[data.length - 1];
  const parts: string[] = [];
  const days = Math.max(
    1,
    Math.round(
      (new Date(last.loggedAt).getTime() - new Date(first.loggedAt).getTime()) /
        86400000
    )
  );
  const weeks = Math.max(1, Math.round(days / 7));
  if (first.weightKg != null && last.weightKg != null) {
    const delta = Number(last.weightKg) - Number(first.weightKg);
    if (Math.abs(delta) >= 0.1) {
      const dir = delta < 0 ? "down" : "up";
      parts.push(`Weight trending ${dir} ${Math.abs(delta).toFixed(1)} kg over ${weeks} week${weeks === 1 ? "" : "s"}.`);
    } else {
      parts.push(`Weight stable over ${weeks} week${weeks === 1 ? "" : "s"}.`);
    }
  }
  if (first.bodyFatPct != null && last.bodyFatPct != null) {
    const delta = Number(last.bodyFatPct) - Number(first.bodyFatPct);
    if (Math.abs(delta) >= 0.1) {
      const dir = delta < 0 ? "down" : "up";
      parts.push(`Body fat ${dir} ${Math.abs(delta).toFixed(1)}%.`);
    }
  }
  const energies = data.map((d) => d.energyLevel).filter((v): v is number => typeof v === "number");
  if (energies.length >= 2) {
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    parts.push(`Average energy ${avg.toFixed(1)}/10.`);
  }
  return parts.length ? parts.join(" ") : null;
}

function ConsolidatedProgress({ data }: { data: ProgressMetric[] }) {
  // Build a combined series keyed by loggedAt
  const series = data.map((d) => ({
    date: d.loggedAt,
    weight: d.weightKg != null ? Number(d.weightKg) : null,
    bodyFat: d.bodyFatPct != null ? Number(d.bodyFatPct) : null,
    energy: d.energyLevel != null ? Number(d.energyLevel) : null,
    sleep: d.sleepHours != null ? Number(d.sleepHours) : null,
    waist: d.waistCm != null ? Number(d.waistCm) : null,
  }));
  const blurb = buildProgressBlurb(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-primary" /> Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {blurb && (
          <div className="text-xs text-muted-foreground" data-testid="text-progress-blurb">
            {blurb}
          </div>
        )}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="bodyFat" name="Body fat (%)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="energy" name="Energy" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="sleep" name="Sleep (h)" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="waist" name="Waist (cm)" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

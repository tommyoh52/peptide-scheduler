import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  User,
  Activity,
  Target,
  AlertCircle,
  Moon,
  FlaskConical,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Flame,
  Dumbbell,
  Zap,
  Brain,
  Heart,
  Apple,
  Clock,
  BedDouble,
  CircleDollarSign,
  CheckCircle2,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { makeDefaultSpec } from "@/components/schedule/ScheduleBuilder";
import type { ScheduleSpec } from "@shared/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: number;
}

type GoalKey =
  | "fat-loss"
  | "muscle"
  | "recovery"
  | "longevity"
  | "hormone"
  | "cognitive"
  | "metabolic"
  | "sleep"
  | "cardiovascular"
  | "joint";

interface QuizState {
  firstName: string;
  age: string;
  sex: string;
  heightFt: string;
  heightIn: string;
  weightLbs: string;
  bodyFat: string;
  // current state (single-select per row)
  energy: string;
  sleepQuality: string;
  stress: string;
  recovery: string;
  training: string;
  goals: GoalKey[];
  focusAreas: string[];
  avgSleep: string;
  diet: string;
  fasting: string;
  activity: string;
  trt: string;
  glp1: string;
  labs: string;
  health: string;
  experience: "none" | "beginner" | "intermediate" | "advanced" | "";
  email: string;
}

const INITIAL: QuizState = {
  firstName: "",
  age: "",
  sex: "",
  heightFt: "",
  heightIn: "",
  weightLbs: "",
  bodyFat: "",
  energy: "",
  sleepQuality: "",
  stress: "",
  recovery: "",
  training: "",
  goals: [],
  focusAreas: [],
  avgSleep: "",
  diet: "",
  fasting: "",
  activity: "",
  trt: "",
  glp1: "",
  labs: "",
  health: "",
  experience: "",
  email: "",
};

const GOAL_OPTIONS: { key: GoalKey; label: string; icon: typeof Flame }[] = [
  { key: "fat-loss", label: "Fat Loss", icon: Flame },
  { key: "muscle", label: "Muscle Growth", icon: Dumbbell },
  { key: "recovery", label: "Recovery & Repair", icon: Zap },
  { key: "longevity", label: "Longevity", icon: Target },
  { key: "hormone", label: "Hormone Optimization", icon: Activity },
  { key: "cognitive", label: "Cognitive Performance", icon: Brain },
  { key: "metabolic", label: "Metabolic Health", icon: Apple },
  { key: "sleep", label: "Sleep Optimization", icon: BedDouble },
  { key: "cardiovascular", label: "Cardiovascular Health", icon: Heart },
  { key: "joint", label: "Joint & Tissue Health", icon: Sparkles },
];

const FOCUS_OPTIONS = [
  { key: "low-energy", label: "Low energy or fatigue" },
  { key: "slow-recovery", label: "Slow recovery after training" },
  { key: "body-fat", label: "Increased body fat" },
  { key: "brain-fog", label: "Brain fog or poor focus" },
  { key: "motivation", label: "Lower motivation or drive" },
  { key: "poor-sleep", label: "Poor sleep quality" },
  { key: "appetite", label: "Stubborn appetite" },
  { key: "libido", label: "Lower libido or vitality" },
  { key: "inflammation", label: "Inflammation or soreness" },
  { key: "plateau", label: "Progress plateau" },
];

interface Recommendation {
  peptides: Array<{
    name: string;
    reason: string;
    defaultDoseMcg: number;
    defaultFrequency: string;
    vialMg: number;
    bacMl: number;
    category: string;
  }>;
  overview: string;
  phasesWeek: Array<{ week: number; note: string }>;
}

const STEP_LABELS = [
  "Personal Profile",
  "Current State",
  "Optimization Goals",
  "Focus Areas",
  "Lifestyle",
  "Advanced Inputs",
  "Experience Level",
  "Your Protocol",
];

export function StackQuizModal({ open, onOpenChange, clientId }: Props) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<QuizState>(INITIAL);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [creating, setCreating] = useState(false);
  const { user } = useSession();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const progress = useMemo(() => (step / 8) * 100, [step]);

  function update<K extends keyof QuizState>(k: K, v: QuizState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  const recommend = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quiz/recommend", {
        goals: state.goals,
        focusAreas: state.focusAreas.map((f) =>
          f === "brain-fog" || f === "motivation" ? "cognitive" :
          f === "poor-sleep" ? "sleep" :
          f === "libido" ? "libido" :
          f === "slow-recovery" || f === "inflammation" ? "joint" :
          f === "body-fat" || f === "appetite" ? "fat-loss" :
          f === "low-energy" ? "sleep" : "plateau"
        ),
        experience: state.experience || "beginner",
        lifestyle: [
          state.avgSleep === "under-5" || state.avgSleep === "5-6" ? "low-sleep" : "",
          state.stress === "High" || state.stress === "Very High" ? "high-stress" : "",
        ].filter(Boolean),
        advanced: state.experience === "advanced",
      });
      return res.json() as Promise<Recommendation>;
    },
    onSuccess: (data) => setResult(data),
    onError: (e: any) => {
      toast({
        title: "Could not build protocol",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    },
  });

  async function handleCreateStack() {
    if (!user) {
      toast({
        title: "Sign in to save",
        description: "Create a free account to save this stack.",
      });
      navigate("/auth");
      onOpenChange(false);
      return;
    }
    if (!result) return;
    setCreating(true);
    try {
      const stackRes = await apiRequest("POST", "/api/stacks", {
        name: `My ${state.goals[0] ?? "custom"} stack`,
        startDate: new Date().toISOString().slice(0, 10),
        durationWeeks: 8,
        isActive: 1,
        ...(clientId ? { clientId } : {}),
      });
      const stack = await stackRes.json();
      for (const p of result.peptides) {
        const spec: ScheduleSpec = makeDefaultSpec({
          type:
            p.defaultFrequency === "weekly" ? "weekly" :
            p.defaultFrequency === "eod" ? "eod" :
            p.defaultFrequency === "twice-weekly" ? "times-per-week" :
            p.defaultFrequency === "3x-weekly" ? "times-per-week" :
            p.defaultFrequency === "prn" ? "prn" : "daily",
          timesPerWeek: p.defaultFrequency === "twice-weekly" ? 2 : p.defaultFrequency === "3x-weekly" ? 3 : undefined,
          daysOfWeek: p.defaultFrequency === "weekly" ? [1] : undefined,
          durationWeeks: 8,
        });
        await apiRequest("POST", "/api/stack-items", {
          stackId: stack.id,
          customName: p.name,
          vialMg: p.vialMg,
          bacWaterMl: p.bacMl,
          doseMcg: p.defaultDoseMcg,
          syringeType: "U-100",
          frequency: p.defaultFrequency === "3x-weekly" ? "times-per-week" : p.defaultFrequency,
          timeOfDay: "09:00",
          durationDays: 8 * 7,
          scheduleJson: JSON.stringify(spec),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      toast({ title: "Stack created", description: `${result.peptides.length} peptides added.` });
      onOpenChange(false);
      setStep(1);
      setState(INITIAL);
      setResult(null);
      navigate(`/stacks/${stack.id}`);
    } catch (e: any) {
      toast({
        title: "Could not create stack",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  function next() {
    if (step === 7) {
      recommend.mutate();
      setStep(8);
      return;
    }
    setStep((s) => Math.min(8, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function toggleMultiGoal(key: GoalKey) {
    setState((s) => ({
      ...s,
      goals: s.goals.includes(key) ? s.goals.filter((g) => g !== key) : [...s.goals, key],
    }));
  }
  function toggleFocus(key: string) {
    setState((s) => ({
      ...s,
      focusAreas: s.focusAreas.includes(key) ? s.focusAreas.filter((g) => g !== key) : [...s.focusAreas, key],
    }));
  }

  const canContinue = (() => {
    if (step === 1) return state.firstName.trim().length > 0;
    if (step === 2) return state.energy !== "";
    if (step === 3) return state.goals.length > 0;
    if (step === 4) return true;
    if (step === 5) return state.avgSleep !== "";
    if (step === 6) return true;
    if (step === 7) return state.experience !== "";
    return true;
  })();

  function PillGroup({ options, value, onChange, testid }: { options: string[]; value: string; onChange: (v: string) => void; testid: string }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            data-testid={`${testid}-${o.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              value === o
                ? "border-primary bg-primary/15 text-primary-foreground ring-1 ring-primary/40 [color:hsl(var(--foreground))]"
                : "border-border bg-card hover:bg-muted/40",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-stack-quiz">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Step {step} of 8 — {STEP_LABELS[step - 1]}
            </span>
            <span className="text-[11px] text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <DialogTitle className="mt-4 text-xl" data-testid="text-quiz-title">
            {step === 1 && "Let's build your optimization profile"}
            {step === 2 && "How are you currently functioning?"}
            {step === 3 && "What areas do you want to optimize?"}
            {step === 4 && "Which other areas need attention?"}
            {step === 5 && "A few more inputs to calibrate"}
            {step === 6 && "Advanced profile (optional)"}
            {step === 7 && "What is your experience level?"}
            {step === 8 && "Your suggested protocol"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Mathematical calculation and scheduling tool only — not medical advice.
          </p>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs"><User className="inline h-3 w-3 mr-1" />First name</Label>
                <Input
                  value={state.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  placeholder="e.g. Erick"
                  data-testid="input-quiz-firstname"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Age (years)</Label>
                <Input
                  type="number"
                  value={state.age}
                  onChange={(e) => update("age", e.target.value)}
                  placeholder="e.g. 38"
                  data-testid="input-quiz-age"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Biological sex</Label>
                <Select value={state.sex} onValueChange={(v) => update("sex", v)}>
                  <SelectTrigger data-testid="select-quiz-sex"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="prefer-not">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weight (lbs)</Label>
                <Input
                  type="number"
                  value={state.weightLbs}
                  onChange={(e) => update("weightLbs", e.target.value)}
                  placeholder="e.g. 185"
                  data-testid="input-quiz-weight"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height ft</Label>
                <Select value={state.heightFt} onValueChange={(v) => update("heightFt", v)}>
                  <SelectTrigger data-testid="select-quiz-ft"><SelectValue placeholder="ft" /></SelectTrigger>
                  <SelectContent>
                    {[4, 5, 6, 7].map((n) => <SelectItem key={n} value={String(n)}>{n} ft</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Height in</Label>
                <Select value={state.heightIn} onValueChange={(v) => update("heightIn", v)}>
                  <SelectTrigger data-testid="select-quiz-in"><SelectValue placeholder="in" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i)}>{i} in</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Estimated body fat % (optional)</Label>
                <Input
                  type="number"
                  value={state.bodyFat}
                  onChange={(e) => update("bodyFat", e.target.value)}
                  placeholder="e.g. 20"
                  data-testid="input-quiz-bf"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Energy level</Label>
                <PillGroup options={["Very Low", "Low", "Moderate", "High"]} value={state.energy} onChange={(v) => update("energy", v)} testid="pill-energy" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sleep quality</Label>
                <PillGroup options={["Poor", "Fair", "Good", "Excellent"]} value={state.sleepQuality} onChange={(v) => update("sleepQuality", v)} testid="pill-sleepq" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stress level</Label>
                <PillGroup options={["Low", "Moderate", "High", "Very High"]} value={state.stress} onChange={(v) => update("stress", v)} testid="pill-stress" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recovery speed</Label>
                <PillGroup options={["Slow", "Average", "Fast"]} value={state.recovery} onChange={(v) => update("recovery", v)} testid="pill-recovery" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Training frequency</Label>
                <PillGroup options={["Not Training", "1–2x/week", "3–4x/week", "5+x/week"]} value={state.training} onChange={(v) => update("training", v)} testid="pill-training" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const Icon = g.icon;
                  const active = state.goals.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => toggleMultiGoal(g.key)}
                      data-testid={`goal-${g.key}`}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors flex items-center gap-3",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                    >
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium">{g.label}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOCUS_OPTIONS.map((f) => {
                  const active = state.focusAreas.includes(f.key);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFocus(f.key)}
                      data-testid={`focus-${f.key}`}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition-colors flex items-center gap-2",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                    >
                      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      {f.label}
                      {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Average sleep</Label>
                <Select value={state.avgSleep} onValueChange={(v) => update("avgSleep", v)}>
                  <SelectTrigger data-testid="select-sleep"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under-5">Less than 5 hours</SelectItem>
                    <SelectItem value="5-6">5–6 hours</SelectItem>
                    <SelectItem value="6-7">6–7 hours</SelectItem>
                    <SelectItem value="7-8">7–8 hours</SelectItem>
                    <SelectItem value="8-plus">8+ hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Diet style</Label>
                <Select value={state.diet} onValueChange={(v) => update("diet", v)}>
                  <SelectTrigger data-testid="select-diet"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {["Standard", "High Protein", "Low Carb", "Keto", "Carnivore", "Plant-Based", "Mixed"].map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Intermittent fasting</Label>
                <Select value={state.fasting} onValueChange={(v) => update("fasting", v)}>
                  <SelectTrigger data-testid="select-fasting"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="occ">Occasionally</SelectItem>
                    <SelectItem value="yes">Yes — regularly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Overall activity level</Label>
                <Select value={state.activity} onValueChange={(v) => update("activity", v)}>
                  <SelectTrigger data-testid="select-activity"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {["Sedentary", "Lightly Active", "Active", "Highly Active"].map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Optional — each input improves protocol accuracy.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currently on TRT / hormone therapy?</Label>
                  <Select value={state.trt} onValueChange={(v) => update("trt", v)}>
                    <SelectTrigger data-testid="select-trt"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="considering">Considering it</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Using or used a GLP-1?</Label>
                  <Select value={state.glp1} onValueChange={(v) => update("glp1", v)}>
                    <SelectTrigger data-testid="select-glp1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="current">Yes — currently</SelectItem>
                      <SelectItem value="past">Previously used</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Recent labs available?</Label>
                  <Select value={state.labs} onValueChange={(v) => update("labs", v)}>
                    <SelectTrigger data-testid="select-labs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="test">Yes — testosterone</SelectItem>
                      <SelectItem value="metabolic">Yes — metabolic panel</SelectItem>
                      <SelectItem value="full">Yes — full bloodwork</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Relevant health context?</Label>
                  <Select value={state.health} onValueChange={(v) => update("health", v)}>
                    <SelectTrigger data-testid="select-health"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="bp">High blood pressure</SelectItem>
                      <SelectItem value="chol">Elevated cholesterol</SelectItem>
                      <SelectItem value="ir">Insulin resistance</SelectItem>
                      <SelectItem value="thyroid">Thyroid issues</SelectItem>
                      <SelectItem value="injury">Injury history</SelectItem>
                      <SelectItem value="apnea">Sleep apnea</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { key: "none", label: "None", sub: "Completely new to peptides" },
                { key: "beginner", label: "Beginner", sub: "Tried a compound or two" },
                { key: "intermediate", label: "Intermediate", sub: "Familiar with protocols" },
                { key: "advanced", label: "Advanced", sub: "Experienced with stacking and cycles" },
              ] as const).map((o) => {
                const active = state.experience === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => update("experience", o.key)}
                    data-testid={`exp-${o.key}`}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border bg-card hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{o.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.sub}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              {recommend.isPending && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
                  <div className="font-semibold">Building your protocol…</div>
                  <div className="text-xs text-muted-foreground mt-1">Analyzing goals, profile, and pathways.</div>
                </div>
              )}
              {result && (
                <>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {state.firstName ? `${state.firstName}, your protocol is ready.` : "Your protocol is ready."}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{result.overview}</p>
                  </div>
                  <div className="space-y-2">
                    {result.peptides.map((p) => (
                      <div
                        key={p.name}
                        className="rounded-lg border border-border bg-card p-3"
                        data-testid={`result-peptide-${p.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">{p.name}</div>
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {p.category}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p.reason}</div>
                        <div className="text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <span><Clock className="inline h-3 w-3 mr-1" />{p.defaultFrequency}</span>
                          <span><Activity className="inline h-3 w-3 mr-1" />{p.defaultDoseMcg} mcg</span>
                          <span><FlaskConical className="inline h-3 w-3 mr-1" />{p.vialMg} mg vial / {p.bacMl} mL BAC</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">8-week phases</div>
                    <ul className="space-y-1 text-xs">
                      {result.phasesWeek.map((phase) => (
                        <li key={phase.week}>
                          <span className="font-semibold">Week {phase.week}:</span>{" "}
                          <span className="text-muted-foreground">{phase.note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Mathematical calculation and scheduling tool only — NOT medical advice. Review with a qualified clinician.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 1}
            data-testid="button-quiz-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 8 && (
            <Button onClick={next} disabled={!canContinue} data-testid="button-quiz-next">
              {step === 7 ? "Generate protocol" : "Continue"} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 8 && result && (
            <Button onClick={handleCreateStack} disabled={creating} data-testid="button-quiz-create-stack">
              {creating ? "Creating…" : user ? "Save as stack" : "Sign in to save"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

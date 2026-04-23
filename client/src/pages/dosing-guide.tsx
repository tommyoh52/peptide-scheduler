import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Goal, GOAL_OPTIONS, recommendProtocol } from "@/lib/dosing-guide";
import { AlertTriangle, Pill, CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDoseRange } from "@/lib/units";
import { useUnitPreference } from "@/lib/unit-preference";
import type { Peptide } from "@shared/schema";

function safeParseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type HeightUnit = "cm" | "ftin";
type WeightUnit = "kg" | "lb";

export default function DosingGuidePage() {
  const [selectedPeptideId, setSelectedPeptideId] = useState<string>("");
  const { data: peptides = [] } = useQuery<Peptide[]>({ queryKey: ["/api/peptides"] });
  const selectedPeptide = useMemo(
    () => peptides.find((p) => String(p.id) === selectedPeptideId) ?? null,
    [peptides, selectedPeptideId],
  );
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [heightCm, setHeightCm] = useState("180");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("10");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weightKg, setWeightKg] = useState("80");
  const [weightLb, setWeightLb] = useState("176");
  const [age, setAge] = useState("35");
  const [goal, setGoal] = useState<Goal>("weight_loss");
  const [submitted, setSubmitted] = useState(false);

  function computeHeightCm(): number {
    if (heightUnit === "cm") return parseFloat(heightCm) || 0;
    const ft = parseFloat(heightFt) || 0;
    const inches = parseFloat(heightIn) || 0;
    return Math.round((ft * 12 + inches) * 2.54);
  }

  function computeWeightKg(): number {
    if (weightUnit === "kg") return parseFloat(weightKg) || 0;
    return Math.round((parseFloat(weightLb) || 0) * 0.453592);
  }

  const protocol = submitted
    ? recommendProtocol({
        gender,
        heightCm: computeHeightCm(),
        weightKg: computeWeightKg(),
        age: parseInt(age) || 0,
        goal,
      })
    : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-dosing-title">
          Smart Dosing Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Goal-based starting protocols adjusted for bodyweight. Educational only.
        </p>
      </header>

      {/* Peptide picker with plain-English summary + pros/cons */}
      <Card className="mb-6" data-testid="card-peptide-picker">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Learn about a peptide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedPeptideId} onValueChange={setSelectedPeptideId}>
            <SelectTrigger className="md:max-w-md" data-testid="select-peptide">
              <SelectValue placeholder="Select a peptide to learn more…" />
            </SelectTrigger>
            <SelectContent>
              {peptides.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPeptide && (
            <div className="space-y-3" data-testid="peptide-info">
              <div>
                <h3 className="font-semibold">{selectedPeptide.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedPeptide.summary ?? selectedPeptide.notes ?? ""}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Pros
                  </div>
                  <ul className="text-sm space-y-1">
                    {safeParseList(selectedPeptide.pros).map((pro, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                    {safeParseList(selectedPeptide.pros).length === 0 && (
                      <li className="text-muted-foreground text-xs">No notes yet.</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 mb-2">
                    <XCircle className="h-3.5 w-3.5 text-destructive" /> Cons
                  </div>
                  <ul className="text-sm space-y-1">
                    {safeParseList(selectedPeptide.cons).map((con, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{con}</span>
                      </li>
                    ))}
                    {safeParseList(selectedPeptide.cons).length === 0 && (
                      <li className="text-muted-foreground text-xs">No notes yet.</li>
                    )}
                  </ul>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Educational only · not medical advice. This is a mathematical calculation and
                scheduling tool only.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <ToggleGroup
                type="single"
                value={gender}
                onValueChange={(v) => v && setGender(v as any)}
                className="justify-start"
              >
                <ToggleGroupItem value="male" data-testid="toggle-gender-male">Male</ToggleGroupItem>
                <ToggleGroupItem value="female" data-testid="toggle-gender-female">Female</ToggleGroupItem>
                <ToggleGroupItem value="other" data-testid="toggle-gender-other">Other</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Height</Label>
                <ToggleGroup
                  type="single"
                  value={heightUnit}
                  onValueChange={(v) => v && setHeightUnit(v as HeightUnit)}
                  size="sm"
                >
                  <ToggleGroupItem value="cm" data-testid="toggle-height-cm">cm</ToggleGroupItem>
                  <ToggleGroupItem value="ftin" data-testid="toggle-height-ftin">ft/in</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {heightUnit === "cm" ? (
                <Input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  data-testid="input-height-cm"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    placeholder="ft"
                    data-testid="input-height-ft"
                  />
                  <Input
                    type="number"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    placeholder="in"
                    data-testid="input-height-in"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Weight</Label>
                <ToggleGroup
                  type="single"
                  value={weightUnit}
                  onValueChange={(v) => v && setWeightUnit(v as WeightUnit)}
                  size="sm"
                >
                  <ToggleGroupItem value="kg" data-testid="toggle-weight-kg">kg</ToggleGroupItem>
                  <ToggleGroupItem value="lb" data-testid="toggle-weight-lb">lb</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Input
                type="number"
                value={weightUnit === "kg" ? weightKg : weightLb}
                onChange={(e) =>
                  weightUnit === "kg" ? setWeightKg(e.target.value) : setWeightLb(e.target.value)
                }
                data-testid="input-weight"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  data-testid="input-age"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Goal</Label>
                <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                  <SelectTrigger id="goal" data-testid="select-goal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" data-testid="button-generate-protocol">
              Generate protocol
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended protocol</CardTitle>
          </CardHeader>
          <CardContent>
            {!protocol ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Pill className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                Fill in your details to see a starting protocol.
              </div>
            ) : (
              <div className="space-y-4" data-testid="protocol-card">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{protocol.goalLabel}</Badge>
                    <span className="text-xs text-muted-foreground">
                      @ {computeWeightKg()} kg · {computeHeightCm()} cm
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{protocol.summary}</p>
                </div>

                <div className="space-y-3">
                  {protocol.peptides.map((p) => (
                    <div
                      key={p.name}
                      className="rounded-lg border border-border bg-card p-4 space-y-1"
                      data-testid={`peptide-rec-${p.name.replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{p.name}</h3>
                        <Badge variant="outline">{p.frequency}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Dose:{" "}
                        <span className="font-mono font-medium text-foreground">
                          <DoseRange min={p.doseRangeMcg[0]} max={p.doseRangeMcg[1]} />
                        </span>{" "}
                        · Duration: {p.durationWeeks} wk
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span data-testid="text-consult-physician">Consult your physician before starting any protocol.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function DoseRange({ min, max }: { min: number; max: number }) {
  const { preference } = useUnitPreference();
  return <>{formatDoseRange(min, max, preference)}</>;
}

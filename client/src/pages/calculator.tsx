import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Peptide, CustomPeptide } from "@shared/schema";
import {
  calculateReconstitution,
  formatUnits,
  suggestBacWater,
  SyringeType,
} from "@/lib/reconstitution";
import { InsulinSyringe } from "@/components/InsulinSyringe";
import { CustomPeptideDialog } from "@/components/CustomPeptideDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Trash2, Plus, BookmarkPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { useUnitPreference } from "@/lib/unit-preference";
import { formatDose, formatDoseRange } from "@/lib/units";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddToStackDialog } from "@/components/AddToStackDialog";

const CUSTOM_ID = "custom";

export default function CalculatorPage() {
  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold tracking-tight"
          data-testid="text-calculator-title"
        >
          Reconstitution Calculator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Figure out how far to draw your syringe. Math updates live.
        </p>
      </header>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList data-testid="tabs-calculator">
          <TabsTrigger value="basic" data-testid="tab-basic">
            Basic
          </TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-advanced">
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicCalculator />
        </TabsContent>
        <TabsContent value="advanced">
          <AdvancedCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC — button-group driven, peptide-agnostic
// ─────────────────────────────────────────────────────────────────────────────

const SYRINGE_CHOICES: {
  value: SyringeType;
  label: string;
  sub: string;
}[] = [
  { value: "U-40", label: "0.3 ml", sub: "U-100 · 30 u" },
  { value: "U-50", label: "0.5 ml", sub: "U-100 · 50 u" },
  { value: "U-100", label: "1.0 ml", sub: "U-100 · 100 u" },
];

const VIAL_CHOICES = [5, 10, 15];
const BAC_CHOICES = [1, 2, 3, 5];
const DOSE_CHOICES = [50, 100, 250, 500];

function BasicCalculator() {
  const { preference } = useUnitPreference();
  const [addToStackOpen, setAddToStackOpen] = useState(false);

  const [syringeType, setSyringeType] = useState<SyringeType>("U-100");

  const [vialMgChoice, setVialMgChoice] = useState<number | "other">(5);
  const [vialMgOther, setVialMgOther] = useState("");

  const [bacMlChoice, setBacMlChoice] = useState<number | "other">(2);
  const [bacMlOther, setBacMlOther] = useState("");

  const [doseChoice, setDoseChoice] = useState<number | "other">(250);
  const [doseOther, setDoseOther] = useState("");

  const vialMg =
    vialMgChoice === "other" ? parseFloat(vialMgOther) || 0 : vialMgChoice;
  const bacMl =
    bacMlChoice === "other" ? parseFloat(bacMlOther) || 0 : bacMlChoice;
  const doseMcg =
    doseChoice === "other" ? parseFloat(doseOther) || 0 : doseChoice;

  const result = calculateReconstitution({
    vialMg,
    bacWaterMl: bacMl,
    doseMcg,
    syringeType,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left column — selectors */}
      <div className="space-y-5">
        <ChoiceGroup
          label="Syringe size"
          testIdPrefix="syringe"
          options={SYRINGE_CHOICES.map((c) => ({
            key: c.value,
            value: c.value,
            label: c.label,
            sub: c.sub,
          }))}
          selectedKey={syringeType}
          onSelect={(_, v) => setSyringeType(v as SyringeType)}
        />

        <NumericChoiceGroup
          label="Vial quantity"
          testIdPrefix="vial"
          unit="mg"
          choices={VIAL_CHOICES}
          selected={vialMgChoice}
          otherValue={vialMgOther}
          onSelect={(v) => setVialMgChoice(v)}
          onOtherChange={setVialMgOther}
        />

        <NumericChoiceGroup
          label="Bac water"
          testIdPrefix="bac"
          unit="ml"
          choices={BAC_CHOICES}
          selected={bacMlChoice}
          otherValue={bacMlOther}
          onSelect={(v) => setBacMlChoice(v)}
          onOtherChange={setBacMlOther}
        />

        <NumericChoiceGroup
          label="Desired dose"
          testIdPrefix="dose"
          unit="mcg"
          choices={DOSE_CHOICES}
          selected={doseChoice}
          otherValue={doseOther}
          onSelect={(v) => setDoseChoice(v)}
          onOtherChange={setDoseOther}
        />
      </div>

      {/* Right column — output + syringe */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {result.valid ? (
              <div className="space-y-3">
                <p
                  className="text-sm md:text-base text-muted-foreground leading-relaxed"
                  data-testid="text-basic-sentence"
                >
                  To have a dose of{" "}
                  <span className="font-semibold text-foreground">
                    {formatDose(doseMcg, preference)}
                  </span>{" "}
                  pull the syringe to
                </p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div
                    className="text-6xl md:text-7xl font-bold tracking-tight text-primary tabular-nums"
                    data-testid="text-basic-units"
                  >
                    {formatUnits(result.units)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    units ({syringeType})
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="font-mono">
                    {Math.round(result.concentrationMcgPerMl).toLocaleString()}{" "}
                    mcg/mL
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    {result.drawVolumeMl.toFixed(4)} mL
                  </Badge>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddToStackOpen(true)}
                    disabled={!result.valid}
                    data-testid="button-add-to-stack-basic"
                  >
                    <BookmarkPlus className="h-4 w-4 mr-1.5" />
                    Add to Stack
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pick a value for each option to see your draw.
              </p>
            )}

            {result.warnings.length > 0 && (
              <div className="space-y-2">
                {result.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                    data-testid={`basic-warning-${i}`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-5">
            <InsulinSyringe
              units={result.valid ? result.units : 0}
              syringeType={syringeType}
              className="w-full h-auto"
            />
          </CardContent>
        </Card>
      </div>

      <AddToStackDialog
        open={addToStackOpen}
        onOpenChange={setAddToStackOpen}
        peptideNameLocked={false}
        defaultVialMg={vialMg}
        defaultBacMl={bacMl}
        defaultDoseMcg={doseMcg}
        defaultSyringeType={syringeType}
      />
    </div>
  );
}

// A simple generic button group for mixed-type choices (syringe)
function ChoiceGroup({
  label,
  testIdPrefix,
  options,
  selectedKey,
  onSelect,
}: {
  label: string;
  testIdPrefix: string;
  options: { key: string; value: string; label: string; sub?: string }[];
  selectedKey: string;
  onSelect: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = selectedKey === o.key;
          return (
            <button
              type="button"
              key={o.key}
              onClick={() => onSelect(o.key, o.value)}
              data-testid={`btn-${testIdPrefix}-${o.key}`}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-all",
                active
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <div className="text-sm font-semibold">{o.label}</div>
              {o.sub && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {o.sub}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumericChoiceGroup({
  label,
  testIdPrefix,
  unit,
  choices,
  selected,
  otherValue,
  onSelect,
  onOtherChange,
}: {
  label: string;
  testIdPrefix: string;
  unit: string;
  choices: number[];
  selected: number | "other";
  otherValue: string;
  onSelect: (v: number | "other") => void;
  onOtherChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => {
          const active = selected === c;
          return (
            <button
              type="button"
              key={c}
              onClick={() => onSelect(c)}
              data-testid={`btn-${testIdPrefix}-${c}`}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-sm font-semibold min-w-[72px] transition-all",
                active
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/40",
              )}
            >
              {c} {unit}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelect("other")}
          data-testid={`btn-${testIdPrefix}-other`}
          className={cn(
            "rounded-lg border px-3.5 py-2 text-sm font-semibold min-w-[72px] transition-all",
            selected === "other"
              ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
              : "border-border bg-card hover:bg-muted/40",
          )}
        >
          Other
        </button>
      </div>
      {selected === "other" && (
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          placeholder={`Custom ${unit}`}
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          data-testid={`input-${testIdPrefix}-other`}
          className="max-w-[180px]"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED — full calculator (existing functionality + custom peptides)
// ─────────────────────────────────────────────────────────────────────────────

function AdvancedCalculator() {
  const { user } = useSession();
  const { preference } = useUnitPreference();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: peptides, isLoading } = useQuery<Peptide[]>({
    queryKey: ["/api/peptides"],
  });
  const { data: customPeptides } = useQuery<CustomPeptide[]>({
    queryKey: ["/api/custom-peptides"],
    enabled: !!user,
  });
  const { data: hiddenIds } = useQuery<number[]>({
    queryKey: ["/api/hidden-peptides"],
    enabled: !!user,
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds ?? []), [hiddenIds]);
  const visiblePeptides = useMemo(
    () => (peptides ?? []).filter((p) => !hiddenSet.has(p.id)),
    [peptides, hiddenSet],
  );

  const [selectedId, setSelectedId] = useState<string>(CUSTOM_ID);
  const [vialMg, setVialMg] = useState<string>("5");
  const [bacWaterMl, setBacWaterMl] = useState<string>("2");
  const [doseMcg, setDoseMcg] = useState<string>("250");
  const [syringeType, setSyringeType] = useState<SyringeType>("U-100");
  const [pendingDelete, setPendingDelete] = useState<CustomPeptide | null>(null);
  const [addToStackOpen, setAddToStackOpen] = useState(false);

  const selectedPeptide = useMemo(() => {
    if (selectedId === CUSTOM_ID) return null;
    if (selectedId.startsWith("custom-")) {
      const id = Number(selectedId.slice(7));
      return customPeptides?.find((p) => p.id === id) ?? null;
    }
    return peptides?.find((p) => String(p.id) === selectedId) ?? null;
  }, [selectedId, peptides, customPeptides]);

  const recommendedBac = useMemo(() => {
    if (selectedPeptide) {
      const avgDose =
        (selectedPeptide.typicalDoseMcgMin + selectedPeptide.typicalDoseMcgMax) / 2;
      return suggestBacWater(selectedPeptide.typicalVialMg, avgDose);
    }
    const mg = parseFloat(vialMg);
    const dose = parseFloat(doseMcg);
    if (isFinite(mg) && isFinite(dose) && mg > 0 && dose > 0) {
      return suggestBacWater(mg, dose);
    }
    return 2;
  }, [selectedPeptide, vialMg, doseMcg]);

  function applyPeptideDefaults(p: Peptide | CustomPeptide) {
    setVialMg(String(p.typicalVialMg));
    setBacWaterMl(String(p.recommendedBacMl));
    const avg = Math.round((p.typicalDoseMcgMin + p.typicalDoseMcgMax) / 2);
    setDoseMcg(String(avg));
  }

  function handleSelectPeptide(value: string) {
    setSelectedId(value);
    if (value === CUSTOM_ID) return;
    if (value.startsWith("custom-")) {
      const id = Number(value.slice(7));
      const p = customPeptides?.find((pp) => pp.id === id);
      if (p) applyPeptideDefaults(p);
      return;
    }
    const p = peptides?.find((pp) => String(pp.id) === value);
    if (p) applyPeptideDefaults(p);
  }

  const deleteCustomMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-peptides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-peptides"] });
      toast({ title: "Peptide removed" });
      // If the deleted one was selected, reset to Custom
      if (pendingDelete && selectedId === `custom-${pendingDelete.id}`) {
        setSelectedId(CUSTOM_ID);
      }
      setPendingDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Could not delete",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    },
  });

  const result = calculateReconstitution({
    vialMg: parseFloat(vialMg) || 0,
    bacWaterMl: parseFloat(bacWaterMl) || 0,
    doseMcg: parseFloat(doseMcg) || 0,
    syringeType,
  });

  const totalVialMcg = (parseFloat(vialMg) || 0) * 1000;
  const parsedDose = parseFloat(doseMcg);
  const doses =
    parsedDose > 0 ? Math.floor(totalVialMcg / parsedDose) : 0;

  function handleAddPeptideClick() {
    if (!user) {
      toast({ title: "Sign up to save your own peptides" });
      setLocation("/auth");
    }
    // If logged in, the trigger inside CustomPeptideDialog opens the dialog.
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="peptide">Peptide</Label>
              {user ? (
                <CustomPeptideDialog
                  onCreated={(created) =>
                    setSelectedId(`custom-${created.id}`)
                  }
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPeptideClick}
                  data-testid="button-add-peptide-guest"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add peptide
                </Button>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedId} onValueChange={handleSelectPeptide}>
                <SelectTrigger id="peptide" data-testid="select-peptide">
                  <SelectValue placeholder="Select peptide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUSTOM_ID}>Custom / Other</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Catalog</SelectLabel>
                    {visiblePeptides.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}{" "}
                        <span className="text-muted-foreground ml-1">
                          · {p.category}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {user && customPeptides && customPeptides.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>My Peptides</SelectLabel>
                        {customPeptides.map((p) => (
                          <SelectItem
                            key={`cp-${p.id}`}
                            value={`custom-${p.id}`}
                          >
                            {p.name}
                            {p.category && (
                              <span className="text-muted-foreground ml-1">
                                · {p.category}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
            {selectedPeptide?.notes && (
              <p className="text-xs text-muted-foreground">
                {selectedPeptide.notes}
              </p>
            )}
            {/* Delete button for the currently-selected custom peptide */}
            {user && selectedId.startsWith("custom-") && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  This is one of your saved peptides.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    const id = Number(selectedId.slice(7));
                    const p = customPeptides?.find((pp) => pp.id === id);
                    if (p) setPendingDelete(p);
                  }}
                  data-testid="button-delete-custom-peptide"
                  aria-label="Delete this custom peptide"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vial-mg">Vial size (mg)</Label>
              <Input
                id="vial-mg"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={vialMg}
                onChange={(e) => setVialMg(e.target.value)}
                data-testid="input-vial-mg"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bac-water">BAC water (mL)</Label>
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => setBacWaterMl(String(recommendedBac))}
                  data-testid="button-use-recommended-bac"
                >
                  Use {recommendedBac} mL
                </button>
              </div>
              <Input
                id="bac-water"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={bacWaterMl}
                onChange={(e) => setBacWaterMl(e.target.value)}
                data-testid="input-bac-water"
              />
              <p className="text-[11px] text-muted-foreground">
                Recommended: {recommendedBac} mL
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dose-mcg">Desired dose (mcg)</Label>
              <Input
                id="dose-mcg"
                type="number"
                inputMode="decimal"
                min="0"
                step="10"
                value={doseMcg}
                onChange={(e) => setDoseMcg(e.target.value)}
                data-testid="input-dose-mcg"
              />
              {parsedDose > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  = {formatDose(parsedDose, preference)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="syringe">Syringe type</Label>
              <Select
                value={syringeType}
                onValueChange={(v) => setSyringeType(v as SyringeType)}
              >
                <SelectTrigger id="syringe" data-testid="select-syringe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="U-100">U-100 insulin syringe</SelectItem>
                  <SelectItem value="U-50">U-50 insulin syringe</SelectItem>
                  <SelectItem value="U-40">U-40 insulin syringe</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPeptide && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="font-medium mb-1">
                Typical range for {selectedPeptide.name}
              </div>
              <div className="text-muted-foreground">
                {formatDoseRange(
                  selectedPeptide.typicalDoseMcgMin,
                  selectedPeptide.typicalDoseMcgMax,
                  preference,
                )}{" "}
                · {selectedPeptide.defaultFrequency}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outputs */}
      <div className="lg:col-span-3 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draw</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3 flex-wrap">
              <div
                className="text-6xl md:text-7xl font-bold tracking-tight text-primary tabular-nums"
                data-testid="text-units"
              >
                {result.valid ? formatUnits(result.units) : "—"}
              </div>
              <div className="text-muted-foreground text-sm">
                units on a{" "}
                <span className="font-semibold text-foreground">
                  {syringeType}
                </span>{" "}
                syringe
              </div>
            </div>

            <div className="bg-muted/40 rounded-lg border border-border p-4">
              <InsulinSyringe
                units={result.valid ? result.units : 0}
                syringeType={syringeType}
                className="w-full h-auto"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat
                label="Concentration"
                value={
                  result.valid
                    ? `${Math.round(result.concentrationMcgPerMl).toLocaleString()} mcg/mL`
                    : "—"
                }
                testId="stat-concentration"
              />
              <Stat
                label="Volume to draw"
                value={
                  result.valid ? `${result.drawVolumeMl.toFixed(4)} mL` : "—"
                }
                testId="stat-volume"
              />
              <Stat
                label="Doses per vial"
                value={result.valid && doses > 0 ? `~${doses}` : "—"}
                testId="stat-doses-per-vial"
              />
            </div>

            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddToStackOpen(true)}
                disabled={!result.valid}
                data-testid="button-add-to-stack-advanced"
              >
                <BookmarkPlus className="h-4 w-4 mr-1.5" />
                Add to Stack
              </Button>
            </div>

            {result.warnings.length > 0 && (
              <div className="space-y-2">
                {result.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                    data-testid={`warning-${i}`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to draw</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Swab vial stopper and syringe port.</p>
            <div>
              2. Draw{" "}
              <Badge variant="secondary" className="font-mono">
                {parseFloat(bacWaterMl) || 0} mL
              </Badge>{" "}
              bacteriostatic water into the syringe.
            </div>
            <p>3. Slowly inject water down the side of the vial — do not shake.</p>
            <p>4. Gently swirl until fully dissolved and clear.</p>
            <div>
              5. Invert, draw to{" "}
              <Badge variant="secondary" className="font-mono">
                {result.valid ? formatUnits(result.units) : "—"} units
              </Badge>{" "}
              on the {syringeType} syringe.
            </div>
            <p className="text-xs pt-2">
              Always verify with an independent source and consult your physician.
            </p>
          </CardContent>
        </Card>
      </div>

      <AddToStackDialog
        open={addToStackOpen}
        onOpenChange={setAddToStackOpen}
        defaultPeptideName={selectedPeptide?.name ?? ""}
        peptideNameLocked={!!selectedPeptide}
        defaultVialMg={parseFloat(vialMg) || 0}
        defaultBacMl={parseFloat(bacWaterMl) || 0}
        defaultDoseMcg={parseFloat(doseMcg) || 0}
        defaultSyringeType={syringeType}
        defaultFrequency={selectedPeptide?.defaultFrequency}
      />

      {/* Delete-confirmation alert dialog */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent data-testid="dialog-confirm-delete-peptide">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this peptide?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed from your peptide list. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pendingDelete && deleteCustomMut.mutate(pendingDelete.id)
              }
              data-testid="button-confirm-delete-peptide"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

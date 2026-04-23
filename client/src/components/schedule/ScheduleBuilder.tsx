import { useMemo } from "react";
import type { ScheduleSpec, ScheduleType } from "@shared/schema";
import { summarizeSchedule, generateDoses } from "@shared/schedule";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { X, Plus } from "lucide-react";

const DAYS: { label: string; value: number }[] = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const FREQUENCY_TYPES: { value: ScheduleType; label: string; sub: string }[] = [
  { value: "daily", label: "Daily", sub: "every day" },
  { value: "eod", label: "EOD", sub: "every other day" },
  { value: "days-of-week", label: "Days of week", sub: "pick days" },
  { value: "times-per-week", label: "X/week", sub: "auto-spread" },
  { value: "weekly", label: "Weekly", sub: "one day" },
  { value: "custom-interval", label: "Every N days", sub: "interval" },
  { value: "prn", label: "PRN", sub: "as needed" },
];

export function makeDefaultSpec(overrides?: Partial<ScheduleSpec>): ScheduleSpec {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: "daily",
    timesOfDay: ["09:00"],
    startDate: today,
    durationWeeks: 8,
    ...overrides,
  };
}

interface Props {
  value: ScheduleSpec;
  onChange: (v: ScheduleSpec) => void;
  compact?: boolean;
  idPrefix?: string;
  /** Dose in mcg per injection — enables vial count estimator */
  doseMcg?: number;
  /** Vial strength in mg — enables vial count estimator */
  vialMg?: number;
  /** BAC water used for reconstitution (for context; not required for vial math) */
  bacMl?: number;
}

export function ScheduleBuilder({
  value,
  onChange,
  compact,
  idPrefix = "sched",
  doseMcg,
  vialMg,
}: Props) {
  const summary = useMemo(() => summarizeSchedule(value), [value]);

  // Vial-count estimator: counts generated timestamps for the spec and
  // divides total mcg needed by vial mg. Only shows when we have a dose + vial.
  const vialEstimate = useMemo(() => {
    if (!doseMcg || !vialMg || doseMcg <= 0 || vialMg <= 0) return null;
    if (value.type === "prn") return null;
    let totalDoses = 0;
    try {
      totalDoses = generateDoses(value).length;
    } catch {
      return null;
    }
    if (totalDoses === 0) return null;
    const totalMcg = totalDoses * doseMcg;
    const mcgPerVial = vialMg * 1000;
    const vialsNeeded = Math.ceil(totalMcg / mcgPerVial);
    return { totalDoses, totalMcg, mcgPerVial, vialsNeeded };
  }, [doseMcg, vialMg, value]);
  const useEndDate = !!value.endDate && !value.durationWeeks;

  function update(patch: Partial<ScheduleSpec>) {
    onChange({ ...value, ...patch });
  }

  function toggleDay(day: number) {
    const existing = value.daysOfWeek ?? [];
    const next = existing.includes(day)
      ? existing.filter((d) => d !== day)
      : [...existing, day].sort();
    update({ daysOfWeek: next });
  }

  function addTime() {
    const times = [...(value.timesOfDay ?? [])];
    // Default new time: 3pm or 9pm if there's already morning + afternoon
    const defaults = ["09:00", "15:00", "21:00", "12:00", "18:00"];
    const next = defaults.find((t) => !times.includes(t)) ?? "12:00";
    update({ timesOfDay: [...times, next] });
  }

  function updateTime(idx: number, v: string) {
    const times = [...(value.timesOfDay ?? [])];
    times[idx] = v;
    update({ timesOfDay: times });
  }

  function removeTime(idx: number) {
    const times = [...(value.timesOfDay ?? [])];
    if (times.length <= 1) return;
    times.splice(idx, 1);
    update({ timesOfDay: times });
  }

  const isPrn = value.type === "prn";

  return (
    <div className="space-y-4">
      {/* Frequency type */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Frequency
        </Label>
        <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4 md:grid-cols-7")}>
          {FREQUENCY_TYPES.map((f) => {
            const active = value.type === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  // Sensible defaults on type change
                  const patch: Partial<ScheduleSpec> = { type: f.value };
                  if (f.value === "days-of-week" && (!value.daysOfWeek || value.daysOfWeek.length === 0)) {
                    patch.daysOfWeek = [1, 3, 5];
                  }
                  if (f.value === "times-per-week" && !value.timesPerWeek) {
                    patch.timesPerWeek = 3;
                  }
                  if (f.value === "custom-interval" && !value.intervalDays) {
                    patch.intervalDays = 3;
                  }
                  if (f.value === "weekly" && (!value.daysOfWeek || value.daysOfWeek.length === 0)) {
                    patch.daysOfWeek = [1];
                  }
                  onChange({ ...value, ...patch });
                }}
                data-testid={`${idPrefix}-freq-${f.value}`}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-all",
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <div className="text-sm font-semibold">{f.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{f.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Type-specific controls */}
      {value.type === "days-of-week" && (
        <div className="space-y-2">
          <Label className="text-xs">Select days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const checked = value.daysOfWeek?.includes(d.value);
              return (
                <label
                  key={d.value}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    checked
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={!!checked}
                    onCheckedChange={() => toggleDay(d.value)}
                    data-testid={`${idPrefix}-dow-${d.value}`}
                  />
                  <span>{d.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {value.type === "times-per-week" && (
        <div className="space-y-2">
          <Label className="text-xs">Times per week</Label>
          <Input
            type="number"
            min={1}
            max={7}
            value={value.timesPerWeek ?? 3}
            onChange={(e) => update({ timesPerWeek: Math.max(1, Math.min(7, parseInt(e.target.value) || 1)) })}
            className="max-w-[120px]"
            data-testid={`${idPrefix}-times-per-week`}
          />
          <p className="text-[11px] text-muted-foreground">
            App spreads these evenly across the week.
          </p>
        </div>
      )}

      {value.type === "weekly" && (
        <div className="space-y-2">
          <Label className="text-xs">Day of week</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = value.daysOfWeek?.[0] === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => update({ daysOfWeek: [d.value] })}
                  data-testid={`${idPrefix}-wk-${d.value}`}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.type === "custom-interval" && (
        <div className="space-y-2">
          <Label className="text-xs">Every N days</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={value.intervalDays ?? 3}
            onChange={(e) => update({ intervalDays: Math.max(1, parseInt(e.target.value) || 1) })}
            className="max-w-[120px]"
            data-testid={`${idPrefix}-interval`}
          />
        </div>
      )}

      {/* Times of day */}
      {!isPrn && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Time(s) of day</Label>
          <div className="flex flex-wrap items-center gap-2">
            {(value.timesOfDay ?? ["09:00"]).map((t, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card pl-2 pr-1 py-1"
              >
                <Input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  className="h-7 w-[110px] border-0 p-0 focus-visible:ring-0"
                  data-testid={`${idPrefix}-time-${i}`}
                />
                {(value.timesOfDay?.length ?? 1) > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeTime(i)}
                    data-testid={`${idPrefix}-time-remove-${i}`}
                    aria-label="Remove time"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTime}
              data-testid={`${idPrefix}-time-add`}
            >
              <Plus className="h-3 w-3 mr-1" /> Add time
            </Button>
          </div>
        </div>
      )}

      {/* Start / duration */}
      {!isPrn && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start date</Label>
            <Input
              type="date"
              value={value.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
              data-testid={`${idPrefix}-start-date`}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => {
                  if (useEndDate) {
                    update({ endDate: undefined, durationWeeks: 8 });
                  } else {
                    const end = new Date(value.startDate);
                    end.setDate(end.getDate() + (value.durationWeeks ?? 8) * 7 - 1);
                    update({ durationWeeks: undefined, endDate: end.toISOString().slice(0, 10) });
                  }
                }}
                data-testid={`${idPrefix}-toggle-duration`}
              >
                {useEndDate ? "Use weeks instead" : "Use end date instead"}
              </button>
            </div>
            {useEndDate ? (
              <Input
                type="date"
                value={value.endDate ?? ""}
                onChange={(e) => update({ endDate: e.target.value })}
                data-testid={`${idPrefix}-end-date`}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={value.durationWeeks ?? 8}
                  onChange={(e) => update({ durationWeeks: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-[100px]"
                  data-testid={`${idPrefix}-duration-weeks`}
                />
                <span className="text-sm text-muted-foreground">week{(value.durationWeeks ?? 8) !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div
        className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm"
        data-testid={`${idPrefix}-summary`}
      >
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="shrink-0 mt-0.5">
            Preview
          </Badge>
          <span className="leading-snug">{summary.fullSentence}</span>
        </div>
      </div>

      {/* Vial count estimator */}
      {vialEstimate && (
        <div
          className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm"
          data-testid={`${idPrefix}-vial-estimate`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Estimated supply
              </div>
              <div className="mt-0.5 font-semibold">
                {vialEstimate.vialsNeeded} vial{vialEstimate.vialsNeeded === 1 ? "" : "s"}{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  ({vialMg} mg each)
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{vialEstimate.totalDoses} doses × {doseMcg} mcg</div>
              <div>= {(vialEstimate.totalMcg / 1000).toFixed(2)} mg total</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Mathematical estimate only — not medical advice. Does not account for priming loss, wastage, or expiration.
          </p>
        </div>
      )}
    </div>
  );
}

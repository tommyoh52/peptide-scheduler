import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Syringe, X as XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DoseRow {
  id: number;
  scheduledAt: number;
  stackItemId: number;
  stackId: number;
  stackName: string;
  peptideName: string;
  doseMcg: number;
  taken: boolean;
  doseLogId: number | null;
  doseLogStatus?: "taken" | "skipped" | null;
  clientId?: number | null;
  clientColor?: string | null;
  clientName?: string | null;
  isActive?: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

export function WeeklyShotTicker() {
  const [openDay, setOpenDay] = useState<number | null>(null);
  const { toast } = useToast();

  const { start, end, days } = useMemo(() => {
    const s = startOfWeek(new Date());
    const e = new Date(s);
    e.setDate(e.getDate() + 7);
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      arr.push(d);
    }
    return { start: s, end: e, days: arr };
  }, []);

  const { data: doses = [], isLoading } = useQuery<DoseRow[]>({
    queryKey: ["/api/my-doses", start.getTime(), end.getTime()],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/my-doses?from=${start.getTime()}&to=${end.getTime()}`,
      );
      return res.json();
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDay = useMemo(() => {
    const map = new Map<number, DoseRow[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const d of doses) {
      const dateObj = new Date(d.scheduledAt);
      const dayIdx = dateObj.getDay();
      map.get(dayIdx)!.push(d);
    }
    for (const arr of Array.from(map.values())) arr.sort((a: DoseRow, b: DoseRow) => a.scheduledAt - b.scheduledAt);
    return map;
  }, [doses]);

  const markMutation = useMutation({
    mutationFn: async (args: { scheduledDoseId: number; status: "taken" | "skipped" }) => {
      const res = await apiRequest("POST", "/api/dose-logs", args);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-doses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dose-logs"] });
    },
    onError: (e: any) => {
      toast({ title: "Could not update dose", description: e?.message, variant: "destructive" });
    },
  });

  const openDoses = openDay != null ? byDay.get(openDay) ?? [] : [];

  return (
    <Card data-testid="card-weekly-shot-ticker">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">This week</h3>
            <p className="text-xs text-muted-foreground">
              Upcoming doses {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {" – "}
              {new Date(end.getTime() - 1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <Syringe className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const dayDoses = byDay.get(i) ?? [];
            const isToday = d.getTime() === today.getTime();
            const takenCount = dayDoses.filter((x) => x.taken).length;
            return (
              <button
                type="button"
                key={i}
                data-testid={`ticker-day-${i}`}
                onClick={() => dayDoses.length > 0 && setOpenDay(i)}
                className={cn(
                  "text-left rounded-lg border p-2 min-h-[76px] flex flex-col transition-colors",
                  isToday
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border bg-card",
                  dayDoses.length > 0 && "hover:bg-accent cursor-pointer",
                )}
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {DAY_LABELS[i]}
                </div>
                <div className="text-sm font-semibold">{d.getDate()}</div>
                <div className="mt-auto flex items-center gap-1 flex-wrap">
                  {dayDoses.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground">&mdash;</span>
                  ) : (
                    dayDoses.slice(0, 4).map((dose) => (
                      <span
                        key={dose.id}
                        title={`${dose.peptideName} \u00b7 ${new Date(dose.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${dose.clientName ? ` \u00b7 ${dose.clientName}` : ""}`}
                        className={cn(
                          "inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] border",
                          dose.doseLogStatus === "skipped"
                            ? "bg-muted text-muted-foreground border-dashed"
                            : dose.taken
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border",
                        )}
                        style={
                          dose.clientColor && !dose.taken && dose.doseLogStatus !== "skipped"
                            ? { backgroundColor: dose.clientColor + "33", borderColor: dose.clientColor }
                            : dose.clientColor && dose.taken
                              ? { backgroundColor: dose.clientColor }
                              : undefined
                        }
                      >
                        {dose.doseLogStatus === "skipped" ? (
                          <XIcon className="h-2.5 w-2.5" />
                        ) : dose.taken ? (
                          <Check className="h-2.5 w-2.5" />
                        ) : (
                          ""
                        )}
                      </span>
                    ))
                  )}
                  {dayDoses.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{dayDoses.length - 4}</span>
                  )}
                </div>
                {dayDoses.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {takenCount}/{dayDoses.length} taken
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {isLoading && (
          <div className="text-xs text-muted-foreground mt-2">Loading&hellip;</div>
        )}
      </CardContent>

      <Dialog open={openDay != null} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-day-doses">
          <DialogHeader>
            <DialogTitle>
              {openDay != null
                ? days[openDay].toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {openDoses.length === 0 ? (
              <div className="text-sm text-muted-foreground">No scheduled doses.</div>
            ) : (
              openDoses.map((dose) => (
                <div
                  key={dose.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  data-testid={`row-dose-${dose.id}`}
                >
                  {dose.clientColor && (
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dose.clientColor }}
                      title={dose.clientName ?? ""}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{dose.peptideName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(dose.scheduledAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" \u00b7 "}
                      {dose.stackName}
                      {dose.clientName ? ` \u00b7 ${dose.clientName}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={
                        dose.doseLogStatus === "taken" || (dose.taken && dose.doseLogStatus !== "skipped")
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        markMutation.mutate({ scheduledDoseId: dose.id, status: "taken" })
                      }
                      disabled={markMutation.isPending}
                      data-testid={`button-taken-${dose.id}`}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Taken
                    </Button>
                    <Button
                      size="sm"
                      variant={dose.doseLogStatus === "skipped" ? "secondary" : "outline"}
                      onClick={() =>
                        markMutation.mutate({ scheduledDoseId: dose.id, status: "skipped" })
                      }
                      disabled={markMutation.isPending}
                      data-testid={`button-skip-${dose.id}`}
                    >
                      <XIcon className="h-3.5 w-3.5 mr-1" /> Skip
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

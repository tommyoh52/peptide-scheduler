import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Check, X as XIcon, Calendar as CalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [showClientSchedules, setShowClientSchedules] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { user } = useSession();
  const { toast } = useToast();

  // Calendar grid: 6 weeks * 7 days to be safe
  const { gridStart, gridEnd, cells } = useMemo(() => {
    const mStart = startOfMonth(anchor);
    const mEnd = endOfMonth(anchor);
    const gStart = new Date(mStart);
    gStart.setDate(mStart.getDate() - mStart.getDay()); // back to Sunday
    const gEnd = new Date(mEnd);
    gEnd.setDate(mEnd.getDate() + (6 - mEnd.getDay())); // forward to Saturday
    gEnd.setHours(23, 59, 59, 999);
    const arr: Date[] = [];
    const cur = new Date(gStart);
    while (cur <= gEnd) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return { gridStart: gStart, gridEnd: gEnd, cells: arr };
  }, [anchor]);

  const { data: doses = [], isLoading } = useQuery<DoseRow[]>({
    queryKey: [
      "/api/my-doses",
      gridStart.getTime(),
      gridEnd.getTime(),
      showClientSchedules,
      showInactive,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: String(gridStart.getTime()),
        to: String(gridEnd.getTime()),
      });
      if (showClientSchedules) params.set("includeClientStacks", "1");
      if (showInactive) params.set("includeInactive", "1");
      const res = await apiRequest("GET", `/api/my-doses?${params}`);
      return res.json();
    },
    enabled: !!user,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, DoseRow[]>();
    for (const d of doses) {
      const dt = new Date(d.scheduledAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    for (const arr of Array.from(map.values())) arr.sort((a: DoseRow, b: DoseRow) => a.scheduledAt - b.scheduledAt);
    return map;
  }, [doses]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mark = useMutation({
    mutationFn: async (args: { scheduledDoseId: number; status: "taken" | "skipped" }) => {
      const res = await apiRequest("POST", "/api/dose-logs", args);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-doses"] });
    },
    onError: (e: any) =>
      toast({ title: "Could not update dose", description: e?.message, variant: "destructive" }),
  });

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const selectedDoses = selectedDay ? byDay.get(dayKey(selectedDay)) ?? [] : [];

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-10 text-center space-y-4">
        <h1 className="text-xl font-semibold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to view your dosing calendar.
        </p>
        <Link href="/auth">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
            <CalIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
            <p className="text-xs text-muted-foreground">
              Monthly view of your scheduled doses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))
            }
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-semibold min-w-[140px] text-center" data-testid="text-month-label">
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))
            }
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(startOfMonth(new Date()))}
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-client-schedules"
            checked={showClientSchedules}
            onCheckedChange={setShowClientSchedules}
            data-testid="switch-client-schedules"
          />
          <Label htmlFor="toggle-client-schedules" className="cursor-pointer">
            Show client schedules
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="toggle-inactive"
            checked={showInactive}
            onCheckedChange={setShowInactive}
            data-testid="switch-inactive"
          />
          <Label htmlFor="toggle-inactive" className="cursor-pointer">
            Show inactive stacks
          </Label>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          {DAY_LABELS.map((d) => (
            <div key={d} className="p-2 text-center border-b border-border">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, idx) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = d.toDateString() === today.toDateString();
            const dayDoses = byDay.get(dayKey(d)) ?? [];
            const takenCount = dayDoses.filter((x) => x.taken).length;
            const skippedCount = dayDoses.filter((x) => x.doseLogStatus === "skipped").length;
            return (
              <button
                type="button"
                key={idx}
                onClick={() => setSelectedDay(d)}
                className={cn(
                  "text-left p-2 min-h-[96px] border-b border-r border-border flex flex-col gap-1",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-primary/5 ring-inset ring-1 ring-primary/40",
                  "hover:bg-accent cursor-pointer",
                )}
                data-testid={`cal-day-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isToday &&
                        "bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {dayDoses.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {takenCount}/{dayDoses.length}
                    </span>
                  )}
                </div>
                {dayDoses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {dayDoses.slice(0, 6).map((dose) => (
                      <span
                        key={dose.id}
                        className={cn(
                          "h-2 w-2 rounded-full",
                          dose.doseLogStatus === "skipped"
                            ? "bg-muted-foreground/40"
                            : dose.taken
                              ? ""
                              : "bg-muted-foreground",
                        )}
                        style={{
                          backgroundColor: dose.clientColor
                            ? dose.taken
                              ? dose.clientColor
                              : dose.clientColor + "88"
                            : undefined,
                        }}
                        title={`${dose.peptideName} \u00b7 ${new Date(dose.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                      />
                    ))}
                    {dayDoses.length > 6 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{dayDoses.length - 6}
                      </span>
                    )}
                  </div>
                )}
                {skippedCount > 0 && (
                  <div className="text-[9px] text-muted-foreground">{skippedCount} skipped</div>
                )}
              </button>
            );
          })}
        </div>
      </Card>
      {isLoading && (
        <div className="text-xs text-muted-foreground mt-2">Loading&hellip;</div>
      )}

      <Dialog open={selectedDay != null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-cal-day">
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? selectedDay.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {selectedDoses.length === 0 ? (
              <div className="text-sm text-muted-foreground">No scheduled doses.</div>
            ) : (
              selectedDoses.map((dose) => (
                <div
                  key={dose.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  data-testid={`row-caldose-${dose.id}`}
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
                      {dose.isActive === 0 ? " \u00b7 (inactive)" : ""}
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
                        mark.mutate({ scheduledDoseId: dose.id, status: "taken" })
                      }
                      disabled={mark.isPending}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Taken
                    </Button>
                    <Button
                      size="sm"
                      variant={dose.doseLogStatus === "skipped" ? "secondary" : "outline"}
                      onClick={() =>
                        mark.mutate({ scheduledDoseId: dose.id, status: "skipped" })
                      }
                      disabled={mark.isPending}
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
    </div>
  );
}

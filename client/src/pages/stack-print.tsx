import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Printer, ArrowLeft } from "lucide-react";
import type { Stack, StackItem } from "@shared/schema";
import { cn } from "@/lib/utils";

type StackWithItems = Stack & { items: StackItem[] };

interface ScheduledDoseWithMeta {
  id: number;
  scheduledAt: number;
  stackItemId: number;
  stackId: number;
  stackName: string;
  peptideName: string;
  doseMcg: number;
  taken: boolean;
  doseLogId: number | null;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function daysInMonthGrid(monthStart: Date) {
  const firstDow = monthStart.getDay(); // 0=Sun
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function StackPrintPage() {
  const { id } = useParams<{ id: string }>();
  const stackId = Number(id);
  const [viewDate, setViewDate] = useState(() => new Date());

  const { data: stack } = useQuery<StackWithItems>({
    queryKey: ["/api/stacks", stackId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/stacks/${stackId}`);
      return res.json();
    },
    enabled: !!stackId,
  });

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const gridDays = useMemo(() => daysInMonthGrid(monthStart), [monthStart]);

  // Fetch doses for grid range
  const gridStart = gridDays[0];
  const gridEnd = new Date(gridDays[gridDays.length - 1]);
  gridEnd.setDate(gridEnd.getDate() + 1);

  const { data: doses = [] } = useQuery<ScheduledDoseWithMeta[]>({
    queryKey: ["/api/my-doses", "print", stackId, gridStart.getTime(), gridEnd.getTime()],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/my-doses?from=${gridStart.getTime()}&to=${gridEnd.getTime()}`,
      );
      const all: ScheduledDoseWithMeta[] = await res.json();
      return all.filter((d) => d.stackId === stackId);
    },
    enabled: !!stackId,
  });

  const dosesByDay = useMemo(() => {
    const map = new Map<string, ScheduledDoseWithMeta[]>();
    for (const d of doses) {
      const key = new Date(d.scheduledAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [doses]);

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0.4in; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; }
          .print-bg { background: white !important; color: black !important; }
        }
      `}</style>
      <div className="print-bg min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-4">
          <div className="no-print flex items-center justify-between">
            <Link href={`/stacks/${stackId}`}>
              <Button variant="ghost" size="sm" data-testid="button-back-stack">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to stack
              </Button>
            </Link>
            <Button onClick={() => window.print()} data-testid="button-print">
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                {stack?.name ?? "Stack"} — Schedule
              </h1>
              <p className="text-xs text-muted-foreground">
                Mathematical calculation and scheduling tool only — not medical advice.
              </p>
            </div>
            <div className="no-print flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[140px] text-center font-semibold text-sm">{monthLabel}</div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="print-only hidden print:block font-semibold text-lg">{monthLabel}</div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-px bg-border border border-border rounded overflow-hidden text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-muted px-2 py-1 text-center font-semibold uppercase tracking-wider">
                {d}
              </div>
            ))}
            {gridDays.map((day) => {
              const inMonth = day >= monthStart && day < monthEnd;
              const isToday = day.getTime() === today.getTime();
              const dayDoses = dosesByDay.get(day.toDateString()) ?? [];
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-card min-h-[90px] p-1.5 print-card",
                    !inMonth && "opacity-40",
                    isToday && "ring-2 ring-primary ring-inset",
                  )}
                  data-testid={`print-day-${day.toISOString().slice(0, 10)}`}
                >
                  <div className="text-[11px] font-semibold mb-1">{day.getDate()}</div>
                  <ul className="space-y-0.5">
                    {dayDoses.slice(0, 5).map((d) => (
                      <li
                        key={d.id}
                        className="text-[9px] leading-tight truncate"
                        title={`${d.peptideName} · ${d.doseMcg} mcg`}
                      >
                        <span className="font-semibold">{new Date(d.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{" "}
                        {d.peptideName}
                      </li>
                    ))}
                    {dayDoses.length > 5 && (
                      <li className="text-[9px] text-muted-foreground">+{dayDoses.length - 5} more</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          {stack && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-2">Stack items</h2>
              <ul className="text-xs space-y-1">
                {stack.items?.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{it.customName ?? `Peptide #${it.peptideId}`}</span>
                    <span className="text-muted-foreground">
                      {it.doseMcg} mcg · {it.frequency} · {it.vialMg} mg vial / {it.bacWaterMl} mL BAC
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Generated by the Peptide App — mathematical calculation and scheduling tool only. Not medical advice.
          </p>
        </div>
      </div>
    </>
  );
}

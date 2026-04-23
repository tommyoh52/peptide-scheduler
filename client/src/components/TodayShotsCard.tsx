import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatDose } from "@/lib/units";
import { useUnitPreference } from "@/lib/unit-preference";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Syringe, Plus } from "lucide-react";

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
}

export function TodayShotsCard() {
  const { preference } = useUnitPreference();
  const { toast } = useToast();

  const { start, end } = useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return { start: s, end: e };
  }, []);

  const { data: doses = [] } = useQuery<DoseRow[]>({
    queryKey: ["/api/my-doses", "today", start.getTime(), end.getTime()],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/my-doses?from=${start.getTime()}&to=${end.getTime()}`,
      );
      return res.json();
    },
  });

  const markTaken = useMutation({
    mutationFn: async ({ scheduledDoseId }: { scheduledDoseId: number }) => {
      const res = await apiRequest("POST", "/api/dose-logs", { scheduledDoseId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-doses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dose-logs"] });
    },
    onError: (e: any) => {
      toast({ title: "Could not record dose", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  const unmarkTaken = useMutation({
    mutationFn: async ({ doseLogId }: { doseLogId: number }) => {
      const res = await apiRequest("DELETE", `/api/dose-logs/${doseLogId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-doses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dose-logs"] });
    },
  });

  if (doses.length === 0) {
    return (
      <Card data-testid="card-today-shots-empty">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Syringe className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">No doses scheduled today</div>
              <div className="text-xs text-muted-foreground">Add a stack to start scheduling.</div>
            </div>
          </div>
          <Link href="/stacks">
            <Button size="sm" variant="outline" data-testid="button-today-view-stacks">
              <Plus className="h-3 w-3 mr-1" /> Stacks
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const takenAll = doses.every((d) => d.taken);

  return (
    <Card data-testid="card-today-shots">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Today</h3>
            <p className="text-xs text-muted-foreground">
              {doses.filter((d) => d.taken).length} of {doses.length} doses taken
            </p>
          </div>
          {takenAll && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <CheckCircle2 className="h-4 w-4" /> All done
            </div>
          )}
        </div>
        <ul className="space-y-2">
          {doses.map((d) => {
            const time = new Date(d.scheduledAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-md border border-border p-2"
                data-testid={`row-today-dose-${d.id}`}
              >
                <Checkbox
                  checked={d.taken}
                  onCheckedChange={(v) => {
                    if (v && !d.taken) {
                      markTaken.mutate({ scheduledDoseId: d.id });
                    } else if (!v && d.taken && d.doseLogId) {
                      unmarkTaken.mutate({ doseLogId: d.doseLogId });
                    }
                  }}
                  data-testid={`check-today-dose-${d.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {d.peptideName}{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      · {formatDose(d.doseMcg, preference)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {d.stackName} · {time}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

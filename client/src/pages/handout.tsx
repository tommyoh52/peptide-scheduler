import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Printer, ArrowLeft, AlertTriangle } from "lucide-react";
import type { Stack, StackItem } from "@shared/schema";
import { formatDose } from "@/lib/units";
import { useUnitPreference } from "@/lib/unit-preference";
import { Logo } from "@/components/logo";

type Mode = "authed" | "public";

interface HandoutData {
  stack: Stack;
  items: Array<StackItem & { peptideName?: string | null }>;
  clientName?: string | null;
  ownerName?: string | null;
}

export default function HandoutPage({ mode }: { mode: Mode }) {
  const params = useParams<{ id?: string; token?: string }>();
  const [, setLocation] = useLocation();
  const { preference } = useUnitPreference();

  const queryKey =
    mode === "public"
      ? (["/api/handout", params.token!] as const)
      : (["/api/stacks", Number(params.id)] as const);

  const { data, isLoading, error } = useQuery<HandoutData | any>({
    queryKey: queryKey as any,
    queryFn: async () => {
      if (mode === "public") {
        const res = await apiRequest("GET", `/api/handout/${params.token}`);
        return res.json();
      }
      const res = await apiRequest("GET", `/api/stacks/${params.id}`);
      return res.json();
    },
    enabled: mode === "public" ? !!params.token : !!params.id,
  });

  // For authenticated route, the shape is Stack & { items }
  const stack: (Stack & { items: StackItem[] }) | null = (() => {
    if (!data) return null;
    if (mode === "public" && data.stack) {
      return { ...data.stack, items: data.items ?? [] } as any;
    }
    return data as any;
  })();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = stack ? `${stack.name} \u2014 Handout` : "Handout";
    }
  }, [stack]);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading&hellip;</div>;
  }
  if (error || !stack) {
    return (
      <div className="p-8 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>This handout is not available.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (mode === "public" ? setLocation("/") : setLocation(`/stacks/${stack.id}`))}
          data-testid="button-back-handout"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          size="sm"
          onClick={() => typeof window !== "undefined" && window.print()}
          data-testid="button-print-handout"
        >
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>

      <div className="space-y-6 bg-card text-foreground rounded-lg p-6 md:p-10 border border-border print:border-0 print:p-0 print:bg-white print:text-black">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Logo size={22} />
              <span className="text-xs uppercase tracking-wider text-muted-foreground print:text-black">
                Peptide Calc &middot; Handout
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-handout-title">
              {stack.name}
            </h1>
            <div className="text-xs text-muted-foreground print:text-black mt-1">
              Starts {stack.startDate} &middot; {stack.durationWeeks} weeks
            </div>
          </div>
        </header>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground print:text-black mb-3">
            Peptides &amp; dosing
          </h2>
          <div className="space-y-3">
            {stack.items.map((it: any, idx: number) => (
              <div
                key={it.id ?? idx}
                className="rounded-lg border border-border p-4 print:p-3 print:break-inside-avoid"
                data-testid={`handout-item-${idx}`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="font-semibold">{it.customName || it.peptideName || "Peptide"}</div>
                  <div className="text-xs text-muted-foreground print:text-black">
                    {it.frequency} &middot; {it.timeOfDay}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground print:text-black">Dose: </span>
                    <span className="font-mono">{formatDose(it.doseMcg, preference)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black">Vial: </span>
                    <span className="font-mono">{it.vialMg} mg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black">BAC water: </span>
                    <span className="font-mono">{it.bacWaterMl} mL</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground print:text-black">Syringe: </span>
                    <span className="font-mono">{it.syringeType}</span>
                  </div>
                </div>
                {it.notes && (
                  <p className="text-xs text-muted-foreground print:text-black mt-2">{it.notes}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive print:border print:border-black print:bg-white print:text-black print:break-inside-avoid">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-1">Not medical advice.</p>
              <p>
                This is a mathematical calculation and scheduling tool only. It is NOT medical
                advice, diagnosis, or treatment. Consult a licensed medical professional before
                using any peptide, medication, or supplement.
              </p>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          nav, aside, header[role="banner"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

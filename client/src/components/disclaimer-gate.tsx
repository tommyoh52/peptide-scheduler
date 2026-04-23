import { useState } from "react";
import { useSession } from "@/lib/session";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DISCLAIMER_TEXT } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert } from "lucide-react";

export function DisclaimerGate() {
  const { loaded, disclaimerAccepted, disclaimerVersion, setDisclaimerAccepted, pendingDisclaimer, setPendingDisclaimer, refetchMe } = useSession();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const shouldShow = loaded && (!disclaimerAccepted || pendingDisclaimer);

  async function handleAccept() {
    if (!disclaimerVersion) return;
    setBusy(true);
    try {
      await apiRequest("POST", "/api/disclaimer/accept", { version: disclaimerVersion });
      setDisclaimerAccepted(true);
      setPendingDisclaimer(false);
      await refetchMe();
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast({ title: "Could not record acceptance", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
      data-testid="disclaimer-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="w-full max-w-2xl rounded-xl border border-card-border bg-card p-6 md:p-8 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 id="disclaimer-title" className="text-xl font-bold tracking-tight" data-testid="text-disclaimer-title">
              Legal Disclaimer — You Must Read
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Required before using this tool. Version {disclaimerVersion}.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed max-h-[50vh] overflow-y-auto">
          <p>{DISCLAIMER_TEXT}</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              window.location.href = "https://www.nationalgeographic.com";
            }}
            data-testid="button-decline-disclaimer"
            className="w-full sm:w-auto"
          >
            No, I Do Not Agree
          </Button>
          <Button
            size="lg"
            onClick={handleAccept}
            disabled={busy}
            data-testid="button-accept-disclaimer"
            className="w-full sm:w-auto"
          >
            {busy ? "Recording…" : "I Agree — Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

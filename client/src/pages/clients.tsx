import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientProfile } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/session";
import { Users, Plus, Lock } from "lucide-react";
import { format } from "date-fns";
import { GOAL_OPTIONS } from "@/lib/dosing-guide";

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const { user, loaded } = useSession();
  const { toast } = useToast();
  const [openNew, setOpenNew] = useState(false);

  const { data: clients, isLoading } = useQuery<ClientProfile[]>({
    queryKey: ["/api/clients"],
    enabled: !!user && user.tier === "pro",
  });

  if (loaded && (!user || user.tier !== "pro")) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-md mx-auto text-center">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
        <h1 className="text-xl font-semibold mb-1">Pro tier required</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Client management is a Pro feature. Upgrade to track client profiles, stacks, and progress.
        </p>
        <Button onClick={() => setLocation(user ? "/account" : "/auth")} data-testid="button-upgrade-prompt">
          {user ? "Upgrade to Pro" : "Sign in"}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-clients-title">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client profiles and track their progress.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)} data-testid="button-new-client">
          <Plus className="h-4 w-4 mr-1" /> New client
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <h2 className="font-semibold mb-1">No clients yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first client to start tracking their peptide protocols.
          </p>
          <Button onClick={() => setOpenNew(true)} data-testid="button-empty-create-client">
            <Plus className="h-4 w-4 mr-1" /> Add client
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="cursor-pointer hover-elevate" data-testid={`card-client-${c.id}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {c.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{c.fullName}</h3>
                    <div className="text-xs text-muted-foreground">
                      {c.gender} · {c.goal.replace("_", " ")}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Added {format(new Date(c.createdAt), "PP")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewClientDialog open={openNew} onOpenChange={setOpenNew} />
    </div>
  );
}

function NewClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("male");
  const [dob, setDob] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [startingWeightKg, setStartingWeightKg] = useState("");
  const [goal, setGoal] = useState("weight_loss");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clients", {
        fullName,
        gender,
        dob: dob || null,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        startingWeightKg: startingWeightKg ? parseFloat(startingWeightKg) : null,
        goal,
        notes: notes || null,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client added" });
      onOpenChange(false);
      setFullName(""); setDob(""); setHeightCm(""); setStartingWeightKg(""); setNotes("");
    },
    onError: () => toast({ title: "Could not create client", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-new-client">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fullName.trim()) return;
            createMut.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="c-name">Full name</Label>
            <Input id="c-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required data-testid="input-client-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="c-gender" data-testid="select-client-gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-dob">DOB</Label>
              <Input id="c-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} data-testid="input-client-dob" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-h">Height (cm)</Label>
              <Input id="c-h" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} data-testid="input-client-height" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-w">Starting weight (kg)</Label>
              <Input id="c-w" type="number" value={startingWeightKg} onChange={(e) => setStartingWeightKg(e.target.value)} data-testid="input-client-weight" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-goal">Goal</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger id="c-goal" data-testid="select-client-goal"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="input-client-notes" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending} data-testid="button-confirm-create-client">
              {createMut.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSession } from "@/lib/session";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import type { CustomPeptide } from "@shared/schema";

const FREQ_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "eod", label: "Every other day" },
  { value: "twice-weekly", label: "2x / week" },
  { value: "3x-weekly", label: "3x / week" },
  { value: "weekly", label: "Weekly" },
  { value: "prn", label: "PRN (as needed)" },
];

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(64),
  category: z.string().max(32).optional(),
  typicalVialMg: z.coerce.number().positive("Must be > 0"),
  recommendedBacMl: z.coerce.number().positive("Must be > 0"),
  typicalDoseMcgMin: z.coerce.number().nonnegative(),
  typicalDoseMcgMax: z.coerce.number().nonnegative(),
  defaultFrequency: z.string().min(1),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  /** Optional controlled open state */
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** Render a trigger button (when uncontrolled) */
  trigger?: React.ReactNode;
  onCreated?: (p: CustomPeptide) => void;
}

export function CustomPeptideDialog({ open, onOpenChange, trigger, onCreated }: Props) {
  const { user } = useSession();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o);
    else setInternalOpen(o);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      typicalVialMg: 5,
      recommendedBacMl: 2,
      typicalDoseMcgMin: 100,
      typicalDoseMcgMax: 500,
      defaultFrequency: "daily",
      notes: "",
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        category: values.category || null,
        typicalVialMg: values.typicalVialMg,
        recommendedBacMl: values.recommendedBacMl,
        typicalDoseMcgMin: values.typicalDoseMcgMin,
        typicalDoseMcgMax: values.typicalDoseMcgMax,
        defaultFrequency: values.defaultFrequency,
        notes: values.notes || null,
      };
      const res = await apiRequest("POST", "/api/custom-peptides", payload);
      return (await res.json()) as CustomPeptide;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-peptides"] });
      toast({ title: "Peptide saved", description: `${created.name} added to your list.` });
      form.reset();
      setDialogOpen(false);
      onCreated?.(created);
    },
    onError: (e: any) => {
      toast({ title: "Could not save", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  function handleTriggerClick(e: React.MouseEvent) {
    if (!user) {
      e.preventDefault();
      e.stopPropagation();
      toast({ title: "Sign up to save your own peptides" });
      setLocation("/auth");
      return;
    }
    // Let the Dialog handle opening
  }

  const defaultTrigger = (
    <Button type="button" variant="outline" size="sm" data-testid="button-add-peptide">
      <Plus className="h-4 w-4 mr-1" /> Add peptide
    </Button>
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild onClick={handleTriggerClick}>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="dialog-add-peptide">
        <DialogHeader>
          <DialogTitle>Add a custom peptide</DialogTitle>
          <DialogDescription>
            Saved to your account. Visible only to you in the calculator and stack builder.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
          className="space-y-3"
          data-testid="form-custom-peptide"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cp-name">Name</Label>
              <Input
                id="cp-name"
                placeholder="e.g. Retatrutide"
                data-testid="input-cp-name"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cp-category">Category (optional)</Label>
              <Input
                id="cp-category"
                placeholder="GLP-1, Healing, Growth…"
                data-testid="input-cp-category"
                {...form.register("category")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-vial">Typical vial (mg)</Label>
              <Input
                id="cp-vial"
                type="number"
                step="0.1"
                inputMode="decimal"
                data-testid="input-cp-vial"
                {...form.register("typicalVialMg")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-bac">Recommended BAC (mL)</Label>
              <Input
                id="cp-bac"
                type="number"
                step="0.1"
                inputMode="decimal"
                data-testid="input-cp-bac"
                {...form.register("recommendedBacMl")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-dose-min">Dose min (mcg)</Label>
              <Input
                id="cp-dose-min"
                type="number"
                step="1"
                inputMode="decimal"
                data-testid="input-cp-dose-min"
                {...form.register("typicalDoseMcgMin")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-dose-max">Dose max (mcg)</Label>
              <Input
                id="cp-dose-max"
                type="number"
                step="1"
                inputMode="decimal"
                data-testid="input-cp-dose-max"
                {...form.register("typicalDoseMcgMax")}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cp-freq">Default frequency</Label>
              <Select
                value={form.watch("defaultFrequency")}
                onValueChange={(v) => form.setValue("defaultFrequency", v)}
              >
                <SelectTrigger id="cp-freq" data-testid="select-cp-freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQ_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cp-notes">Notes (optional)</Label>
              <Textarea
                id="cp-notes"
                rows={2}
                placeholder="Any usage notes for yourself."
                data-testid="input-cp-notes"
                {...form.register("notes")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending} data-testid="button-cp-save">
              {createMut.isPending ? "Saving…" : "Save peptide"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

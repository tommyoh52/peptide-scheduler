import { useState, useEffect } from "react";
import { StackQuizModal } from "@/components/StackQuizModal";
import { Card } from "@/components/ui/card";
import { Wand2 } from "lucide-react";

export default function QuizPage() {
  const [open, setOpen] = useState(true);

  // Reopen automatically if closed without finishing
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setOpen(true), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Build My Stack</h1>
          <p className="text-sm text-muted-foreground">
            Answer a few questions. We will suggest a peptide protocol and schedule.
          </p>
        </div>
      </div>
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          The quiz walks through goals, training, sleep, diet, and experience, then drafts a
          starter stack with suggested dosing. Nothing here is medical advice &mdash; this is a
          mathematical calculation and scheduling tool only.
        </p>
      </Card>
      <StackQuizModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

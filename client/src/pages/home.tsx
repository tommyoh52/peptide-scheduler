import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calculator,
  BookOpen,
  LayoutGrid,
  Users,
  ArrowRight,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { WeeklyShotTicker } from "@/components/WeeklyShotTicker";
import { TodayShotsCard } from "@/components/TodayShotsCard";
import { StackQuizModal } from "@/components/StackQuizModal";
import type { Stack } from "@shared/schema";

export default function HomePage() {
  const { user } = useSession();
  const [quizOpen, setQuizOpen] = useState(false);

  const { data: stacks = [] } = useQuery<Stack[]>({
    queryKey: ["/api/stacks"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stacks");
      return res.json();
    },
    enabled: !!user,
  });

  if (user) {
    // Logged-in: scheduler-first layout
    return (
      <div className="px-4 md:px-8 py-6 md:py-10 max-w-6xl mx-auto space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Welcome back{user.displayName ? `, ${user.displayName}` : ""}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your peptide schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mathematical calculation and scheduling tool only — not medical advice.
          </p>
        </div>

        <WeeklyShotTicker />
        <TodayShotsCard />

        {/* Active stacks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Active stacks</h2>
            <Link href="/stacks">
              <Button variant="ghost" size="sm" data-testid="button-view-all-stacks">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          {stacks.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">No active stacks yet.</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setQuizOpen(true)} data-testid="button-home-quiz">
                    <Sparkles className="h-4 w-4 mr-1" /> Build my stack
                  </Button>
                  <Link href="/stacks/new">
                    <Button variant="outline" data-testid="button-home-new-stack">New stack</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {stacks.slice(0, 4).map((s) => (
                <Link key={s.id} href={`/stacks/${s.id}`}>
                  <Card className="hover-elevate cursor-pointer" data-testid={`card-stack-${s.id}`}>
                    <CardContent className="p-4">
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Started {new Date(s.startDate).toLocaleDateString()} · {s.durationWeeks} weeks
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Build my stack prominent CTA */}
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Build my stack
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Answer 8 quick questions and we'll suggest a personalized starting point.
            </p>
          </div>
          <Button size="lg" onClick={() => setQuizOpen(true)} data-testid="button-start-quiz">
            Start quiz <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </section>

        {/* Secondary tools */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/calculator">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="card-tool-calculator">
                <CardHeader className="space-y-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Reconstitution calculator</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Live concentration, volume, and syringe units.
                </CardContent>
              </Card>
            </Link>
            <Link href="/dosing-guide">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="card-tool-dosing">
                <CardHeader className="space-y-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Dosing guide</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Weight-adjusted ranges by peptide.
                </CardContent>
              </Card>
            </Link>
            <Link href="/stacks">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="card-tool-stacks">
                <CardHeader className="space-y-2">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Stack builder</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Manually compose stacks and schedules.
                </CardContent>
              </Card>
            </Link>
            <Link href="/clients">
              <Card className="hover-elevate cursor-pointer h-full" data-testid="card-tool-clients">
                <CardHeader className="space-y-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    Client management <span className="text-[10px] ml-1 text-primary">PRO</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Coaches: track clients and progress.
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        <StackQuizModal open={quizOpen} onOpenChange={setQuizOpen} />
      </div>
    );
  }

  // Guest: calc-first hero
  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-6xl mx-auto space-y-10">
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Mathematical calculation & scheduling tool
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
          Reconstitute. Dose. <span className="text-primary">Schedule.</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
          Precise math for peptide reconstitution, an evidence-informed dosing guide, and stack scheduling with calendar export. Not medical advice.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/calculator">
            <Button size="lg" data-testid="button-cta-calculator" className="w-full sm:w-auto">
              Open calculator <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setQuizOpen(true)}
            data-testid="button-cta-quiz"
            className="w-full sm:w-auto"
          >
            <Sparkles className="h-4 w-4 mr-1" /> Build my stack
          </Button>
          <Link href="/dosing-guide">
            <Button size="lg" variant="ghost" data-testid="button-cta-dosing" className="w-full sm:w-auto">
              Smart dosing guide
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/calculator">
          <Card className="hover-elevate cursor-pointer h-full" data-testid="card-feature-calculator">
            <CardHeader className="space-y-2">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Reconstitution calculator</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Live concentration, volume and syringe units with a visual fill indicator.
            </CardContent>
          </Card>
        </Link>
        <Link href="/dosing-guide">
          <Card className="hover-elevate cursor-pointer h-full" data-testid="card-feature-dosing">
            <CardHeader className="space-y-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Smart dosing guide</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Goal-based peptide protocols with weight-adjusted dose ranges.
            </CardContent>
          </Card>
        </Link>
        <div onClick={() => setQuizOpen(true)} className="contents">
          <Card className="hover-elevate cursor-pointer h-full" data-testid="card-feature-quiz">
            <CardHeader className="space-y-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Stack builder quiz</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Answer 8 questions and get a suggested peptide protocol.
            </CardContent>
          </Card>
        </div>
        <Link href="/stacks">
          <Card className="hover-elevate cursor-pointer h-full" data-testid="card-feature-stacks">
            <CardHeader className="space-y-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Stack scheduler</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Build peptide stacks and export a scheduled .ics calendar with reminders.
            </CardContent>
          </Card>
        </Link>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Save your stacks. Track progress.</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create a free account to save stacks and export schedules. Upgrade to Pro for client management and progress analytics.
          </p>
        </div>
        <Link href="/auth">
          <Button data-testid="button-home-signup">Create free account</Button>
        </Link>
      </section>

      <StackQuizModal open={quizOpen} onOpenChange={setQuizOpen} />
    </div>
  );
}

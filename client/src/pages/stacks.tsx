import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/session";
import type { Stack } from "@shared/schema";
import { LayoutGrid, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function StacksPage() {
  const [, setLocation] = useLocation();
  const { user, loaded } = useSession();

  if (loaded && !user) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-md mx-auto text-center">
        <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
        <h1 className="text-xl font-semibold mb-1">Sign in to save stacks</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Create and save peptide stacks with scheduled doses and calendar export.
        </p>
        <Button onClick={() => setLocation("/auth")} data-testid="button-stacks-signin">
          Sign in or create account
        </Button>
      </div>
    );
  }

  const { data: stacks, isLoading } = useQuery<Stack[]>({
    queryKey: ["/api/stacks"],
    enabled: !!user,
  });

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-stacks-title">
            My Stacks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-peptide protocols with scheduled doses.
          </p>
        </div>
        <Link href="/stacks/new">
          <Button data-testid="button-new-stack">
            <Plus className="h-4 w-4 mr-1" /> New stack
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !stacks || stacks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <h2 className="font-semibold mb-1">No stacks yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first stack to schedule peptide doses and export to calendar.
          </p>
          <Link href="/stacks/new">
            <Button data-testid="button-empty-create-stack">
              <Plus className="h-4 w-4 mr-1" /> Create your first stack
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {stacks.map((s) => (
            <Link key={s.id} href={`/stacks/${s.id}`}>
              <Card className="cursor-pointer hover-elevate" data-testid={`card-stack-${s.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{s.name}</h3>
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>Starts {format(new Date(s.startDate), "PP")}</span>
                    <span>·</span>
                    <span>{s.durationWeeks} weeks</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

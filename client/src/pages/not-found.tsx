import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="px-4 py-20 max-w-md mx-auto text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2" data-testid="text-404-title">
        Page not found
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        The page you were looking for doesn&apos;t exist.
      </p>
      <Link href="/">
        <Button data-testid="button-go-home">Go home</Button>
      </Link>
    </div>
  );
}

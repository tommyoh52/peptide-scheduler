import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSession } from "@/lib/session";
import { useGuestStacks } from "@/contexts/GuestStackContext";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { setUser, setSessionToken, setDisclaimerAccepted, setPendingDisclaimer, refetchMe } = useSession();
  const { migrateToAccount } = useGuestStacks();
  const { toast } = useToast();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  // Sign in state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPw, setSigninPw] = useState("");

  // Sign up state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        email: signinEmail,
        password: signinPw,
      });
      const data = await res.json();
      setSessionToken(data.sessionToken);
      setUser(data.user);
      await refetchMe();
      queryClient.invalidateQueries();
      toast({ title: "Signed in", description: `Welcome back, ${data.user.displayName}` });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Sign in failed", description: "Check your email and password.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        email,
        password: pw,
        displayName: name,
      });
      const data = await res.json();
      setSessionToken(data.sessionToken);
      setUser(data.user);
      // Force re-accept disclaimer post-register
      setDisclaimerAccepted(false);
      setPendingDisclaimer(true);
      // Migrate any guest stacks accumulated in this session
      try {
        const result = await migrateToAccount();
        if (result.migrated > 0) {
          toast({
            title: "Guest stacks saved",
            description: `${result.migrated} stack${result.migrated > 1 ? "s" : ""} moved to your account.`,
          });
        }
      } catch (e) {
        // non-fatal
      }
      queryClient.invalidateQueries();
      toast({ title: "Account created", description: "Please review the disclaimer." });
      setLocation("/");
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      toast({
        title: "Sign up failed",
        description: msg.includes("409") ? "Email already in use." : "Check your details (password min 8 chars).",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 md:px-8 py-10 max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <span className="text-primary">
          <Logo size={40} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight mt-3">Welcome</h1>
        <p className="text-sm text-muted-foreground">Sign in to save stacks and unlock Pro features.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin" data-testid="tab-signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    required
                    value={signinEmail}
                    onChange={(e) => setSigninEmail(e.target.value)}
                    data-testid="input-signin-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input
                    id="si-pw"
                    type="password"
                    required
                    value={signinPw}
                    onChange={(e) => setSigninPw(e.target.value)}
                    data-testid="input-signin-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit-signin">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Display name</Label>
                  <Input
                    id="su-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-signup-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-signup-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input
                    id="su-pw"
                    type="password"
                    required
                    minLength={8}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    data-testid="input-signup-password"
                  />
                  <p className="text-[11px] text-muted-foreground">Min 8 characters.</p>
                </div>
                <Button type="submit" className="w-full" disabled={busy} data-testid="button-submit-signup">
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

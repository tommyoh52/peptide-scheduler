import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import CalculatorPage from "@/pages/calculator";
import DosingGuidePage from "@/pages/dosing-guide";
import StacksPage from "@/pages/stacks";
import StackEditPage from "@/pages/stack-edit";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import AuthPage from "@/pages/auth";
import AccountPage from "@/pages/account";
import StackPrintPage from "@/pages/stack-print";
import CalendarPage from "@/pages/calendar";
import QuizPage from "@/pages/quiz";
import HandoutPage from "@/pages/handout";
import { SessionProvider } from "@/lib/session";
import { UnitPreferenceProvider } from "@/lib/unit-preference";
import { ThemeProvider } from "@/lib/theme";
import { AppLayout } from "@/components/layout";
import { DisclaimerGate } from "@/components/disclaimer-gate";
import { GuestStackProvider } from "@/contexts/GuestStackContext";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/calculator" component={CalculatorPage} />
      <Route path="/dosing-guide" component={DosingGuidePage} />
      <Route path="/quiz" component={QuizPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/stacks" component={StacksPage} />
      <Route path="/stacks/new" component={StackEditPage} />
      <Route path="/stacks/:id/print" component={StackPrintPage} />
      <Route path="/stacks/:id/handout">
        {() => <HandoutPage mode="authed" />}
      </Route>
      <Route path="/stacks/:id" component={StackEditPage} />
      <Route path="/handout/:token">
        {() => <HandoutPage mode="public" />}
      </Route>
      <Route path="/clients" component={ClientsPage} />
      <Route path="/clients/:id" component={ClientDetailPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/account" component={AccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <GuestStackProvider>
            <UnitPreferenceProvider>
              <TooltipProvider>
                <Toaster />
                <Router hook={useHashLocation}>
                  <AppLayout>
                    <AppRouter />
                  </AppLayout>
                  <DisclaimerGate />
                </Router>
              </TooltipProvider>
            </UnitPreferenceProvider>
          </GuestStackProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

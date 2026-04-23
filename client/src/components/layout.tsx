import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { useGuestStacks } from "@/contexts/GuestStackContext";
import { Logo } from "./logo";
import {
  Calculator,
  ClipboardList,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  Moon,
  Sun,
  User,
  Users,
  BookOpen,
  Calendar as CalendarIcon,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  proOnly?: boolean;
  authRequired?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/dosing-guide", label: "Dosing Guide", icon: BookOpen },
  { href: "/quiz", label: "Build My Stack", icon: Wand2 },
  { href: "/stacks", label: "My Stacks", icon: LayoutGrid, authRequired: true },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, authRequired: true },
  { href: "/clients", label: "Clients", icon: Users, proOnly: true },
  { href: "/account", label: "Account", icon: User, authRequired: true },
];

function NavLink({ item, active, mobile }: { item: NavItem; active: boolean; mobile?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover-elevate",
        mobile ? "flex-col gap-1 py-2 px-2 text-[10px]" : "",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
          : "text-sidebar-foreground/80",
      )}
    >
      <Icon className={cn(mobile ? "h-5 w-5" : "h-4 w-4", active && "text-primary")} />
      <span>{item.label}</span>
      {item.proOnly && !mobile && (
        <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1.5 h-4">
          PRO
        </Badge>
      )}
    </Link>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useSession();
  const { theme, toggle } = useTheme();
  const { guestStacks } = useGuestStacks();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const showGuestBanner = !user && guestStacks.length > 0 && !bannerDismissed;

  const visibleItems = NAV.filter((item) => {
    if (item.proOnly) return user?.tier === "pro";
    if (item.authRequired) return !!user;
    return true;
  });

  const mobileItems = visibleItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
            <span className="text-primary">
              <Logo size={26} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-tight">Peptide Calc</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Clinical tool
              </span>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {visibleItems.map((item) => (
              <NavLink key={item.href} item={item} active={location === item.href || (item.href !== "/" && location.startsWith(item.href))} />
            ))}
          </nav>
          <div className="p-2 border-t border-sidebar-border">
            {user ? (
              <div className="flex items-center gap-2 p-2 rounded-lg">
                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" data-testid="text-user-name">{user.displayName}</div>
                  <div className="flex items-center gap-1">
                    <Badge variant={user.tier === "pro" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5" data-testid="badge-tier">
                      {user.tier.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/auth"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover-elevate"
                data-testid="link-sign-in"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {showGuestBanner && (
            <div
              className="sticky top-0 z-30 bg-primary/15 border-b border-primary/30 text-foreground px-4 py-2.5 flex items-center gap-3"
              data-testid="banner-guest-stack"
            >
              <div className="flex-1 text-sm">
                <span className="font-medium">
                  {guestStacks.length} stack
                  {guestStacks.length > 1 ? "s" : ""} saved in this session.
                </span>{" "}
                <Link
                  href="/auth"
                  className="underline underline-offset-2 font-semibold text-primary"
                  data-testid="link-guest-signup"
                >
                  Sign up free
                </Link>{" "}
                to save and enable reminders.
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss"
                data-testid="button-dismiss-guest-banner"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {/* Top bar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 bg-background/80 backdrop-blur z-20">
            <div className="md:hidden flex items-center gap-2">
              <span className="text-primary">
                <Logo size={22} />
              </span>
              <span className="text-sm font-bold tracking-tight">Peptide Calc</span>
            </div>
            <div className="hidden md:block text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Reconstitution</span>, scheduling &amp; progress
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="Toggle theme"
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user ? (
                <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out" data-testid="button-logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              ) : (
                <Link href="/auth">
                  <Button size="sm" variant="outline" data-testid="button-header-signin">
                    Sign in
                  </Button>
                </Link>
              )}
            </div>
          </header>

          <main className="flex-1 pb-20 md:pb-0">{children}</main>

          <Footer />
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar/95 backdrop-blur border-t border-sidebar-border z-30"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 gap-1 p-1">
          {mobileItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
              mobile
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-4 px-4 md:px-6 text-xs text-muted-foreground">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <p data-testid="text-footer-disclaimer">
          <span className="font-semibold text-foreground/90">Not medical advice.</span> Consult your physician before using any peptide, medication, or supplement.
        </p>
        <p className="text-[10px] uppercase tracking-wider">Mathematical calculation tool only</p>
      </div>
    </footer>
  );
}

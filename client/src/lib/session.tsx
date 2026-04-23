import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiRequest, setSessionToken as setTokenInClient, queryClient } from "./queryClient";

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  tier: "free" | "pro";
  unitPreference?: "auto" | "mcg" | "mg";
  weightUnit?: "lb" | "kg";
  heightUnit?: "imperial" | "metric";
  showClientSchedulesOnCalendar?: number;
}

interface SessionContextValue {
  user: AuthUser | null;
  sessionToken: string | null;
  deviceId: string | null;
  disclaimerAccepted: boolean;
  disclaimerVersion: string | null;
  pendingDisclaimer: boolean; // true when a just-registered user must re-accept
  loaded: boolean;
  setUser: (u: AuthUser | null) => void;
  setSessionToken: (t: string | null) => void;
  setDisclaimerAccepted: (v: boolean) => void;
  setPendingDisclaimer: (v: boolean) => void;
  refetchMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "peptide_app_session";

// Safe localStorage wrappers — never throw (sandboxed iframe / private mode safety)
function safeGet(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}
function safeSet(v: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (v == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [disclaimerVersion, setDisclaimerVersion] = useState<string | null>(null);
  const [pendingDisclaimer, setPendingDisclaimer] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const setSessionToken = useCallback((t: string | null) => {
    setSessionTokenState(t);
    setTokenInClient(t);
    safeSet(t);
  }, []);

  const refetchMe = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/session/me");
      const data = await res.json();
      setUser(data.user);
      setDisclaimerAccepted(!!data.disclaimerAccepted);
      setDisclaimerVersion(data.disclaimerVersion ?? null);
    } catch {
      // ignore
    }
  }, []);

  const initFreshGuest = useCallback(async () => {
    try {
      const res = await fetch(
        ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__") + "/api/session/init",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      const data = await res.json();
      setSessionToken(data.sessionToken);
      setDeviceId(data.deviceId);
      setDisclaimerAccepted(!!data.disclaimerAccepted);
      setDisclaimerVersion(data.disclaimerVersion);
    } catch {
      // ignore
    }
  }, [setSessionToken]);

  const logout = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setUser(null);
    setSessionToken(null);
    setDisclaimerAccepted(false);
    queryClient.clear();
    await initFreshGuest();
  }, [setSessionToken, initFreshGuest]);

  // Bootstrap session on mount — try localStorage first, verify, else init fresh
  useEffect(() => {
    (async () => {
      const stored = safeGet();
      if (stored) {
        setSessionToken(stored);
        // Verify with /api/session/me
        try {
          const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
          const res = await fetch(`${API_BASE}/api/session/me`, {
            headers: { "x-session-token": stored },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setDisclaimerAccepted(!!data.disclaimerAccepted);
            setDisclaimerVersion(data.disclaimerVersion ?? null);
            setLoaded(true);
            return;
          }
          // If not ok, fall through to init a fresh guest
          safeSet(null);
        } catch {
          // fall through
        }
      }
      await initFreshGuest();
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        sessionToken,
        deviceId,
        disclaimerAccepted,
        disclaimerVersion,
        pendingDisclaimer,
        loaded,
        setUser,
        setSessionToken,
        setDisclaimerAccepted,
        setPendingDisclaimer,
        refetchMe,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

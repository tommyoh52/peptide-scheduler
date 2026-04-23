import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiRequest } from "./queryClient";
import { useSession } from "./session";
import type { UnitPreference } from "./units";

interface UnitPreferenceContextValue {
  preference: UnitPreference;
  setPreference: (p: UnitPreference) => Promise<void>;
}

const UnitPreferenceContext = createContext<UnitPreferenceContextValue | null>(null);

export function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [preference, setPreferenceState] = useState<UnitPreference>("auto");

  // Sync from user record when it loads / changes.
  useEffect(() => {
    if (user) {
      const pref = (user as any).unitPreference as UnitPreference | undefined;
      if (pref && pref !== preference) {
        setPreferenceState(pref);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, (user as any)?.unitPreference]);

  const setPreference = useCallback(
    async (p: UnitPreference) => {
      setPreferenceState(p);
      if (user) {
        try {
          await apiRequest("PATCH", "/api/me", { unitPreference: p });
        } catch {
          // ignore — state still reflects UI choice
        }
      }
    },
    [user],
  );

  return (
    <UnitPreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </UnitPreferenceContext.Provider>
  );
}

export function useUnitPreference() {
  const ctx = useContext(UnitPreferenceContext);
  if (!ctx) throw new Error("useUnitPreference must be used within UnitPreferenceProvider");
  return ctx;
}

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { ScheduleSpec } from "@shared/schema";
import type { SyringeType } from "@/lib/reconstitution";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface GuestStackItem {
  peptideId: number | null;
  customName: string;
  vialMg: number;
  bacWaterMl: number;
  doseMcg: number;
  syringeType: SyringeType;
  frequency: string; // legacy string
  timeOfDay: string;
  durationDays: number;
  notes: string | null;
  scheduleJson: string | null;
}

export interface GuestStack {
  id: string; // client-side uuid
  name: string;
  startDate: string;
  durationWeeks: number;
  notificationsEnabled: boolean;
  items: GuestStackItem[];
}

interface GuestStackContextValue {
  guestStacks: GuestStack[];
  addGuestStack: (stack: GuestStack) => void;
  clearGuestStacks: () => void;
  migrateToAccount: () => Promise<{ migrated: number }>;
}

const GuestStackContext = createContext<GuestStackContextValue | null>(null);

function uid() {
  return (
    "gs_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

export function GuestStackProvider({ children }: { children: ReactNode }) {
  const [guestStacks, setGuestStacks] = useState<GuestStack[]>([]);

  const addGuestStack = useCallback((stack: GuestStack) => {
    const withId: GuestStack = { ...stack, id: stack.id || uid() };
    setGuestStacks((prev) => [...prev, withId]);
  }, []);

  const clearGuestStacks = useCallback(() => {
    setGuestStacks([]);
  }, []);

  const migrateToAccount = useCallback(async () => {
    let migrated = 0;
    for (const stack of guestStacks) {
      try {
        const res = await apiRequest("POST", "/api/stacks", {
          name: stack.name,
          startDate: stack.startDate,
          durationWeeks: stack.durationWeeks,
          notificationsEnabled: stack.notificationsEnabled ? 1 : 0,
          clientId: null,
        });
        const created = await res.json();
        for (const it of stack.items) {
          await apiRequest("POST", "/api/stack-items", {
            stackId: created.id,
            peptideId: it.peptideId,
            customName: it.customName || null,
            vialMg: it.vialMg,
            bacWaterMl: it.bacWaterMl,
            doseMcg: it.doseMcg,
            syringeType: it.syringeType,
            frequency: it.frequency,
            timeOfDay: it.timeOfDay,
            durationDays: it.durationDays,
            notes: it.notes,
            scheduleJson: it.scheduleJson,
          });
        }
        migrated += 1;
      } catch (e) {
        console.error("migration failed for stack", stack.name, e);
      }
    }
    if (migrated > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/stacks"] });
      setGuestStacks([]);
    }
    return { migrated };
  }, [guestStacks]);

  return (
    <GuestStackContext.Provider
      value={{ guestStacks, addGuestStack, clearGuestStacks, migrateToAccount }}
    >
      {children}
    </GuestStackContext.Provider>
  );
}

export function useGuestStacks() {
  const ctx = useContext(GuestStackContext);
  if (!ctx) throw new Error("useGuestStacks must be used within GuestStackProvider");
  return ctx;
}

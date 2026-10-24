"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Payment, Task } from "@/lib/types";
import type { DateOnly } from "@/lib/dates";

interface DialogState {
  quickAdd: { open: boolean; tab: "quick" | "paste" };
  task: { open: boolean; collaborationId: string | null; task: Task | null };
  payment: { open: boolean; collaborationId: string | null; payment: Payment | null };
  command: boolean;
}

interface AppUI extends DialogState {
  today: DateOnly;
  currency: string;
  openQuickAdd: (tab?: "quick" | "paste") => void;
  openTask: (opts?: { collaborationId?: string | null; task?: Task | null }) => void;
  openPayment: (opts?: { collaborationId?: string | null; payment?: Payment | null }) => void;
  setCommand: (open: boolean) => void;
  close: (key: "quickAdd" | "task" | "payment") => void;
}

const Ctx = createContext<AppUI | null>(null);

const initial: DialogState = {
  quickAdd: { open: false, tab: "quick" },
  task: { open: false, collaborationId: null, task: null },
  payment: { open: false, collaborationId: null, payment: null },
  command: false,
};

export function AppUIProvider({ today, currency, children }: { today: DateOnly; currency: string; children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(initial);

  const openQuickAdd = useCallback((tab: "quick" | "paste" = "quick") => {
    setState((s) => ({ ...s, command: false, quickAdd: { open: true, tab } }));
  }, []);
  const openTask = useCallback((opts: { collaborationId?: string | null; task?: Task | null } = {}) => {
    setState((s) => ({
      ...s,
      command: false,
      task: { open: true, collaborationId: opts.collaborationId ?? opts.task?.collaborationId ?? null, task: opts.task ?? null },
    }));
  }, []);
  const openPayment = useCallback((opts: { collaborationId?: string | null; payment?: Payment | null } = {}) => {
    setState((s) => ({
      ...s,
      command: false,
      payment: { open: true, collaborationId: opts.collaborationId ?? opts.payment?.collaborationId ?? null, payment: opts.payment ?? null },
    }));
  }, []);
  const setCommand = useCallback((open: boolean) => setState((s) => ({ ...s, command: open })), []);
  const close = useCallback((key: "quickAdd" | "task" | "payment") => {
    setState((s) => ({ ...s, [key]: { ...s[key], open: false } }));
  }, []);

  const value = useMemo<AppUI>(
    () => ({ ...state, today, currency, openQuickAdd, openTask, openPayment, setCommand, close }),
    [state, today, currency, openQuickAdd, openTask, openPayment, setCommand, close],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useAppUI(): AppUI {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppUI must be used inside AppUIProvider");
  return ctx;
}

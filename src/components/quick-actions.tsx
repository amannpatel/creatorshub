"use client";

import { CheckSquare, ClipboardPaste, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppUI } from "@/components/app-ui";

export function QuickActions() {
  const ui = useAppUI();
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      <Button onClick={() => ui.openQuickAdd("quick")}>
        <Plus /> Add collaboration
      </Button>
      <Button variant="outline" onClick={() => ui.openQuickAdd("paste")}>
        <ClipboardPaste /> Paste email
      </Button>
      <Button variant="outline" onClick={() => ui.openTask()}>
        <CheckSquare /> Add task / reminder
      </Button>
      <Button variant="outline" onClick={() => ui.openPayment()}>
        <Wallet /> Record payment
      </Button>
      <Button variant="outline" onClick={() => ui.setCommand(true)}>
        <Search /> Search
      </Button>
    </div>
  );
}

export function AddButtons({ variant = "default" }: { variant?: "default" | "empty" }) {
  const ui = useAppUI();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => ui.openQuickAdd("quick")}>
        <Plus /> {variant === "empty" ? "Add your first collaboration" : "Add collaboration"}
      </Button>
      <Button variant="outline" onClick={() => ui.openQuickAdd("paste")}>
        <ClipboardPaste /> Paste an email
      </Button>
    </div>
  );
}

export function NewTaskButton({ collaborationId, label = "Add task", size = "default", variant = "default" }: { collaborationId?: string; label?: string; size?: "default" | "sm"; variant?: "default" | "outline" | "ghost" }) {
  const ui = useAppUI();
  return (
    <Button size={size} variant={variant} onClick={() => ui.openTask({ collaborationId })}>
      <Plus /> {label}
    </Button>
  );
}

export function RecordPaymentButton({ collaborationId, label = "Record payment", size = "default", variant = "default" }: { collaborationId?: string; label?: string; size?: "default" | "sm"; variant?: "default" | "outline" | "ghost" }) {
  const ui = useAppUI();
  return (
    <Button size={size} variant={variant} onClick={() => ui.openPayment({ collaborationId })}>
      <Wallet /> {label}
    </Button>
  );
}

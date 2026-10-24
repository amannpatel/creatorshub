"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme";
import {
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardPaste,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAppUI } from "@/components/app-ui";
import { searchEverything } from "@/server/actions/settings";
import type { SearchHit } from "@/lib/types";

const HIT_ICON = { collaboration: Briefcase, brand: Building2, task: CheckSquare } as const;

export function CommandPalette() {
  const ui = useAppUI();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const t = setTimeout(() => {
      searchEverything(q)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim()) {
      setLoading(true);
    } else {
      setHits([]);
      setLoading(false);
    }
  }

  const actions = useMemo(
    () => [
      { id: "new", label: "Add collaboration", icon: Plus, shortcut: "N", run: () => ui.openQuickAdd("quick") },
      { id: "paste", label: "Paste email / DM to import", icon: ClipboardPaste, run: () => ui.openQuickAdd("paste") },
      { id: "task", label: "Add task", icon: CheckSquare, shortcut: "T", run: () => ui.openTask() },
      { id: "payment", label: "Record payment", icon: Wallet, run: () => ui.openPayment() },
      { id: "theme", label: "Toggle dark mode", icon: Moon, run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark") },
    ],
    [ui, resolvedTheme, setTheme],
  );
  const pages = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/collaborations", label: "Collaborations", icon: Briefcase },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/payments", label: "Payments", icon: Wallet },
    { href: "/brands", label: "Brands", icon: Building2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);

  function close() {
    ui.setCommand(false);
    onQueryChange("");
  }
  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <CommandDialog open={ui.command} onOpenChange={(o) => (o ? ui.setCommand(true) : close())} title="Search" description="Search collaborations, brands and tasks">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search brands, campaigns, contacts, notes…" value={query} onValueChange={onQueryChange} />
        <CommandList>
          <CommandEmpty>{loading ? "Searching…" : "No results."}</CommandEmpty>
          {hits.length > 0 && (
            <CommandGroup heading="Results">
              {hits.map((h) => {
                const Icon = HIT_ICON[h.kind];
                return (
                  <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind}-${h.id}`} onSelect={() => go(h.href)}>
                    <Icon />
                    <div className="min-w-0">
                      <p className="truncate">{h.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {actions.some((a) => match(a.label)) && (
            <CommandGroup heading="Quick actions">
              {actions.filter((a) => match(a.label)).map((a) => (
                <CommandItem
                  key={a.id}
                  value={a.id}
                  onSelect={() => {
                    close();
                    a.run();
                  }}
                >
                  <a.icon />
                  {a.label}
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {pages.some((p) => match(p.label)) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Go to">
                {pages.filter((p) => match(p.label)).map((p) => (
                  <CommandItem key={p.href} value={p.href} onSelect={() => go(p.href)}>
                    <p.icon />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

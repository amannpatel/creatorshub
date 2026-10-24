"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppUIProvider, useAppUI } from "@/components/app-ui";
import { QuickAddDialog } from "@/components/collab/quick-add-dialog";
import { TaskDialog } from "@/components/task-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { CommandPalette } from "./command-palette";
import { logout } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import { relativeDayLabel, type DateOnly } from "@/lib/dates";
import type { FocusItem } from "@/lib/attention";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/collaborations", label: "Collaborations", icon: Briefcase },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/brands", label: "Brands", icon: Building2 },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

interface ShellProps {
  user: { name: string; email: string };
  today: DateOnly;
  currency: string;
  reminders: FocusItem[];
  children: React.ReactNode;
}

export function AppShell(props: ShellProps) {
  return (
    <AppUIProvider today={props.today} currency={props.currency}>
      <ShellInner {...props} />
    </AppUIProvider>
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function ShellInner({ user, today, reminders, children }: ShellProps) {
  const pathname = usePathname();
  const ui = useAppUI();
  const { setCommand, openQuickAdd, openTask } = ui;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      if (e.key === "n") {
        e.preventDefault();
        openQuickAdd("quick");
      } else if (e.key === "t") {
        e.preventDefault();
        openTask();
      } else if (e.key === "/") {
        e.preventDefault();
        setCommand(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommand, openQuickAdd, openTask]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">CreatorsHub</span>
        </Link>
        <Button className="mb-4 w-full justify-start" onClick={() => openQuickAdd("quick")}>
          <Plus /> New collaboration
          <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 text-[10px]">N</kbd>
        </Button>
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 lg:px-8">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="font-semibold tracking-tight">CreatorsHub</span>
          </Link>
          <button
            type="button"
            onClick={() => setCommand(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted lg:ml-0 lg:w-80"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden lg:inline">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded border bg-background px-1.5 text-[10px] lg:inline">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1 lg:ml-auto">
            <Reminders items={reminders} today={today} />
            <div className="lg:hidden">
              <UserMenu user={user} compact />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <MobileNav pathname={pathname} onAdd={() => openQuickAdd("quick")} />

      <QuickAddDialog />
      <TaskDialog />
      <PaymentDialog />
      <CommandPalette />
    </div>
  );
}

function MobileNav({ pathname, onAdd }: { pathname: string; onAdd: () => void }) {
  const items = [NAV[0], NAV[1], null, NAV[2], NAV[4]];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {items.map((item) =>
          item ? (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[11px]",
                isActive(pathname, item.href) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label === "Collaborations" ? "Collabs" : item.label}
            </Link>
          ) : (
            <div key="add" className="flex justify-center">
              <button
                type="button"
                onClick={onAdd}
                aria-label="Add collaboration"
                className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
              >
                <Plus className="size-6" />
              </button>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}

function Reminders({ items, today }: { items: FocusItem[]; today: DateOnly }) {
  const overdue = items.filter((i) => i.urgency === "overdue").length;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label={`Reminders (${items.length})`}>
            <Bell />
            {items.length > 0 && (
              <span
                className={cn(
                  "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
                  overdue ? "bg-red-500" : "bg-orange-500",
                )}
              >
                {items.length > 9 ? "9+" : items.length}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Needs attention</p>
          <p className="text-xs text-muted-foreground">Overdue and due today · in-app reminders</p>
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
          ) : (
            items.slice(0, 15).map((i) => (
              <Link
                key={i.id}
                href={i.collaborationId ? `/collaborations/${i.collaborationId}` : "/tasks"}
                className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.urgency === "overdue" ? "bg-red-500" : "bg-orange-500")} />
                <span className="min-w-0">
                  <span className="block truncate">{i.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.reason}
                    {i.dueDate ? ` · ${relativeDayLabel(i.dueDate, today)}` : ""}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="border-t p-1">
          <Link href="/" className="block rounded-md px-2 py-1.5 text-center text-xs text-primary hover:bg-muted">
            Open dashboard
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user, compact = false }: { user: { name: string; email: string }; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          compact ? (
            <Button variant="ghost" size="icon" aria-label="Account menu" />
          ) : (
            <button type="button" className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted" />
          )
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initials || "?"}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun /> Light {theme === "light" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon /> Dark {theme === "dark" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor /> System {theme === "system" && "✓"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {compact && (
          <>
            <DropdownMenuItem render={<Link href="/calendar" />}>
              <CalendarDays /> Calendar
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/brands" />}>
              <Building2 /> Brands
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

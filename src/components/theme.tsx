"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

export type Theme = "light" | "dark" | "system";
const EVENT = "themechange";

function readTheme(): Theme {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function systemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readTheme() === "system") apply("system");
    callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", onSystem);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "system");
  const resolvedTheme = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { theme, resolvedTheme, setTheme };
}

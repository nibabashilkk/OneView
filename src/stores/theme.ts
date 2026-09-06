import { writable } from "svelte/store";
import type { AppTheme } from "../lib/contracts";

export type ResolvedTheme = "light" | "dark";

const KEY = "mdviewer.theme";
const systemQuery = typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");
let selectedTheme: AppTheme = readInitial();

function readInitial(): AppTheme {
  if (typeof localStorage === "undefined") return "system";
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function resolve(theme: AppTheme): ResolvedTheme {
  const prefersDark = systemQuery?.matches ?? false;
  return theme === "dark" || (theme === "system" && prefersDark) ? "dark" : "light";
}

function apply(theme: AppTheme) {
  const resolved = resolve(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.theme = resolved;
  resolvedTheme.set(resolved);
}

export const resolvedTheme = writable<ResolvedTheme>(resolve(selectedTheme));

function createThemeStore() {
  const store = writable<AppTheme>(selectedTheme);
  store.subscribe((value) => {
    if (typeof window === "undefined") return;
    selectedTheme = value;
    localStorage.setItem(KEY, value);
    apply(value);
  });
  return store;
}

export const theme = createThemeStore();

systemQuery?.addEventListener("change", () => {
  if (selectedTheme === "system") apply(selectedTheme);
});

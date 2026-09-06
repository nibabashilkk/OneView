// Apply both light/dark mode and the last validated semantic theme snapshot before Svelte mounts.
// Theme plugins are declarative: this cache contains CSS token strings only, never executable code.
type StoredTheme = "light" | "dark" | "system";
type BootstrapCache = { family: string; variant: "light" | "dark"; tokens: Record<string, string> };

function tokenToCssVariable(token: string) {
  return `--theme-${token.replace(".", "-").replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}

try {
  const stored = localStorage.getItem("mdviewer.theme") as StoredTheme | null;
  const theme: StoredTheme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";

  const raw = localStorage.getItem("mdviewer.theme-bootstrap.v1");
  if (raw) {
    const cache = JSON.parse(raw) as BootstrapCache;
    if (cache && cache.variant === (dark ? "dark" : "light") && cache.tokens && typeof cache.tokens === "object") {
      for (const [token, value] of Object.entries(cache.tokens)) {
        if (/^(app|reader|syntax)\.[A-Za-z][A-Za-z0-9]*$/.test(token) && typeof value === "string" && value.length <= 160) {
          root.style.setProperty(tokenToCssVariable(token), value);
        }
      }
      root.dataset.themeFamily = String(cache.family || "default").slice(0, 80);
    }
  }
} catch {
  // The normal theme registry remains the authoritative fallback.
}

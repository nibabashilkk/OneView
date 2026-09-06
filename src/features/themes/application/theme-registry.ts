import { get } from "svelte/store";
import { resolvedTheme } from "../../../stores/theme";
import { DEFAULT_THEMES } from "../builtin/default-theme";
import { createThemeRegistryStore, tokenToCssVariable, validateThemeDefinition, type RegisteredTheme, type ThemeContributionManifest, type ThemeFamily, type ThemeRegistrySnapshot, type ThemeTokenKey, type ThemeTokens, type ThemeVariant } from "../domain/theme";

const SELECTION_KEY = "mdviewer.theme-family.v1";
const CACHE_KEY = "mdviewer.theme-bootstrap.v1";

type ThemeSource = { pluginId: string; pluginName: string; definitions: Array<{ manifest: ThemeContributionManifest; raw: string }> };

class ThemeRegistry {
  private readonly themes = new Map<string, RegisteredTheme>();
  private selectedFamily = readSelection();
  private readonly store = createThemeRegistryStore({ families: [], selectedFamily: this.selectedFamily, activeThemeId: null });
  readonly state = this.store.readable;

  constructor() {
    for (const theme of DEFAULT_THEMES) this.themes.set(theme.id, theme);
    this.publishAndApply();
    resolvedTheme.subscribe(() => this.publishAndApply());
  }

  replacePluginThemes(sources: ThemeSource[]) {
    // Validate the whole new registry before mutating the live one. A malformed
    // development theme therefore cannot leave a half-replaced family behind.
    const candidate = new Map<string, RegisteredTheme>([...this.themes].filter(([, theme]) => theme.builtin));
    const ids = new Set<string>();
    const familyScopes = new Map<string, string>();
    const variants = new Set<string>();
    for (const theme of candidate.values()) {
      ids.add(theme.id.toLowerCase());
      const family = theme.family.toLowerCase();
      familyScopes.set(family, [...theme.scope].sort().join("|"));
      variants.add(`${family}:${theme.variant}`);
    }

    for (const source of sources) {
      for (const entry of source.definitions) {
        const parsed = JSON.parse(entry.raw) as unknown;
        const definition = validateThemeDefinition(parsed, entry.manifest);
        const themeId = definition.id.toLowerCase();
        if (ids.has(themeId)) throw new Error(`重复的 theme id：${definition.id}`);
        ids.add(themeId);

        const family = definition.family.toLowerCase();
        const scopeKey = [...definition.scope].sort().join("|");
        const existingScope = familyScopes.get(family);
        if (existingScope && existingScope !== scopeKey) throw new Error(`主题 family ${definition.family} 的 Light / Dark scope 必须一致`);
        familyScopes.set(family, scopeKey);

        const variantKey = `${family}:${definition.variant}`;
        if (variants.has(variantKey)) throw new Error(`主题 family ${definition.family} 重复声明 ${definition.variant} variant`);
        variants.add(variantKey);

        candidate.set(definition.id, { ...definition, label: entry.manifest.label, pluginId: source.pluginId, pluginName: source.pluginName, builtin: false });
      }
    }

    this.themes.clear();
    for (const [id, theme] of candidate) this.themes.set(id, theme);
    this.publishAndApply();
  }

  selectFamily(family: string) {
    if (!this.families().some((item) => item.id === family)) throw new Error(`主题 family 不存在：${family}`);
    this.selectedFamily = family;
    try { localStorage.setItem(SELECTION_KEY, family); } catch {}
    this.publishAndApply();
  }

  reapply() { this.publishAndApply(); }

  activeTheme(variant = get(resolvedTheme)): RegisteredTheme {
    const families = this.families();
    const selected = families.find((item) => item.id === this.selectedFamily);
    const fallback = families.find((item) => item.id === "default")?.variants[variant] ?? DEFAULT_THEMES[variant === "dark" ? 1 : 0];
    return selected?.variants[variant] ?? fallback;
  }

  activeTokens(variant = get(resolvedTheme)): ThemeTokens {
    const fallback = DEFAULT_THEMES[variant === "dark" ? 1 : 0].tokens as ThemeTokens;
    const active = this.activeTheme(variant);
    return { ...fallback, ...active.tokens };
  }

  private families(): ThemeFamily[] {
    const map = new Map<string, ThemeFamily>();
    for (const theme of this.themes.values()) {
      let family = map.get(theme.family);
      if (!family) {
        family = { id: theme.family, label: theme.label, pluginId: theme.pluginId, pluginName: theme.pluginName, builtin: theme.builtin, variants: {} };
        map.set(theme.family, family);
      }
      family.variants[theme.variant] = theme;
    }
    return [...map.values()].sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.label.localeCompare(b.label));
  }

  private publishAndApply() {
    const families = this.families();
    if (!families.some((item) => item.id === this.selectedFamily)) this.selectedFamily = "default";
    const variant = get(resolvedTheme);
    const active = this.activeTheme(variant);
    const tokens = this.activeTokens(variant);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      for (const [token, value] of Object.entries(tokens)) root.style.setProperty(tokenToCssVariable(token as ThemeTokenKey), value);
      root.dataset.themeFamily = this.selectedFamily;
      root.dataset.themePlugin = active.pluginId;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ family: this.selectedFamily, variant, tokens }));
      } catch {}
    }
    this.store.set({ families, selectedFamily: this.selectedFamily, activeThemeId: active.id } satisfies ThemeRegistrySnapshot);
  }
}

function readSelection() {
  try { return localStorage.getItem(SELECTION_KEY) || "default"; } catch { return "default"; }
}

export const themeRegistry = new ThemeRegistry();
export const themeRegistryState = themeRegistry.state;

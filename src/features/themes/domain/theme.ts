import { writable, type Readable } from "svelte/store";

export type ThemeVariant = "light" | "dark";
export type ThemeScope = "app" | "reader" | "syntax";

export const THEME_TOKEN_KEYS = [
  "app.background",
  "app.surface",
  "app.surfaceMuted",
  "app.border",
  "app.text",
  "app.textMuted",
  "app.accent",
  "app.accentText",
  "app.hover",
  "app.shadow",
  "reader.background",
  "reader.text",
  "reader.muted",
  "reader.heading",
  "reader.link",
  "reader.border",
  "reader.soft",
  "reader.codeBackground",
  "reader.selection",
  "reader.blockquote",
  "syntax.comment",
  "syntax.keyword",
  "syntax.string",
  "syntax.number",
  "syntax.function",
  "syntax.type",
  "syntax.variable",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;

export type ThemeContributionManifest = {
  id: string;
  family: string;
  label: string;
  variant: ThemeVariant;
  scope: ThemeScope[];
  path: string;
};

export type ThemeDefinitionFile = {
  schemaVersion: 1;
  id: string;
  family: string;
  variant: ThemeVariant;
  scope: ThemeScope[];
  tokens: Partial<ThemeTokens>;
};

export type RegisteredTheme = ThemeDefinitionFile & {
  label: string;
  pluginId: string;
  pluginName: string;
  builtin: boolean;
};

export type ThemeFamily = {
  id: string;
  label: string;
  pluginId: string;
  pluginName: string;
  builtin: boolean;
  variants: Partial<Record<ThemeVariant, RegisteredTheme>>;
};

export type ThemeRegistrySnapshot = {
  families: ThemeFamily[];
  selectedFamily: string;
  activeThemeId: string | null;
};

export const THEME_SCOPE_VALUES: readonly ThemeScope[] = ["app", "reader", "syntax"] as const;

export function normalizeThemeScope(scope: readonly ThemeScope[]): ThemeScope[] {
  return [...new Set(scope)].sort() as ThemeScope[];
}

export function isThemeTokenKey(value: string): value is ThemeTokenKey {
  return (THEME_TOKEN_KEYS as readonly string[]).includes(value);
}


export function isSafeThemeColor(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 160 || /[\u0000-\u001f\u007f;{}@]/.test(value)) return false;
  if (/^(transparent|currentcolor)$/i.test(value)) return true;
  if (/^#[0-9a-f]{3,4}([0-9a-f]{3,4})?$/i.test(value)) return true;
  if (/^[a-z-]+$/i.test(value)) return true;
  const match = value.match(/^(rgb|rgba|hsl|hsla|oklab|oklch|lab|lch|color)\(([^()]*)\)$/i);
  return !!match && /^[a-z0-9.,%+\-\/\s]+$/i.test(match[2]);
}

export function tokenToCssVariable(token: ThemeTokenKey): string {
  return `--theme-${token.replace(".", "-").replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}

export function validateThemeDefinition(value: unknown, manifest: ThemeContributionManifest): ThemeDefinitionFile {
  if (!value || typeof value !== "object") throw new Error(`主题 ${manifest.id} 不是有效 JSON 对象`);
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1) throw new Error(`主题 ${manifest.id} 的 schemaVersion 必须为 1`);
  if (input.id !== manifest.id || input.family !== manifest.family || input.variant !== manifest.variant) {
    throw new Error(`主题 ${manifest.id} 的 id/family/variant 与 manifest 不一致`);
  }
  if (!Array.isArray(input.scope)) throw new Error(`主题 ${manifest.id} 缺少 scope`);
  const scope = input.scope.filter((item): item is ThemeScope => typeof item === "string" && (THEME_SCOPE_VALUES as readonly string[]).includes(item));
  if (scope.length !== input.scope.length || normalizeThemeScope(scope).join("|") !== normalizeThemeScope(manifest.scope).join("|")) {
    throw new Error(`主题 ${manifest.id} 的 scope 与 manifest 不一致`);
  }
  if (!input.tokens || typeof input.tokens !== "object" || Array.isArray(input.tokens)) throw new Error(`主题 ${manifest.id} 缺少 tokens`);
  const tokens: Partial<ThemeTokens> = {};
  for (const [key, raw] of Object.entries(input.tokens as Record<string, unknown>)) {
    if (!isThemeTokenKey(key)) throw new Error(`主题 ${manifest.id} 包含未知 token：${key}`);
    const tokenScope = key.split(".")[0] as ThemeScope;
    if (!manifest.scope.includes(tokenScope)) throw new Error(`主题 ${manifest.id} 的 token ${key} 超出声明 scope`);
    if (typeof raw !== "string" || !isSafeThemeColor(raw)) throw new Error(`主题 ${manifest.id} 的 token ${key} 值无效`);
    tokens[key] = raw.trim();
  }
  const required = THEME_TOKEN_KEYS.filter((key) => manifest.scope.includes(key.split(".")[0] as ThemeScope));
  for (const key of required) if (!tokens[key]) throw new Error(`主题 ${manifest.id} 缺少 token：${key}`);
  return { schemaVersion: 1, id: manifest.id, family: manifest.family, variant: manifest.variant, scope: normalizeThemeScope(scope), tokens };
}

export function createThemeRegistryStore(initial: ThemeRegistrySnapshot): { readable: Readable<ThemeRegistrySnapshot>; set(value: ThemeRegistrySnapshot): void } {
  const store = writable(initial);
  return { readable: { subscribe: store.subscribe }, set: store.set };
}

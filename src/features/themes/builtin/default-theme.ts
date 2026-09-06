import type { RegisteredTheme, ThemeTokens } from "../domain/theme";

const light: ThemeTokens = {
  "app.background": "#ffffff", "app.surface": "#ffffff", "app.surfaceMuted": "#fafafa", "app.border": "#e4e4e7", "app.text": "#18181b", "app.textMuted": "#71717a", "app.accent": "#18181b", "app.accentText": "#ffffff", "app.hover": "#f4f4f5", "app.shadow": "rgba(24,24,27,.12)",
  "reader.background": "#ffffff", "reader.text": "#27272a", "reader.muted": "#71717a", "reader.heading": "#18181b", "reader.link": "#2563eb", "reader.border": "#e4e4e7", "reader.soft": "#f4f4f5", "reader.codeBackground": "#f4f4f5", "reader.selection": "rgba(37,99,235,.16)", "reader.blockquote": "#71717a",
  "syntax.comment": "#6e7781", "syntax.keyword": "#cf222e", "syntax.string": "#0a3069", "syntax.number": "#0550ae", "syntax.function": "#8250df", "syntax.type": "#953800", "syntax.variable": "#24292f",
};
const dark: ThemeTokens = {
  "app.background": "#09090b", "app.surface": "#18181b", "app.surfaceMuted": "#101012", "app.border": "#27272a", "app.text": "#f4f4f5", "app.textMuted": "#a1a1aa", "app.accent": "#f4f4f5", "app.accentText": "#18181b", "app.hover": "#27272a", "app.shadow": "rgba(0,0,0,.34)",
  "reader.background": "#09090b", "reader.text": "#e4e4e7", "reader.muted": "#a1a1aa", "reader.heading": "#f4f4f5", "reader.link": "#60a5fa", "reader.border": "#27272a", "reader.soft": "#18181b", "reader.codeBackground": "#18181b", "reader.selection": "rgba(96,165,250,.22)", "reader.blockquote": "#a1a1aa",
  "syntax.comment": "#8b949e", "syntax.keyword": "#ff7b72", "syntax.string": "#a5d6ff", "syntax.number": "#79c0ff", "syntax.function": "#d2a8ff", "syntax.type": "#ffa657", "syntax.variable": "#c9d1d9",
};

function build(variant: "light" | "dark", tokens: ThemeTokens): RegisteredTheme {
  return { schemaVersion: 1, id: `builtin.default.${variant}`, family: "default", label: "Default", variant, scope: ["app", "reader", "syntax"], tokens, pluginId: "core", pluginName: "oneView", builtin: true };
}

export const DEFAULT_THEMES: RegisteredTheme[] = [build("light", light), build("dark", dark)];

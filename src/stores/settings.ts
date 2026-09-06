import { writable } from "svelte/store";
import type { ReaderFont, UserSettings } from "../lib/contracts";

export const defaultSettings: UserSettings = {
  version: 5,
  appTheme: "system",
  fontFamily: "system",
  fontSize: 15,
  lineHeight: 1.75,
  contentWidth: 860,
  codeFontSize: 13,
  autoCheckUpdates: true,
  autoSave: true,
  defaultAppPromptDismissedUntilMs: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function normalizeSettings(value: Partial<UserSettings> | null | undefined): UserSettings {
  const fonts: ReaderFont[] = ["system", "serif", "mono"];
  const appTheme = value?.appTheme;
  return {
    version: 5,
    appTheme: appTheme === "light" || appTheme === "dark" || appTheme === "system" ? appTheme : "system",
    fontFamily: fonts.includes(value?.fontFamily as ReaderFont) ? (value?.fontFamily as ReaderFont) : "system",
    fontSize: clamp(Number(value?.fontSize ?? 15), 12, 24),
    lineHeight: clamp(Number(value?.lineHeight ?? 1.75), 1.35, 2.2),
    contentWidth: Math.round(clamp(Number(value?.contentWidth ?? 860), 560, 1240)),
    codeFontSize: clamp(Number(value?.codeFontSize ?? 13), 11, 18),
    autoCheckUpdates: value?.autoCheckUpdates !== false,
    autoSave: value?.autoSave !== false,
    defaultAppPromptDismissedUntilMs: Math.max(0, Number(value?.defaultAppPromptDismissedUntilMs ?? 0) || 0),
  };
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<UserSettings>(defaultSettings);
  return {
    subscribe,
    set: (value: UserSettings) => set(normalizeSettings(value)),
    reset: () => set(defaultSettings),
    setAppTheme: (appTheme: UserSettings["appTheme"]) => update((state) => normalizeSettings({ ...state, appTheme })),
    setFontFamily: (fontFamily: ReaderFont) => update((state) => normalizeSettings({ ...state, fontFamily })),
    setFontSize: (fontSize: number) => update((state) => normalizeSettings({ ...state, fontSize })),
    setLineHeight: (lineHeight: number) => update((state) => normalizeSettings({ ...state, lineHeight })),
    setContentWidth: (contentWidth: number) => update((state) => normalizeSettings({ ...state, contentWidth })),
    setCodeFontSize: (codeFontSize: number) => update((state) => normalizeSettings({ ...state, codeFontSize })),
    setAutoCheckUpdates: (autoCheckUpdates: boolean) => update((state) => normalizeSettings({ ...state, autoCheckUpdates })),
    setAutoSave: (autoSave: boolean) => update((state) => normalizeSettings({ ...state, autoSave })),
    setDefaultAppPromptDismissedUntilMs: (defaultAppPromptDismissedUntilMs: number) => update((state) => normalizeSettings({ ...state, defaultAppPromptDismissedUntilMs })),
  };
}

export const settings = createSettingsStore();

export function readerStyle(value: UserSettings): string {
  const font = value.fontFamily === "serif"
    ? 'ui-serif, Georgia, "Times New Roman", "Songti SC", "SimSun", serif'
    : value.fontFamily === "mono"
      ? '"SFMono-Regular", Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace'
      : 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  return [
    `--reader-font:${font}`,
    `--reader-font-size:${value.fontSize}px`,
    `--reader-line-height:${value.lineHeight}`,
    `--reader-width:${value.contentWidth}px`,
    `--reader-code-size:${value.codeFontSize}px`,
  ].join(";");
}

import type { ThemeContributionManifest } from "../../themes/domain/theme";

export type PluginRuntimeKind = "document" | "extension";

export type PluginWorkerRuntimeDescriptor = {
  kind: "worker";
  role: PluginRuntimeKind;
  main: string;
};

export type PluginRuntimeDescriptor = PluginWorkerRuntimeDescriptor;

export type PluginPermission =
  | "commands"
  | "workspace.read"
  | "editor.read"
  | "editor.write"
  | "events"
  | "clipboard.write"
  | "storage"
  | "ui.notice"
  | "ui.contribute"
  | "ui.panel"
  | "settings";

export type PluginEventName =
  | "workspace.fileOpened"
  | "workspace.fileClosed"
  | "workspace.activeFileChanged"
  | "editor.changed"
  | "editor.selectionChanged";

export type PluginDocumentFormatManifest = {
  id: string;
  label: string;
  extensions: string[];
};

export type PluginContributes = {
  documentFormats: PluginDocumentFormatManifest[];
  themes: ThemeContributionManifest[];
};

export type PluginDocumentRenderInput = {
  id: string;
  path: string;
  fileName: string;
  source: string;
  encoding: string;
  lineEnding: string;
  modifiedAtMs: number;
  sizeBytes: number;
};

export type PluginDocumentOutlineItem = {
  id: string;
  level: number;
  title: string;
};

export type PluginDocumentRenderResult = {
  html: string;
  outline?: PluginDocumentOutlineItem[];
  lineCount?: number;
  wordCount?: number;
  characterCount?: number;
  estimatedReadMinutes?: number;
};

export type ActivePluginDocumentFormat = PluginDocumentFormatManifest & {
  pluginId: string;
  pluginName: string;
};

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string | null;
  apiVersion: number;
  minAppVersion?: string | null;
  /** Legacy v0.20 entry. New v0.21 manifests place main inside runtime.worker descriptor. */
  main?: string | null;
  style?: string | null;
  icon?: string | null;
  permissions: PluginPermission[];
  /** v0.21 contribution-first runtime descriptor; legacy string runtimes remain readable. */
  runtime?: PluginRuntimeDescriptor | PluginRuntimeKind | null;
  contributes: PluginContributes;
};

export function effectivePluginWorkerDescriptor(manifest: PluginManifest): PluginWorkerRuntimeDescriptor | null {
  if (manifest.runtime && typeof manifest.runtime === "object" && manifest.runtime.kind === "worker") return manifest.runtime;
  if (manifest.runtime === "document" || manifest.runtime === "extension") {
    return manifest.main ? { kind: "worker", role: manifest.runtime, main: manifest.main } : null;
  }
  if (manifest.main) {
    const role: PluginRuntimeKind = manifest.permissions.length === 0 && (manifest.contributes?.documentFormats?.length ?? 0) > 0 ? "document" : "extension";
    return { kind: "worker", role, main: manifest.main };
  }
  return null;
}

export function effectivePluginRuntimeKind(manifest: PluginManifest): PluginRuntimeKind | null {
  return effectivePluginWorkerDescriptor(manifest)?.role ?? null;
}

export function pluginHasWorkerRuntime(manifest: PluginManifest): boolean {
  return effectivePluginWorkerDescriptor(manifest) !== null;
}

export type PluginSource =
  | { kind: "installed" }
  | { kind: "development"; path: string };

export type InstalledPlugin = {
  manifest: PluginManifest;
  enabled: boolean;
  compatible: boolean;
  compatibilityIssue?: string | null;
  permissionReviewRequired: boolean;
  source: PluginSource;
};

export type PluginShortcutOverrides = Record<string, string | null>;

export type PluginInventory = {
  plugins: InstalledPlugin[];
  warnings: string[];
  shortcutOverrides: PluginShortcutOverrides;
};

export type PluginBundle = {
  manifest: PluginManifest;
  mainJs?: string | null;
  styleCss?: string | null;
  themeFiles: Record<string, string>;
};

export type PluginRuntimeStatus = "disabled" | "loading" | "active" | "error";

export type PluginRuntimeState = {
  status: PluginRuntimeStatus;
  error?: string | null;
};

export type PluginDiagnosticLevel = "info" | "warning" | "error";
export type PluginDiagnosticKind = "lifecycle" | "runtime" | "command" | "event" | "panel" | "settings";
export type PluginRuntimeFaultReason = "runtime" | "circuit-breaker";

/** Structured runtime diagnostic. Plugins never write these directly; the host owns the log. */
export type PluginDiagnosticReport = {
  level: PluginDiagnosticLevel;
  kind: PluginDiagnosticKind;
  message: string;
};

export type PluginDiagnosticEntry = PluginDiagnosticReport & {
  id: string;
  pluginId: string;
  at: number;
};

export type PluginHealthStatus = "disabled" | "healthy" | "degraded" | "faulted";

export type PluginHealthSnapshot = {
  status: PluginHealthStatus;
  recentErrorCount: number;
  totalErrorCount: number;
  circuitBreakerTrips: number;
  lastError?: string | null;
  lastErrorAt?: number | null;
  lastStartedAt?: number | null;
  lastStoppedAt?: number | null;
};

export type PluginCommandContribution = {
  id: string;
  pluginId: string;
  pluginName: string;
  localId: string;
  title: string;
  description?: string;
  keywords: string[];
  /** Current effective shortcut after host-level user overrides are applied. */
  shortcut?: string;
  /** Shortcut declared by the plugin. Never mutated by the user shortcut layer. */
  defaultShortcut?: string;
};

export type PluginShortcutBinding = {
  commandId: string;
  pluginId: string;
  pluginName: string;
  commandTitle: string;
  defaultShortcut?: string;
  effectiveShortcut?: string;
  /** true means the user explicitly customized or disabled this command shortcut. */
  overridden: boolean;
  /** null means explicitly disabled; undefined means no override. */
  overrideShortcut?: string | null;
};

export type PluginShortcutConflict = {
  commandId: string;
  pluginId: string;
  pluginName: string;
  commandTitle: string;
  shortcut: string;
  normalizedShortcut: string;
  kind: "builtin" | "plugin";
  conflictsWith: string[];
};

export type PluginStartupRecoveryState = {
  safeMode: boolean;
  previousStartupIncomplete: boolean;
  interruptedPluginId?: string | null;
  recoveryCount: number;
};


export type PluginUiContributionPlacement = "statusbar" | "context-menu" | "toolbar";
export type PluginUiContributionWhen = "always" | "document" | "editable" | "selection" | "link";
export type PluginUiContributionSide = "left" | "right";
export type PluginUiIcon = "code" | "document" | "search" | "refresh" | "plus" | "more";

export type PluginUiContribution = {
  id: string;
  pluginId: string;
  pluginName: string;
  localId: string;
  placement: PluginUiContributionPlacement;
  label: string;
  commandId: string;
  tooltip?: string;
  icon?: PluginUiIcon;
  order: number;
  when: PluginUiContributionWhen;
  side: PluginUiContributionSide;
};

export type PluginPanelContribution = {
  id: string;
  pluginId: string;
  pluginName: string;
  localId: string;
  title: string;
  html: string;
  css?: string;
  icon?: PluginUiIcon;
  order: number;
  when: PluginUiContributionWhen;
};


export type PluginSettingValue = string | number | boolean;

export type PluginSettingOption = {
  label: string;
  value: string;
};

export type PluginSettingField =
  | {
      key: string;
      type: "boolean";
      label: string;
      description?: string;
      defaultValue: boolean;
    }
  | {
      key: string;
      type: "text";
      label: string;
      description?: string;
      defaultValue: string;
      placeholder?: string;
      multiline?: boolean;
    }
  | {
      key: string;
      type: "number";
      label: string;
      description?: string;
      defaultValue: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      key: string;
      type: "select";
      label: string;
      description?: string;
      defaultValue: string;
      options: PluginSettingOption[];
    };

export type PluginSettingsContribution = {
  pluginId: string;
  pluginName: string;
  title: string;
  fields: PluginSettingField[];
};

export type PluginManagerState = {
  plugins: InstalledPlugin[];
  warnings: string[];
  runtimeById: Record<string, PluginRuntimeState>;
  themeFamilies: import("../../themes/domain/theme").ThemeFamily[];
  selectedThemeFamily: string;
  commands: PluginCommandContribution[];
  contributions: PluginUiContribution[];
  panels: PluginPanelContribution[];
  settingsSchemas: PluginSettingsContribution[];
  healthById: Record<string, PluginHealthSnapshot>;
  diagnosticsById: Record<string, PluginDiagnosticEntry[]>;
  shortcutBindings: PluginShortcutBinding[];
  shortcutConflicts: PluginShortcutConflict[];
  safeMode: boolean;
  startupRecovery: PluginStartupRecoveryState | null;
  activePanelId: string | null;
  loading: boolean;
  error: string | null;
};

export type PluginActiveFile = {
  id: string;
  path: string;
  fileName: string;
  format: string;
  editable: boolean;
  dirty: boolean;
};

/** Stable selection DTO. It intentionally does not expose ProseMirror positions. */
export type PluginEditorSelection = {
  text: string;
  empty: boolean;
};

/** Stable editor DTO. Source is Markdown text, not an EditorView/DOM snapshot. */
export type PluginEditorDocument = {
  documentId: string;
  source: string;
  selection: PluginEditorSelection;
};

export type PluginEvent =
  | {
      name: "workspace.fileOpened";
      payload: { file: PluginActiveFile };
    }
  | {
      name: "workspace.fileClosed";
      payload: { id: string; path: string; fileName: string; format: string };
    }
  | {
      name: "workspace.activeFileChanged";
      payload: { file: PluginActiveFile | null };
    }
  | {
      name: "editor.changed";
      payload: {
        documentId: string;
        dirty: boolean;
        wordCount: number;
        characterCount: number;
        lineCount: number;
        sizeBytes: number;
      };
    }
  | {
      name: "editor.selectionChanged";
      payload: {
        documentId: string;
        empty: boolean;
        textLength: number;
      };
    };

export const PLUGIN_EVENT_NAMES: readonly PluginEventName[] = [
  "workspace.fileOpened",
  "workspace.fileClosed",
  "workspace.activeFileChanged",
  "editor.changed",
  "editor.selectionChanged",
] as const;

export function isPluginEventName(value: string): value is PluginEventName {
  return (PLUGIN_EVENT_NAMES as readonly string[]).includes(value);
}

export const permissionLabels: Record<PluginPermission, string> = {
  commands: "注册命令",
  "workspace.read": "读取当前文档信息",
  "editor.read": "读取编辑器内容与选区",
  "editor.write": "修改当前编辑器内容",
  events: "监听文档与编辑器事件",
  "clipboard.write": "写入剪贴板",
  storage: "保存插件设置与数据",
  "ui.notice": "显示应用通知",
  "ui.contribute": "向受控工具栏、右键菜单和状态栏添加入口",
  "ui.panel": "注册隔离的插件侧边面板",
  settings: "注册并保存插件设置",
};

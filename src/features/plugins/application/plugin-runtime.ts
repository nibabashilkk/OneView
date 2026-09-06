import type {
  PluginBundle,
  PluginCommandContribution,
  PluginDiagnosticReport,
  PluginDocumentRenderInput,
  PluginDocumentRenderResult,
  PluginEvent,
  PluginPanelContribution,
  PluginRuntimeFaultReason,
  PluginSettingValue,
  PluginSettingsContribution,
  PluginUiContribution,
} from "../domain/plugin";

export interface BasePluginRuntime {
  readonly pluginId: string;
  readonly kind: "document" | "extension";
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** Minimal runtime surface for format viewers. No commands, editor, events, settings or panels. */
export interface DocumentPluginRuntime extends BasePluginRuntime {
  readonly kind: "document";
  renderDocument(formatId: string, document: PluginDocumentRenderInput): Promise<PluginDocumentRenderResult>;
}

/** Full extension runtime. It intentionally cannot render document formats. */
export interface ExtensionPluginRuntime extends BasePluginRuntime {
  readonly kind: "extension";
  invokeCommand(localId: string): void;
  emitEvent(event: PluginEvent): void;
  emitPanelMessage(localId: string, payload: unknown): void;
  emitSettingChanged(key: string, value: PluginSettingValue): void;
}

export type PluginRuntime = DocumentPluginRuntime | ExtensionPluginRuntime;

export interface PluginRuntimeCallbacks {
  onCommand(command: PluginCommandContribution): void;
  onCommandRemoved(commandId: string): void;
  onContribution(contribution: PluginUiContribution): void;
  onContributionRemoved(contributionId: string): void;
  onPanel(panel: PluginPanelContribution): void;
  onPanelRemoved(panelId: string): void;
  onPanelPostMessage(panelId: string, payload: unknown): void;
  onPanelOpenRequested(panelId: string): void;
  onPanelCloseRequested(panelId: string): void;
  onSettings(settings: PluginSettingsContribution): void;
  onSettingsRemoved(pluginId: string): void;
  onDiagnostic(report: PluginDiagnosticReport): void;
  onFatal(message: string, reason: PluginRuntimeFaultReason): void;
}

/** Factory port keeps PluginManager independent from Worker/iframe/process implementations. */
export interface PluginRuntimeFactory {
  create(bundle: PluginBundle, callbacks: PluginRuntimeCallbacks): PluginRuntime;
}

export function isDocumentPluginRuntime(runtime: PluginRuntime): runtime is DocumentPluginRuntime {
  return runtime.kind === "document";
}

export function isExtensionPluginRuntime(runtime: PluginRuntime): runtime is ExtensionPluginRuntime {
  return runtime.kind === "extension";
}

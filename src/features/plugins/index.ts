import { PluginManager } from "./application/plugin-manager";
import type { PluginHostServices } from "./application/plugin-host-services";
import { TauriPluginRepository } from "./infrastructure/tauri-plugin-repository";
import { WorkerPluginRuntimeFactory } from "./runtime/worker-plugin-runtime";

export function createPluginManager(services: PluginHostServices) {
  const repository = new TauriPluginRepository();
  const runtimeFactory = new WorkerPluginRuntimeFactory(repository, services);
  return new PluginManager(repository, runtimeFactory, services);
}

export type { PluginManager } from "./application/plugin-manager";
export type { PluginHostServices } from "./application/plugin-host-services";
export type { DocumentPluginRuntime, ExtensionPluginRuntime, PluginRuntime, PluginRuntimeFactory } from "./application/plugin-runtime";
export type {
  PluginManagerState,
  ActivePluginDocumentFormat,
  PluginDocumentFormatManifest,
  PluginDocumentRenderInput,
  PluginDocumentRenderResult,
  PluginCommandContribution,
  PluginShortcutConflict,
  PluginStartupRecoveryState,
  PluginDiagnosticEntry,
  PluginDiagnosticKind,
  PluginDiagnosticLevel,
  PluginHealthSnapshot,
  PluginHealthStatus,
  PluginActiveFile,
  PluginEditorDocument,
  PluginEditorSelection,
  PluginEvent,
  PluginEventName,
  PluginSource,
  PluginPanelContribution,
  PluginSettingField,
  PluginSettingValue,
  PluginSettingsContribution,
  PluginUiContribution,
  PluginUiContributionPlacement,
  PluginUiContributionWhen,
} from "./domain/plugin";

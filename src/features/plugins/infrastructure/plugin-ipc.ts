import { invoke } from "@tauri-apps/api/core";
import type { InstalledPlugin, PluginBundle, PluginStartupRecoveryState } from "../domain/plugin";

type PluginCommandRequestMap = {
  install_plugin: { path: string };
  link_development_plugin: { path: string };
  uninstall_plugin: { id: string; removeData: boolean };
  set_plugin_enabled: { id: string; enabled: boolean };
  mark_plugin_startup_plugin: { id: string | null };
  set_plugin_safe_mode: { enabled: boolean };
  set_plugin_shortcut_override: { commandId: string; shortcut: string | null };
  clear_plugin_shortcut_override: { commandId: string };
  read_plugin_bundle: { id: string };
  plugin_storage_get: { id: string; key: string };
  plugin_storage_set: { id: string; key: string; value: unknown };
  plugin_storage_delete: { id: string; key: string };
};

type PluginCommandResponseMap = {
  install_plugin: InstalledPlugin;
  link_development_plugin: InstalledPlugin;
  uninstall_plugin: void;
  set_plugin_enabled: InstalledPlugin;
  mark_plugin_startup_plugin: void;
  set_plugin_safe_mode: PluginStartupRecoveryState;
  set_plugin_shortcut_override: void;
  clear_plugin_shortcut_override: void;
  read_plugin_bundle: PluginBundle;
  plugin_storage_get: unknown | null;
  plugin_storage_set: void;
  plugin_storage_delete: void;
};

export function invokePluginRequest<K extends keyof PluginCommandRequestMap>(
  command: K,
  request: PluginCommandRequestMap[K],
): Promise<PluginCommandResponseMap[K]> {
  return invoke<PluginCommandResponseMap[K]>(command, { request });
}

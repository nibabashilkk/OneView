import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "../../../lib/runtime";
import type { InstalledPlugin, PluginBundle, PluginInventory, PluginStartupRecoveryState } from "../domain/plugin";
import type { PluginRepository } from "../application/plugin-repository";
import { invokePluginRequest } from "./plugin-ipc";

const EMPTY_INVENTORY: PluginInventory = { plugins: [], warnings: [], shortcutOverrides: {} };


export class TauriPluginRepository implements PluginRepository {
  async choosePackage(): Promise<string | null> {
    if (!isTauri()) return null;
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "oneView Plugin", extensions: ["mdvplugin"] }],
    });
    return typeof selected === "string" ? selected : null;
  }


  async chooseDevelopmentDirectory(): Promise<string | null> {
    if (!isTauri()) return null;
    const selected = await open({
      multiple: false,
      directory: true,
    });
    return typeof selected === "string" ? selected : null;
  }

  async list(): Promise<PluginInventory> {
    if (!isTauri()) return EMPTY_INVENTORY;
    return invoke<PluginInventory>("list_plugins");
  }

  async install(path: string): Promise<InstalledPlugin> {
    return invokePluginRequest("install_plugin", { path });
  }


  async linkDevelopment(path: string): Promise<InstalledPlugin> {
    return invokePluginRequest("link_development_plugin", { path });
  }

  async uninstall(id: string, removeData: boolean): Promise<void> {
    await invokePluginRequest("uninstall_plugin", { id, removeData });
  }

  async setEnabled(id: string, enabled: boolean): Promise<InstalledPlugin> {
    return invokePluginRequest("set_plugin_enabled", { id, enabled });
  }

  async beginStartupSession(): Promise<PluginStartupRecoveryState> {
    if (!isTauri()) return { safeMode: false, previousStartupIncomplete: false, interruptedPluginId: null, recoveryCount: 0 };
    return invoke<PluginStartupRecoveryState>("begin_plugin_startup_session");
  }

  async markStartupPlugin(id: string | null): Promise<void> {
    if (!isTauri()) return;
    await invokePluginRequest("mark_plugin_startup_plugin", { id });
  }

  async completeStartupSession(): Promise<void> {
    if (!isTauri()) return;
    await invoke("complete_plugin_startup_session");
  }

  async setSafeMode(enabled: boolean): Promise<PluginStartupRecoveryState> {
    if (!isTauri()) return { safeMode: enabled, previousStartupIncomplete: false, interruptedPluginId: null, recoveryCount: 0 };
    return invokePluginRequest("set_plugin_safe_mode", { enabled });
  }

  async setShortcutOverride(commandId: string, shortcut: string | null): Promise<void> {
    if (!isTauri()) return;
    await invokePluginRequest("set_plugin_shortcut_override", { commandId, shortcut });
  }

  async clearShortcutOverride(commandId: string): Promise<void> {
    if (!isTauri()) return;
    await invokePluginRequest("clear_plugin_shortcut_override", { commandId });
  }

  async readBundle(id: string): Promise<PluginBundle> {
    return invokePluginRequest("read_plugin_bundle", { id });
  }

  async storageGet<T = unknown>(id: string, key: string): Promise<T | null> {
    return invokePluginRequest("plugin_storage_get", { id, key }) as Promise<T | null>;
  }

  async storageSet(id: string, key: string, value: unknown): Promise<void> {
    await invokePluginRequest("plugin_storage_set", { id, key, value });
  }

  async storageDelete(id: string, key: string): Promise<void> {
    await invokePluginRequest("plugin_storage_delete", { id, key });
  }
}

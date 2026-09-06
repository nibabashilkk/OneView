import type { InstalledPlugin, PluginBundle, PluginInventory, PluginStartupRecoveryState } from "../domain/plugin";

export interface PluginRepository {
  choosePackage(): Promise<string | null>;
  chooseDevelopmentDirectory(): Promise<string | null>;
  list(): Promise<PluginInventory>;
  install(path: string): Promise<InstalledPlugin>;
  linkDevelopment(path: string): Promise<InstalledPlugin>;
  uninstall(id: string, removeData: boolean): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<InstalledPlugin>;
  beginStartupSession(): Promise<PluginStartupRecoveryState>;
  markStartupPlugin(id: string | null): Promise<void>;
  completeStartupSession(): Promise<void>;
  setSafeMode(enabled: boolean): Promise<PluginStartupRecoveryState>;
  setShortcutOverride(commandId: string, shortcut: string | null): Promise<void>;
  clearShortcutOverride(commandId: string): Promise<void>;
  readBundle(id: string): Promise<PluginBundle>;
  storageGet<T = unknown>(id: string, key: string): Promise<T | null>;
  storageSet(id: string, key: string, value: unknown): Promise<void>;
  storageDelete(id: string, key: string): Promise<void>;
}

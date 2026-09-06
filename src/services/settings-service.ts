import { invoke } from "@tauri-apps/api/core";
import type { UserSettings } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

export async function loadSettings(): Promise<UserSettings | null> {
  if (!isTauri()) return null;
  return invoke<UserSettings>("load_settings");
}

export async function saveSettings(settings: UserSettings): Promise<UserSettings> {
  if (!isTauri()) return settings;
  return invoke<UserSettings>("save_settings", { settings });
}

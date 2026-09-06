import { invoke } from "@tauri-apps/api/core";
import type { DefaultAppActionResult, DefaultAppGroupKey, DefaultAppStatus } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

const browserStatus: DefaultAppStatus = {
  platform: "browser",
  canSetDirectly: false,
  canOpenSystemSettings: false,
  appInstalled: false,
  associations: [],
};

export async function getDefaultAppStatus(): Promise<DefaultAppStatus> {
  if (!isTauri()) return browserStatus;
  return invoke<DefaultAppStatus>("get_default_app_status");
}

export async function requestDefaultApp(group: DefaultAppGroupKey): Promise<DefaultAppActionResult> {
  if (!isTauri()) throw new Error("默认应用设置仅在桌面版可用");
  return invoke<DefaultAppActionResult>("request_default_app", { group });
}

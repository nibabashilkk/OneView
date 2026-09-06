import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { BuildInfo } from "../lib/contracts";

const MENU_COMMAND_EVENT = "app://command";
const APP_EXIT_REQUESTED_EVENT = "app://exit-requested";

export function getBuildInfo(): Promise<BuildInfo> {
  return invoke<BuildInfo>("get_build_info");
}

export function setMainWindowTitle(title: string): Promise<void> {
  return invoke("set_main_window_title", { title });
}

export function listenForNativeCommands(handler: (commandId: string) => void): Promise<UnlistenFn> {
  return listen<string>(MENU_COMMAND_EVENT, (event) => handler(event.payload));
}

export function loadCrashLog(): Promise<string | null> {
  return invoke<string | null>("load_crash_log");
}

export function clearCrashLog(): Promise<void> {
  return invoke("clear_crash_log");
}

export function listenForApplicationExitRequested(handler: () => void): Promise<UnlistenFn> {
  return listen(APP_EXIT_REQUESTED_EVENT, () => handler());
}

export function setApplicationExitGuardReady(ready: boolean): Promise<void> {
  return invoke("set_exit_guard_ready", { ready });
}

export function requestApplicationExit(): Promise<void> {
  return invoke("request_app_exit");
}

export function confirmApplicationExit(): Promise<void> {
  return invoke("confirm_app_exit");
}

export function cancelApplicationExit(): Promise<void> {
  return invoke("cancel_app_exit");
}

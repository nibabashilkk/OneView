import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceSnapshot } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  if (!isTauri()) {
    return { version: 2, openTabs: [], activePath: null, sidebarOpen: true, recentFiles: [], projectRoot: null, recentProjects: [] };
  }
  return invoke<WorkspaceSnapshot>("load_workspace");
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  if (!isTauri()) return;
  await invoke("save_workspace", { snapshot });
}

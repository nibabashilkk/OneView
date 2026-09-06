import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { WorkspaceProject, WorkspaceSearchResponse } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

export async function chooseWorkspaceDirectory(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}

export type WorkspaceFormatSpec = { id: string; extensions: string[] };

export function openWorkspaceProject(path: string, forceRefresh = false, formats: WorkspaceFormatSpec[] = []): Promise<WorkspaceProject> {
  return invoke<WorkspaceProject>("open_workspace", { path, forceRefresh, formats });
}

export function searchWorkspaceProject(path: string, query: string, limit = 200, formats: WorkspaceFormatSpec[] = []): Promise<WorkspaceSearchResponse> {
  return invoke<WorkspaceSearchResponse>("search_workspace", { path, query, limit, formats });
}

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { ResourceRequest, ResourceResolution } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

export async function resolveDocumentResources(
  documentPath: string,
  resources: ResourceRequest[],
): Promise<ResourceResolution[]> {
  if (!isTauri() || resources.length === 0) return [];
  return invoke<ResourceResolution[]>("resolve_document_resources", {
    documentPath,
    resources,
  });
}

export function localAssetUrl(path: string): string {
  return convertFileSrc(path);
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await openUrl(url);
}

export function isExternalUrl(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  );
}

export async function revealLocalPath(path: string): Promise<void> {
  if (!isTauri()) return;
  await revealItemInDir(path);
}

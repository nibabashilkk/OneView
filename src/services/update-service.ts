import { Channel, invoke } from "@tauri-apps/api/core";
import type { UpdateDownloadEvent, UpdateMetadata } from "../lib/contracts";

export function checkForUpdate(): Promise<UpdateMetadata | null> {
  return invoke<UpdateMetadata | null>("check_for_update");
}

export async function installUpdate(onEvent: (event: UpdateDownloadEvent) => void): Promise<void> {
  const channel = new Channel<UpdateDownloadEvent>();
  channel.onmessage = onEvent;
  await invoke("install_update", { onEvent: channel });
}

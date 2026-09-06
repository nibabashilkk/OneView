import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { CompatibilityReport, DocumentFileEvent, RenderedDocument, StartupSystemAction } from "../lib/contracts";
import { isTauri } from "../lib/runtime";

const DOCUMENT_CHANGED_EVENT = "document://changed";
const OPEN_FILES_EVENT = "app://open-files";
const SYSTEM_ACTIONS_EVENT = "app://system-actions";

export async function chooseDocumentFile(extensions: string[] = ["md", "markdown", "mdown", "mkd", "txt", "text"]): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Documents", extensions: [...new Set(extensions.map((item) => item.replace(/^\./, "").toLowerCase()).filter(Boolean))] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function openDocument(path: string): Promise<RenderedDocument> {
  return invoke<RenderedDocument>("open_document", { path });
}

export async function analyzeMarkdown(content: string): Promise<CompatibilityReport> {
  if (!isTauri()) {
    throw new Error("Rust compatibility engine is only available in the desktop runtime");
  }
  return invoke<CompatibilityReport>("analyze_markdown", { content });
}

export async function saveDocument(path: string, content: string, encoding: string, lineEnding: string): Promise<RenderedDocument> {
  return invoke<RenderedDocument>("save_document", { path, content, encoding, lineEnding });
}

export async function closeDocument(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("close_document", { path });
}

export async function takeStartupFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("take_startup_files");
}

export async function takeStartupActions(): Promise<StartupSystemAction[]> {
  if (!isTauri()) return [];
  return invoke<StartupSystemAction[]>("take_startup_actions");
}

export async function listenForSystemActions(
  callback: (actions: StartupSystemAction[]) => void,
): Promise<UnlistenFn> {
  return listen<StartupSystemAction[]>(SYSTEM_ACTIONS_EVENT, (event) => callback(event.payload));
}

export async function listenForOpenFiles(
  callback: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return listen<string[]>(OPEN_FILES_EVENT, (event) => callback(event.payload));
}

export async function listenForDocumentChanges(
  callback: (event: DocumentFileEvent) => void,
): Promise<UnlistenFn> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const unlisten = await listen<DocumentFileEvent>(DOCUMENT_CHANGED_EVENT, (event) => {
    const payload = event.payload;
    const old = timers.get(payload.path);
    if (old) clearTimeout(old);

    // 编辑器常用“写临时文件 + rename”保存，稍等文件系统稳定后再重新读取。
    timers.set(
      payload.path,
      setTimeout(() => {
        timers.delete(payload.path);
        callback(payload);
      }, 140),
    );
  });

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    unlisten();
  };
}

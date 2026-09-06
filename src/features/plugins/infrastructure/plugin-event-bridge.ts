import { get } from "svelte/store";
import { editorSession, type EditorSessionEvent } from "../../editor/editor-session";
import { editor } from "../../../stores/editor";
import { workspace } from "../../../stores/workspace";
import type { PluginManager } from "../application/plugin-manager";
import type { PluginActiveFile, PluginEvent } from "../domain/plugin";

/**
 * Adapter from the app's Svelte/editor observables to the stable plugin event model.
 * The plugin core does not import Svelte stores; this bridge is the only translation layer.
 */
export function startPluginEventBridge(manager: PluginManager): () => void {
  let workspaceReady = false;
  let editorReady = false;
  let previousActiveId: string | null = null;
  let previousDocuments = new Map<string, { path: string; fileName: string; format: string }>();
  let previousDrafts = new Map<string, { source: string; dirty: boolean }>();
  let selectionTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSelection: PluginEvent | null = null;

  const stopWorkspace = workspace.subscribe((state) => {
    const editorState = get(editor);
    const currentFile = (id: string | null): PluginActiveFile | null => {
      if (!id) return null;
      const document = state.documents.find((item) => item.id === id);
      if (!document) return null;
      const draft = editorState.byId[id];
      return {
        id: document.id,
        path: document.path,
        fileName: document.fileName,
        format: document.format,
        editable: document.editable,
        dirty: draft?.dirty ?? false,
      };
    };

    const currentDocuments = new Map(
      state.documents.map((document) => [document.id, {
        path: document.path,
        fileName: document.fileName,
        format: document.format,
      }]),
    );

    if (!workspaceReady) {
      workspaceReady = true;
      previousDocuments = currentDocuments;
      previousActiveId = state.activeId;
      manager.publishEvent({
        name: "workspace.activeFileChanged",
        payload: { file: currentFile(state.activeId) },
      });
      return;
    }

    for (const [id] of currentDocuments) {
      if (previousDocuments.has(id)) continue;
      const file = currentFile(id);
      if (file) manager.publishEvent({ name: "workspace.fileOpened", payload: { file } });
    }

    for (const [id, previous] of previousDocuments) {
      if (currentDocuments.has(id)) continue;
      manager.publishEvent({
        name: "workspace.fileClosed",
        payload: { id, ...previous },
      });
    }

    if (state.activeId !== previousActiveId) {
      manager.publishEvent({
        name: "workspace.activeFileChanged",
        payload: { file: currentFile(state.activeId) },
      });
      previousActiveId = state.activeId;
    }

    previousDocuments = currentDocuments;
  });

  const stopEditor = editor.subscribe((state) => {
    const current = new Map<string, { source: string; dirty: boolean }>();
    for (const [id, draft] of Object.entries(state.byId)) {
      current.set(id, { source: draft.source, dirty: draft.dirty });
      const previous = previousDrafts.get(id);
      if (!editorReady || !previous || previous.source === draft.source) continue;
      manager.publishEvent({
        name: "editor.changed",
        payload: {
          documentId: id,
          dirty: draft.dirty,
          wordCount: draft.wordCount,
          characterCount: draft.characterCount,
          lineCount: draft.lineCount,
          sizeBytes: draft.sizeBytes,
        },
      });
    }
    previousDrafts = current;
    editorReady = true;
  });

  const stopSession = editorSession.subscribe((event) => {
    if (event.type !== "selectionChanged") return;
    queueSelectionEvent(event);
  });

  function queueSelectionEvent(event: Extract<EditorSessionEvent, { type: "selectionChanged" }>) {
    pendingSelection = {
      name: "editor.selectionChanged",
      payload: {
        documentId: event.documentId,
        empty: event.selection.empty,
        textLength: event.selection.text.length,
      },
    };
    if (selectionTimer) return;
    selectionTimer = setTimeout(() => {
      selectionTimer = null;
      const next = pendingSelection;
      pendingSelection = null;
      if (next) manager.publishEvent(next);
    }, 40);
  }


  return () => {
    stopWorkspace();
    stopEditor();
    stopSession();
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = null;
    pendingSelection = null;
  };
}

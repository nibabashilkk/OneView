export type EditorSelectionSnapshot = {
  text: string;
  empty: boolean;
};

export type EditorDocumentSnapshot = {
  documentId: string;
  source: string;
  selection: EditorSelectionSnapshot;
};

export type EditorSessionEvent =
  | { type: "attached"; documentId: string }
  | { type: "detached"; documentId: string }
  | { type: "selectionChanged"; documentId: string; selection: EditorSelectionSnapshot };

export interface EditorSessionController {
  readonly documentId: string;
  getSnapshot(): EditorDocumentSnapshot;
  getSelection(): EditorSelectionSnapshot;
  replaceSelection(text: string): void;
  insertText(text: string): void;
}

/**
 * Host-side editor application service.
 *
 * This is deliberately narrower than ProseMirror's EditorView. Other features may
 * depend on this stable surface without knowing which editor implementation is mounted.
 */
export class EditorSessionRegistry {
  private controller: EditorSessionController | null = null;
  private readonly listeners = new Set<(event: EditorSessionEvent) => void>();

  attach(controller: EditorSessionController): () => void {
    this.controller = controller;
    this.emit({ type: "attached", documentId: controller.documentId });
    return () => {
      if (this.controller !== controller) return;
      this.controller = null;
      this.emit({ type: "detached", documentId: controller.documentId });
    };
  }

  getSnapshot(): EditorDocumentSnapshot | null {
    return this.controller?.getSnapshot() ?? null;
  }

  getSelection(): EditorSelectionSnapshot | null {
    return this.controller?.getSelection() ?? null;
  }

  replaceSelection(text: string): void {
    const controller = this.requireController();
    controller.replaceSelection(text);
  }

  insertText(text: string): void {
    const controller = this.requireController();
    controller.insertText(text);
  }

  notifySelectionChanged(documentId: string): void {
    if (!this.controller || this.controller.documentId !== documentId) return;
    const selection = this.controller.getSelection();
    this.emit({ type: "selectionChanged", documentId, selection });
  }

  subscribe(listener: (event: EditorSessionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private requireController(): EditorSessionController {
    if (!this.controller) {
      throw new Error("当前没有可编辑的所见即所得会话");
    }
    return this.controller;
  }

  private emit(event: EditorSessionEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // Editor interaction must never be interrupted by an observer.
      }
    }
  }
}

export const editorSession = new EditorSessionRegistry();

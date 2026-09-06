/** Type-only SDK for oneView Plugin API v1. v0.21 manifests are Contribution-first; runtime is optional. */
export {};

declare global {
  const markdownViewer: MarkdownViewerPluginHost;

  interface MarkdownViewerPluginHost {
    definePlugin(plugin: MarkdownViewerDocumentPlugin | MarkdownViewerExtensionPlugin): void;
  }

  interface MarkdownViewerDocumentPlugin {
    /** Document Worker only. Manifest permissions must be empty. */
    documentFormats: Record<string, MarkdownViewerDocumentRenderer | { render: MarkdownViewerDocumentRenderer }>;
    onLoad?(ctx: Readonly<Record<never, never>>): void | Promise<void>;
    onUnload?(): void | Promise<void>;
  }

  interface MarkdownViewerExtensionPlugin {
    /** Extension Worker cannot contribute document formats. Theme-only plugins do not execute this API. */
    documentFormats?: never;
    onLoad?(ctx: MarkdownViewerPluginContext): void | Promise<void>;
    onUnload?(): void | Promise<void>;
  }


  interface MarkdownViewerDocumentInput {
    id: string;
    path: string;
    fileName: string;
    source: string;
    encoding: string;
    lineEnding: string;
    modifiedAtMs: number;
    sizeBytes: number;
  }

  interface MarkdownViewerDocumentRenderResult {
    html: string;
    outline?: Array<{ id: string; level: number; title: string }>;
    lineCount?: number;
    wordCount?: number;
    characterCount?: number;
    estimatedReadMinutes?: number;
  }

  type MarkdownViewerDocumentRenderer = (document: MarkdownViewerDocumentInput) =>
    MarkdownViewerDocumentRenderResult | Promise<MarkdownViewerDocumentRenderResult>;

  interface MarkdownViewerPluginContext {
    readonly commands: {
      register(command: MarkdownViewerPluginCommand): () => void;
    };
    readonly ui: {
      notice(message: string): Promise<void>;
      /** Adds an entry into a host-controlled surface; returns a disposer. */
      contribute(contribution: MarkdownViewerUiContribution): () => void;
      /** Registers a sandboxed side panel. Plugin HTML never enters the host DOM. */
      registerPanel(panel: MarkdownViewerPanelDefinition): MarkdownViewerPanelController;
    };
    readonly workspace: {
      getActiveFile(): Promise<MarkdownViewerActiveFile | null>;
    };
    readonly editor: {
      /** Returns Markdown source plus a stable text-only selection DTO. No ProseMirror objects are exposed. */
      getDocument(): Promise<MarkdownViewerEditorDocument | null>;
      getSelection(): Promise<MarkdownViewerEditorSelection | null>;
      /** Replaces the current selection. If the selection is empty, inserts at the caret. */
      replaceSelection(text: string): Promise<void>;
      /** Inserts text at the current selection/caret using the host editor transaction model. */
      insertText(text: string): Promise<void>;
    };
    readonly events: {
      on<K extends MarkdownViewerPluginEventName>(
        eventName: K,
        handler: (payload: MarkdownViewerPluginEventMap[K]) => void | Promise<void>,
      ): () => void;
    };
    readonly clipboard: {
      writeText(text: string): Promise<void>;
    };
    readonly storage: {
      get<T = unknown>(key: string): Promise<T | null>;
      set(key: string, value: unknown): Promise<void>;
      delete(key: string): Promise<void>;
    };
    readonly settings: {
      /** Registers one host-rendered settings schema for this plugin. */
      register(schema: MarkdownViewerPluginSettingsSchema): () => void;
      get<T extends MarkdownViewerSettingValue = MarkdownViewerSettingValue>(key: string): Promise<T>;
      set(key: string, value: MarkdownViewerSettingValue): Promise<MarkdownViewerSettingValue>;
      onChanged(handler: (change: { key: string; value: MarkdownViewerSettingValue }) => void | Promise<void>): () => void;
    };
  }


  type MarkdownViewerSettingValue = string | number | boolean;

  interface MarkdownViewerPluginSettingsSchema {
    title?: string;
    fields: MarkdownViewerPluginSettingField[];
  }

  type MarkdownViewerPluginSettingField =
    | { key: string; type: "boolean"; label: string; description?: string; defaultValue: boolean }
    | { key: string; type: "text"; label: string; description?: string; defaultValue: string; placeholder?: string; multiline?: boolean }
    | { key: string; type: "number"; label: string; description?: string; defaultValue: number; min?: number; max?: number; step?: number }
    | { key: string; type: "select"; label: string; description?: string; defaultValue: string; options: Array<{ label: string; value: string }> };

  interface MarkdownViewerPluginCommand {
    id: string;
    title: string;
    description?: string;
    keywords?: string[];
    /** Recommended default shortcut. The host/user may remap or disable it; core shortcuts always win. */
    shortcut?: string;
    run(): void | Promise<void>;
  }


  type MarkdownViewerUiPlacement = "statusbar" | "context-menu" | "toolbar";
  type MarkdownViewerUiWhen = "always" | "document" | "editable" | "selection" | "link";
  type MarkdownViewerUiIcon = "code" | "document" | "search" | "refresh" | "plus" | "more";

  interface MarkdownViewerUiContribution {
    id: string;
    placement: MarkdownViewerUiPlacement;
    label: string;
    /** Local command id registered through ctx.commands.register(). */
    command: string;
    tooltip?: string;
    icon?: MarkdownViewerUiIcon;
    order?: number;
    when?: MarkdownViewerUiWhen;
    /** Used by statusbar only; defaults to right. */
    side?: "left" | "right";
  }


  interface MarkdownViewerPanelDefinition {
    id: string;
    title: string;
    html: string;
    css?: string;
    icon?: MarkdownViewerUiIcon;
    order?: number;
    when?: MarkdownViewerUiWhen;
  }

  interface MarkdownViewerPanelController {
    open(): void;
    close(): void;
    postMessage(payload: unknown): void;
    onMessage(handler: (payload: unknown) => void | Promise<void>): () => void;
    dispose(): void;
  }

  interface Window {
    /** Available only inside the sandboxed plugin panel iframe. */
    readonly markdownViewerPanel?: {
      postMessage(payload: unknown): void;
      onMessage(handler: (payload: unknown) => void): () => void;
    };
  }

  interface MarkdownViewerActiveFile {
    id: string;
    path: string;
    fileName: string;
    format: string;
    editable: boolean;
    dirty: boolean;
  }

  interface MarkdownViewerEditorSelection {
    text: string;
    empty: boolean;
  }

  interface MarkdownViewerEditorDocument {
    documentId: string;
    source: string;
    selection: MarkdownViewerEditorSelection;
  }

  type MarkdownViewerPluginEventName = keyof MarkdownViewerPluginEventMap;

  interface MarkdownViewerPluginEventMap {
    "workspace.fileOpened": { file: MarkdownViewerActiveFile };
    "workspace.fileClosed": { id: string; path: string; fileName: string; format: string };
    "workspace.activeFileChanged": { file: MarkdownViewerActiveFile | null };
    "editor.changed": {
      documentId: string;
      dirty: boolean;
      wordCount: number;
      characterCount: number;
      lineCount: number;
      sizeBytes: number;
    };
    "editor.selectionChanged": {
      documentId: string;
      empty: boolean;
      textLength: number;
    };
  }
}

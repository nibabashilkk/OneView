import type {
  PluginActiveFile,
  PluginEditorDocument,
  PluginEditorSelection,
} from "../domain/plugin";

export type ReservedShortcut = {
  id: string;
  title: string;
  shortcut: string;
};

/**
 * Stable capabilities that the plugin application layer may ask the host app to perform.
 * Keep this DTO/function-only: never expose Svelte stores, ProseMirror or Tauri handles here.
 */
export interface PluginHostServices {
  getActiveFile(): PluginActiveFile | null;
  getEditorDocument(): PluginEditorDocument | null;
  getEditorSelection(): PluginEditorSelection | null;
  replaceEditorSelection(text: string): void;
  insertEditorText(text: string): void;
  showNotice(message: string): void;
  writeClipboard(text: string): Promise<void>;
  reportError(pluginId: string, message: string): void;
  getReservedShortcuts(): readonly ReservedShortcut[];
}

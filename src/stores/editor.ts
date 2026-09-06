import { writable } from "svelte/store";
import type { OutlineItem, RenderedDocument } from "../lib/contracts";

export type EditorMode = "read" | "wysiwyg";

export type EditorDraft = {
  source: string;
  savedSource: string;
  dirty: boolean;
  mode: EditorMode;
  outline: OutlineItem[];
  wordCount: number;
  characterCount: number;
  lineCount: number;
  sizeBytes: number;
  saving: boolean;
  lastSavedAtMs: number | null;
};

type EditorState = {
  byId: Record<string, EditorDraft>;
};

function stats(source: string) {
  const visible = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-]/g, " ");
  const characterCount = [...visible].filter((char) => !/\s/u.test(char)).length;
  const cjk = visible.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu)?.length ?? 0;
  const latin = visible.replace(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu, " ").match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  return { characterCount, wordCount: cjk + latin, lineCount: source.split(/\r?\n/).length, sizeBytes: new TextEncoder().encode(source).length };
}

function defaultMode(document: RenderedDocument): EditorMode {
  if (document.id === "sample" || !document.editable) return "read";
  return document.compatibility.canWysiwyg ? "wysiwyg" : "read";
}

function createEditorStore() {
  const { subscribe, update } = writable<EditorState>({ byId: {} });
  return {
    subscribe,
    ensure(document: RenderedDocument) {
      update((state) => {
        if (state.byId[document.id]) return state;
        return {
          byId: {
            ...state.byId,
            [document.id]: {
              source: document.source,
              savedSource: document.source,
              dirty: false,
              mode: defaultMode(document),
              outline: document.outline,
              wordCount: document.wordCount,
              characterCount: document.characterCount,
              lineCount: document.lineCount,
              sizeBytes: document.sizeBytes,
              saving: false,
              lastSavedAtMs: null,
            },
          },
        };
      });
    },
    replaceFromDisk(document: RenderedDocument, preserveMode = true) {
      update((state) => {
        const current = state.byId[document.id];
        const mode = preserveMode ? current?.mode ?? defaultMode(document) : defaultMode(document);
        return {
          byId: {
            ...state.byId,
            [document.id]: {
              source: document.source,
              savedSource: document.source,
              dirty: false,
              mode,
              outline: document.outline,
              wordCount: document.wordCount,
              characterCount: document.characterCount,
              lineCount: document.lineCount,
              sizeBytes: document.sizeBytes,
              saving: false,
              lastSavedAtMs: Date.now(),
            },
          },
        };
      });
    },
    updateSource(id: string, source: string, outline: OutlineItem[] = []) {
      update((state) => {
        const current = state.byId[id];
        if (!current) return state;
        const measured = stats(source);
        const nextOutline = outline.length ? outline : outlineFromSource(source);
        return {
          byId: {
            ...state.byId,
            [id]: {
              ...current,
              source,
              dirty: normalizeLineEndings(source) !== normalizeLineEndings(current.savedSource),
              outline: nextOutline,
              ...measured,
            },
          },
        };
      });
    },
    setMode(id: string, mode: EditorMode) {
      update((state) => {
        const current = state.byId[id];
        return current ? { ...state, byId: { ...state.byId, [id]: { ...current, mode } } } : state;
      });
    },
    setSaving(id: string, saving: boolean) {
      update((state) => {
        const current = state.byId[id];
        return current ? { ...state, byId: { ...state.byId, [id]: { ...current, saving } } } : state;
      });
    },
    markPersisted(document: RenderedDocument, persistedSource: string) {
      update((state) => {
        const current = state.byId[document.id];
        if (!current) return state;
        const currentMatches = normalizeLineEndings(current.source) === normalizeLineEndings(persistedSource);
        return {
          ...state,
          byId: {
            ...state.byId,
            [document.id]: currentMatches
              ? {
                  ...current,
                  source: document.source,
                  savedSource: document.source,
                  dirty: false,
                  outline: document.outline,
                  wordCount: document.wordCount,
                  characterCount: document.characterCount,
                  lineCount: document.lineCount,
                  sizeBytes: document.sizeBytes,
                  saving: false,
                  lastSavedAtMs: Date.now(),
                }
              : {
                  ...current,
                  savedSource: persistedSource,
                  dirty: normalizeLineEndings(current.source) !== normalizeLineEndings(persistedSource),
                  saving: false,
                  lastSavedAtMs: Date.now(),
                },
          },
        };
      });
    },
    markSaved(document: RenderedDocument) {
      update((state) => {
        const current = state.byId[document.id];
        if (!current) return state;
        return {
          ...state,
          byId: {
            ...state.byId,
            [document.id]: {
              ...current,
              source: document.source,
              savedSource: document.source,
              dirty: false,
              outline: document.outline,
              wordCount: document.wordCount,
              characterCount: document.characterCount,
              lineCount: document.lineCount,
              sizeBytes: document.sizeBytes,
              saving: false,
              lastSavedAtMs: Date.now(),
            },
          },
        };
      });
    },
    remove(id: string) {
      update((state) => {
        const byId = { ...state.byId };
        delete byId[id];
        return { byId };
      });
    },
  };
}

export const editor = createEditorStore();


function outlineFromSource(source: string): OutlineItem[] {
  const lines = source.split(/\r?\n/);
  const used = new Map<string, number>();
  const result: OutlineItem[] = [];
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    let level = 0;
    let title = "";
    const atx = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (atx) { level = atx[1].length; title = atx[2]; }
    else if (index + 1 < lines.length && /^(=+|-+)\s*$/.test(lines[index + 1]) && line.trim()) {
      level = lines[index + 1].trim().startsWith("=") ? 1 : 2;
      title = line.trim();
      index += 1;
    }
    if (!level || !title) continue;
    title = title.replace(/[*_~`\[\]]/g, "").trim();
    const base = slug(title);
    const count = used.get(base) ?? 0; used.set(base, count + 1);
    result.push({ id: count ? `${base}-${count}` : base, level, title });
  }
  return result;
}

function slug(value: string) {
  const normalized = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "-").replace(/^-+|-+$/g, "");
  return normalized || "section";
}


function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

import { writable } from "svelte/store";
import type { RecentFile, RecentProject, RenderedDocument, WorkspaceProject, WorkspaceSnapshot } from "../lib/contracts";
import { isTauri } from "../lib/runtime";
import { sampleDocument } from "../lib/sample";

const MAX_RECENT_FILES = 12;
const MAX_RECENT_PROJECTS = 8;

export type SidebarMode = "project" | "outline" | "search";

export type WorkspaceState = {
  documents: RenderedDocument[];
  activeId: string | null;
  sidebarOpen: boolean;
  sidebarMode: SidebarMode;
  loading: boolean;
  error: string | null;
  recentFiles: RecentFile[];
  project: WorkspaceProject | null;
  recentProjects: RecentProject[];
  scrollTopById: Record<string, number>;
  readingProgressById: Record<string, number>;
  activeHeadingById: Record<string, string | null>;
};

function createInitialState(): WorkspaceState {
  const browserPreview = !isTauri();
  return {
    documents: browserPreview ? [sampleDocument] : [],
    activeId: browserPreview ? sampleDocument.id : null,
    sidebarOpen: true,
    sidebarMode: "outline",
    loading: false,
    error: null,
    recentFiles: [],
    project: null,
    recentProjects: [],
    scrollTopById: browserPreview ? { [sampleDocument.id]: 0 } : {},
    readingProgressById: browserPreview ? { [sampleDocument.id]: 0 } : {},
    activeHeadingById: browserPreview ? { [sampleDocument.id]: sampleDocument.outline[0]?.id ?? null } : {},
  };
}

function createWorkspace() {
  const { subscribe, update, set } = writable<WorkspaceState>(createInitialState());

  return {
    subscribe,
    reset: () => set(createInitialState()),
    setLoading: (loading: boolean) => update((state) => ({ ...state, loading })),
    setError: (error: string | null) => update((state) => ({ ...state, error })),
    toggleSidebar: () => update((state) => ({ ...state, sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen: boolean) => update((state) => ({ ...state, sidebarOpen })),
    setSidebarMode: (sidebarMode: SidebarMode) => update((state) => ({ ...state, sidebarMode, sidebarOpen: true })),
    setActive: (activeId: string) => update((state) => ({ ...state, activeId })),
    cycleActive: (direction: 1 | -1) =>
      update((state) => {
        if (state.documents.length <= 1) return state;
        const current = Math.max(0, state.documents.findIndex((document) => document.id === state.activeId));
        const next = (current + direction + state.documents.length) % state.documents.length;
        return { ...state, activeId: state.documents[next].id };
      }),
    setActiveAt: (index: number) =>
      update((state) => {
        const document = state.documents[index];
        return document ? { ...state, activeId: document.id } : state;
      }),
    setActiveByPath: (path: string) =>
      update((state) => {
        const found = state.documents.find((document) => samePath(document.path, path));
        return found ? { ...state, activeId: found.id } : state;
      }),
    setRecentFiles: (recentFiles: RecentFile[]) =>
      update((state) => ({ ...state, recentFiles: dedupeRecent(recentFiles) })),
    clearRecentFiles: () => update((state) => ({ ...state, recentFiles: [] })),
    removeRecentFile: (path: string) =>
      update((state) => ({
        ...state,
        recentFiles: state.recentFiles.filter((item) => !samePath(item.path, path)),
      })),
    setRecentProjects: (recentProjects: RecentProject[]) =>
      update((state) => ({ ...state, recentProjects: dedupeProjects(recentProjects) })),
    setProject: (project: WorkspaceProject | null) =>
      update((state) => ({
        ...state,
        project,
        sidebarMode: project ? "project" : state.sidebarMode === "project" ? "outline" : state.sidebarMode,
        recentProjects: project
          ? rememberProject(state.recentProjects, project.root, project.name)
          : state.recentProjects,
      })),
    clearProject: () => update((state) => ({ ...state, project: null, sidebarMode: "outline" })),
    removeRecentProject: (path: string) => update((state) => ({
      ...state,
      recentProjects: state.recentProjects.filter((item) => !samePath(item.path, path)),
    })),
    setScrollTop: (id: string, scrollTop: number) =>
      update((state) => ({
        ...state,
        scrollTopById: { ...state.scrollTopById, [id]: Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0) },
      })),
    setViewportState: (id: string, scrollTop: number, progress: number, activeHeadingId: string | null) =>
      update((state) => ({
        ...state,
        scrollTopById: { ...state.scrollTopById, [id]: Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0) },
        readingProgressById: { ...state.readingProgressById, [id]: Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) },
        activeHeadingById: { ...state.activeHeadingById, [id]: activeHeadingId },
      })),
    upsertDocument: (document: RenderedDocument, activate = true) =>
      update((state) => {
        const exists = state.documents.some((item) => item.id === document.id);
        const documents = exists
          ? state.documents.map((item) => (item.id === document.id ? document : item))
          : [...state.documents.filter((item) => item.id !== "sample"), document];
        const scrollTopById = { ...state.scrollTopById };
        const readingProgressById = { ...state.readingProgressById };
        const activeHeadingById = { ...state.activeHeadingById };
        if (!(document.id in scrollTopById)) scrollTopById[document.id] = 0;
        if (!(document.id in readingProgressById)) readingProgressById[document.id] = 0;
        if (!(document.id in activeHeadingById)) activeHeadingById[document.id] = document.outline[0]?.id ?? null;

        return {
          ...state,
          documents,
          scrollTopById,
          readingProgressById,
          activeHeadingById,
          recentFiles: rememberRecent(state.recentFiles, document.path, document.fileName),
          activeId: activate ? document.id : state.activeId ?? document.id,
          error: null,
        };
      }),
    closeDocument: (id: string) =>
      update((state) => {
        const closingIndex = state.documents.findIndex((document) => document.id === id);
        const documents = state.documents.filter((document) => document.id !== id);
        let activeId = state.activeId;
        if (state.activeId === id) {
          const next = documents[Math.min(closingIndex, Math.max(0, documents.length - 1))];
          activeId = next?.id ?? null;
        }
        const scrollTopById = { ...state.scrollTopById };
        const readingProgressById = { ...state.readingProgressById };
        const activeHeadingById = { ...state.activeHeadingById };
        delete scrollTopById[id]; delete readingProgressById[id]; delete activeHeadingById[id];
        return { ...state, documents, activeId, scrollTopById, readingProgressById, activeHeadingById };
      }),
  };
}

export function toWorkspaceSnapshot(state: WorkspaceState): WorkspaceSnapshot {
  const active = state.documents.find((document) => document.id === state.activeId);
  return {
    version: 2,
    openTabs: state.documents
      .filter((document) => document.id !== "sample")
      .map((document) => ({ path: document.path, scrollTop: state.scrollTopById[document.id] ?? 0 })),
    activePath: active?.path ?? null,
    sidebarOpen: state.sidebarOpen,
    recentFiles: state.recentFiles,
    projectRoot: state.project?.root ?? null,
    recentProjects: state.recentProjects,
  };
}

function rememberRecent(items: RecentFile[], path: string, fileName: string): RecentFile[] {
  return dedupeRecent([{ path, fileName, lastOpenedAtMs: Date.now() }, ...items.filter((item) => !samePath(item.path, path))]);
}

function dedupeRecent(items: RecentFile[]): RecentFile[] {
  const result: RecentFile[] = [];
  for (const item of items) {
    if (result.some((existing) => samePath(existing.path, item.path))) continue;
    result.push(item);
    if (result.length >= MAX_RECENT_FILES) break;
  }
  return result;
}

function rememberProject(items: RecentProject[], path: string, name: string): RecentProject[] {
  return dedupeProjects([{ path, name, lastOpenedAtMs: Date.now() }, ...items.filter((item) => !samePath(item.path, path))]);
}

function dedupeProjects(items: RecentProject[]): RecentProject[] {
  const result: RecentProject[] = [];
  for (const item of items) {
    if (result.some((existing) => samePath(existing.path, item.path))) continue;
    result.push(item);
    if (result.length >= MAX_RECENT_PROJECTS) break;
  }
  return result;
}

export function samePath(left: string, right: string) {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
    ? left.toLocaleLowerCase() === right.toLocaleLowerCase()
    : left === right;
}

export const workspace = createWorkspace();

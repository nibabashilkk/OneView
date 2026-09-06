<script lang="ts">
  import { onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import TopBar from "./components/shell/TopBar.svelte";
  import SettingsPanel from "./components/shell/SettingsPanel.svelte";
  import PluginCenterPanel from "./features/plugins/ui/PluginCenterPanel.svelte";
  import CommandPalette from "./components/overlay/CommandPalette.svelte";
  import ContextMenu from "./components/overlay/ContextMenu.svelte";
  import NoticeToast from "./components/overlay/NoticeToast.svelte";
  import AboutPanel from "./components/overlay/AboutPanel.svelte";
  import DiagnosticsPanel from "./components/overlay/DiagnosticsPanel.svelte";
  import CompatibilityPanel from "./components/overlay/CompatibilityPanel.svelte";
  import DefaultAppPrompt from "./components/overlay/DefaultAppPrompt.svelte";
  import StatusBar from "./components/shell/StatusBar.svelte";
  import OutlinePanel from "./features/viewer/OutlinePanel.svelte";
  import WorkspacePanel from "./features/workspace/WorkspacePanel.svelte";
  import MarkdownView from "./features/viewer/MarkdownView.svelte";
  import WysiwygEditor from "./features/editor/WysiwygEditor.svelte";
  import { editorSession } from "./features/editor/editor-session";
  import EmptyState from "./features/viewer/EmptyState.svelte";
  import SearchBar from "./features/viewer/SearchBar.svelte";
  import { workspace, samePath, toWorkspaceSnapshot } from "./stores/workspace";
  import { editor, type EditorMode } from "./stores/editor";
  import { theme, resolvedTheme } from "./stores/theme";
  import { settings } from "./stores/settings";
  import { defaultApp } from "./stores/default-app";
  import { search } from "./stores/search";
  import {
    chooseDocumentFile,
    closeDocument,
    listenForDocumentChanges,
    listenForOpenFiles,
    listenForSystemActions,
    openDocument,
    analyzeMarkdown,
    saveDocument,
    takeStartupFiles,
    takeStartupActions,
  } from "./services/document-service";
  import { loadWorkspace, saveWorkspace } from "./services/workspace-service";
  import { chooseWorkspaceDirectory, openWorkspaceProject, searchWorkspaceProject } from "./services/project-service";
  import { loadSettings, saveSettings } from "./services/settings-service";
  import { ExternalOpenCoordinator } from "./services/external-open-coordinator";
  import { exportHtml, printPdf } from "./services/export-service";
  import { isTauri } from "./lib/runtime";
  import { openExternalUrl, revealLocalPath } from "./services/resource-service";
  import { cleanArticle, cleanHtmlFragment, copyHtmlSource, copyPlainText, copyRichHtml } from "./services/clipboard-service";
  import { APP_RESERVED_SHORTCUT_ENTRIES, createAppCommands, commandMatchesKeyboard, type AppCommand } from "./commands/app-commands";
  import { notice } from "./stores/notice";
  import { diagnostics } from "./stores/diagnostics";
  import { isLargeDocument } from "./features/viewer/performance";
  import type { ViewerViewport } from "./features/viewer/viewport-tracker";
  import {
    cancelApplicationExit,
    clearCrashLog,
    confirmApplicationExit,
    getBuildInfo,
    listenForApplicationExitRequested,
    listenForNativeCommands,
    loadCrashLog,
    requestApplicationExit,
    setApplicationExitGuardReady,
    setMainWindowTitle,
  } from "./services/app-service";
  import { checkForUpdate, installUpdate } from "./services/update-service";
  import type { AppTheme, BuildInfo, CompatibilityReport, ContextMenuItem, DocumentFileEvent, OutlineItem, RenderedDocument, StartupSystemAction, UpdateMetadata, ViewerContextMenuRequest, WorkspaceSearchResponse, WorkspaceSearchResult, WorkspaceSnapshot } from "./lib/contracts";
  import { createPluginManager } from "./features/plugins";
  import { startPluginEventBridge } from "./features/plugins/infrastructure/plugin-event-bridge";
  import { isPluginContributionVisible } from "./features/plugins/application/contribution-visibility";
  import { applyPluginDocumentRender } from "./features/plugins/application/document-renderer";
  import PluginPanelDrawer from "./features/plugins/ui/PluginPanelDrawer.svelte";
  import type { PluginPanelContribution, PluginUiContribution } from "./features/plugins/domain/plugin";

  let settingsOpen = false;
  let pluginsOpen = false;
  let commandPaletteOpen = false;
  let aboutOpen = false;
  let diagnosticsOpen = false;
  let compatibilityOpen = false;
  let compatibilityPreview: CompatibilityReport | null = null;
  let buildInfo: BuildInfo | null = null;
  let updateStatus: "idle" | "checking" | "available" | "current" | "downloading" | "error" = "idle";
  let availableUpdate: UpdateMetadata | null = null;
  let updateProgress = 0;
  let updateError: string | null = null;
  let lastWindowTitle = "";
  let crashLog: string | null = null;
  let contextMenuRequest: ViewerContextMenuRequest | null = null;
  let commands: AppCommand[] = [];
  let contextMenuItems: ContextMenuItem[] = [];
  let pluginToolbarItems: PluginUiContribution[] = [];
  let pluginStatusItems: PluginUiContribution[] = [];
  let pluginPanels: PluginPanelContribution[] = [];
  let activePluginPanel: PluginPanelContribution | null = null;
  let pluginHasSelection = false;
  const lastCommandAt = new Map<string, number>();
  const ignoreFileChangeUntil = new Map<string, number>();
  const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const saveInFlight = new Set<string>();
  const savePending = new Set<string>();
  let workspaceSearchQuery = "";
  let workspaceSearchResults: WorkspaceSearchResult[] = [];
  let workspaceSearchMeta: WorkspaceSearchResponse | null = null;
  let workspaceSearchLoading = false;
  let workspaceSearchTimer: ReturnType<typeof setTimeout> | null = null;
  let workspaceSearchGeneration = 0;
  let quitInProgress = false;
  let defaultAppPromptOpen = false;
  let defaultAppPromptCheckedThisSession = false;
  let defaultAppPromptTimer: ReturnType<typeof setTimeout> | null = null;
  let appReady = false;

  const pluginManager = createPluginManager({
    getActiveFile: () => {
      const state = get(workspace);
      const document = state.documents.find((item) => item.id === state.activeId);
      if (!document) return null;
      const draft = get(editor).byId[document.id];
      return {
        id: document.id,
        path: document.path,
        fileName: document.fileName,
        format: document.format,
        editable: document.editable,
        dirty: draft?.dirty ?? false,
      };
    },
    getEditorDocument: () => {
      const snapshot = editorSession.getSnapshot();
      if (!snapshot) return null;
      return {
        documentId: snapshot.documentId,
        source: snapshot.source,
        selection: snapshot.selection,
      };
    },
    getEditorSelection: () => editorSession.getSelection(),
    replaceEditorSelection: (text) => editorSession.replaceSelection(text),
    insertEditorText: (text) => editorSession.insertText(text),
    showNotice: (message) => notice.show(message),
    writeClipboard: (text) => copyPlainText(text),
    reportError: (pluginId, message) => diagnostics.push(`plugin:${pluginId}`, message),
    getReservedShortcuts: () => APP_RESERVED_SHORTCUT_ENTRIES,
  });
  const pluginState = pluginManager.state;
  let stopPluginEvents: (() => void) | null = null;
  const CORE_DOCUMENT_EXTENSIONS = ["md", "markdown", "mdown", "mkd", "txt", "text"] as const;
  let lastPluginFormatSignature = "";

  function activeDocumentExtensions(): string[] {
    // Core only advertises Markdown/plain text. Every developer format enters discovery
    // exclusively through an active plugin contribution.
    return [...new Set([...CORE_DOCUMENT_EXTENSIONS, ...pluginManager.supportedDocumentExtensions()])];
  }

  function isSupportedDocumentPath(path: string): boolean {
    const fileName = String(path ?? "").split(/[\\/]/).pop() ?? "";
    const index = fileName.lastIndexOf(".");
    const extension = index > 0 ? fileName.slice(index + 1).toLowerCase() : "";
    return activeDocumentExtensions().includes(extension);
  }

  async function applyOptionalDocumentPlugin(document: RenderedDocument): Promise<RenderedDocument> {
    if (document.format === "markdown") return document;
    try {
      const rendered = await pluginManager.renderDocument({
        id: document.id,
        path: document.path,
        fileName: document.fileName,
        source: document.source,
        encoding: document.encoding,
        lineEnding: document.lineEnding,
        modifiedAtMs: document.modifiedAtMs,
        sizeBytes: document.sizeBytes,
      });
      return rendered ? applyPluginDocumentRender(document, rendered.format, rendered.result) : document;
    } catch (error) {
      diagnostics.push("plugins", `文档插件渲染失败，已回退到纯文本：${error instanceof Error ? error.message : String(error)}`);
      return document;
    }
  }

  let pluginDocumentRefreshGeneration = 0;
  async function refreshOpenPluginDocuments() {
    const generation = ++pluginDocumentRefreshGeneration;
    const documents = get(workspace).documents.filter((document) => document.id !== "sample" && document.format !== "markdown");
    for (const current of documents) {
      try {
        const base = await openDocument(current.path);
        const next = await applyOptionalDocumentPlugin(base);
        if (generation !== pluginDocumentRefreshGeneration) return;
        workspace.upsertDocument(next, false);
      } catch (error) {
        diagnostics.push("plugins", `刷新插件文档失败：${current.fileName} · ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  $: active = $workspace.documents.find((document) => document.id === $workspace.activeId) ?? null;
  $: if (active?.editable && !$editor.byId[active.id]) editor.ensure(active);
  $: activeDraft = active ? $editor.byId[active.id] ?? null : null;
  $: {
    const activeFormats = ($pluginState.plugins ?? [])
      .filter((plugin) => plugin.enabled && plugin.compatible && $pluginState.runtimeById[plugin.manifest.id]?.status === "active")
      .flatMap((plugin) => (plugin.manifest.contributes?.documentFormats ?? []).map((format) => `${plugin.manifest.id}:${format.id}:${format.extensions.join(",")}`))
      .sort()
      .join("|");
    if (activeFormats !== lastPluginFormatSignature) {
      const hadPreviousSignature = lastPluginFormatSignature !== "";
      lastPluginFormatSignature = activeFormats;
      if (hadPreviousSignature) {
        void refreshOpenPluginDocuments();
        if ($workspace.project) void loadProject($workspace.project.root, false, false, true);
      }
    }
  }

  function dismissDefaultAppPrompt(days = 30) {
    settings.setDefaultAppPromptDismissedUntilMs(Date.now() + days * 24 * 60 * 60 * 1000);
    defaultAppPromptOpen = false;
  }

  async function maybeOfferDefaultMarkdown(document: RenderedDocument, contextualOpen: boolean) {
    if (!contextualOpen || defaultAppPromptCheckedThisSession || document.format !== "markdown" || !isTauri() || buildInfo?.debug) return;
    if (get(settings).defaultAppPromptDismissedUntilMs > Date.now()) return;
    defaultAppPromptCheckedThisSession = true;

    if (defaultAppPromptTimer) clearTimeout(defaultAppPromptTimer);
    defaultAppPromptTimer = setTimeout(() => {
      defaultAppPromptTimer = null;
      void defaultApp.refresh().then((status) => {
        const markdown = status.associations.find((item) => item.key === "markdown");
        if (status.platform === "macos" && (!status.appInstalled || markdown?.isDefault === true)) return;
        if (status.platform !== "macos" && status.platform !== "windows") return;
        defaultAppPromptOpen = true;
      }).catch((error) => diagnostics.push("app", `检查默认打开方式失败：${String(error)}`));
    }, 700);
  }

  async function handleSetDefaultMarkdown() {
    try {
      const result = await defaultApp.request("markdown");
      notice.show(result.message);

      if (result.mode === "systemSettings") {
        dismissDefaultAppPrompt(30);
        return;
      }

      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const status = await defaultApp.refresh();
        if (status.associations.find((item) => item.key === "markdown")?.isDefault === true) {
          defaultAppPromptOpen = false;
          settings.setDefaultAppPromptDismissedUntilMs(0);
          notice.show("oneView 已成为 Markdown 默认应用");
          return;
        }
      }
      notice.show("如果 macOS 弹出了系统确认，请完成授权；也可以在设置中刷新状态。");
    } catch (error) {
      workspace.setError(`设置默认应用失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function loadPath(
    path: string,
    activate = true,
    showLoading = true,
    reportError = true,
  ): Promise<RenderedDocument | null> {
    if (showLoading) workspace.setLoading(true);
    try {
      let document = await openDocument(path);
      document = await applyOptionalDocumentPlugin(document);
      workspace.upsertDocument(document, activate);
      if (document.editable) editor.ensure(document);
      void maybeOfferDefaultMarkdown(document, activate && showLoading);
      return document;
    } catch (error) {
      workspace.removeRecentFile(path);
      if (reportError) workspace.setError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      if (showLoading) workspace.setLoading(false);
    }
  }

  async function openPaths(paths: string[], activateLast = true) {
    const unique = [...new Set(paths.filter(isSupportedDocumentPath))];
    for (let index = 0; index < unique.length; index += 1) {
      await loadPath(unique[index], activateLast && index === unique.length - 1);
    }
  }

  async function waitForRenderedDocument(documentId: string) {
    await tick();
    const startedAt = performance.now();
    while (performance.now() - startedAt < 5000) {
      const selectorId = globalThis.CSS?.escape ? CSS.escape(documentId) : documentId.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      const article = globalThis.document?.querySelector<HTMLElement>(
        `article.markdown-body[data-document-id="${selectorId}"]`,
      );
      const visualEditor = globalThis.document?.querySelector<HTMLElement>(".markdown-wysiwyg");
      if (article?.dataset.renderReady === "true" || visualEditor) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  async function handleSystemActions(actions: StartupSystemAction[]) {
    const unique = actions.filter((action, index, list) =>
      list.findIndex((candidate) => candidate.action === action.action && samePath(candidate.path, action.path)) === index
    );

    for (const action of unique) {
      const opened = await loadPath(action.path, true, false, true);
      if (!opened) continue;

      switch (action.action) {
        case "edit":
          await handleModeChange("wysiwyg");
          break;
        case "source":
          // Legacy external action: source mode was removed in v0.17.1.
          await handleModeChange("wysiwyg");
          break;
        case "read":
          await handleModeChange("read");
          break;
        case "print":
          await handleModeChange("read");
          await waitForRenderedDocument(opened.id);
          handleExportPdf();
          break;
        case "exportHtml":
          await handleModeChange("read");
          await waitForRenderedDocument(opened.id);
          await handleExportHtml();
          break;
        case "copyRich":
          await handleModeChange("read");
          await waitForRenderedDocument(opened.id);
          await handleCopyDocumentRich();
          break;
      }
    }
  }

  async function handleOpen() {
    if (!isTauri()) {
      workspace.setError("当前是浏览器预览。请运行 npm run tauri dev 后打开本地文件。");
      return;
    }
    const path = await chooseDocumentFile(activeDocumentExtensions());
    if (path) await loadPath(path, true);
  }

  async function loadProject(path: string, openReadme = true, reportError = true, forceRefresh = false) {
    workspace.setLoading(true);
    try {
      const project = await openWorkspaceProject(path, forceRefresh, pluginManager.workspaceDocumentFormats());
      workspace.setProject(project);
      workspaceSearchQuery = "";
      workspaceSearchResults = [];
      workspaceSearchMeta = null;
      if (openReadme && project.readmePath) await loadPath(project.readmePath, true, false, false);
      return project;
    } catch (error) {
      workspace.removeRecentProject(path);
      if (reportError) workspace.setError(`打开工作区失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      workspace.setLoading(false);
    }
  }

  async function handleOpenWorkspace() {
    if (!isTauri()) { workspace.setError("文件夹工作区仅在桌面版可用。"); return; }
    const path = await chooseWorkspaceDirectory();
    if (path) await loadProject(path, true);
  }

  function handleWorkspaceSearchOpen() {
    if (!$workspace.project) return;
    workspace.setSidebarMode("search");
  }

  function handleWorkspaceSearchChange(query: string) {
    workspaceSearchQuery = query;
    if (workspaceSearchTimer) clearTimeout(workspaceSearchTimer);
    const project = get(workspace).project;
    if (!project || !query.trim()) { workspaceSearchResults = []; workspaceSearchMeta = null; workspaceSearchLoading = false; return; }
    const generation = ++workspaceSearchGeneration;
    workspaceSearchLoading = true;
    workspaceSearchTimer = setTimeout(() => {
      workspaceSearchTimer = null;
      void searchWorkspaceProject(project.root, query.trim(), 200, pluginManager.workspaceDocumentFormats())
        .then((response) => { if (generation === workspaceSearchGeneration) { workspaceSearchResults = response.results; workspaceSearchMeta = response; } })
        .catch((error) => { if (generation === workspaceSearchGeneration) workspace.setError(`工作区搜索失败：${error instanceof Error ? error.message : String(error)}`); })
        .finally(() => { if (generation === workspaceSearchGeneration) workspaceSearchLoading = false; });
    }, 220);
  }

  async function handleWorkspaceSearchResult(result: WorkspaceSearchResult) {
    const opened = await loadPath(result.path, true, false, true);
    if (!opened) return;
    search.setQuery(workspaceSearchQuery.trim());
    search.open();
  }

  async function handleRefreshWorkspace() {
    const project = get(workspace).project;
    if (project) await loadProject(project.root, false, true, true);
  }

  function handleCloseWorkspace() {
    workspace.clearProject();
    workspaceSearchQuery = ""; workspaceSearchResults = []; workspaceSearchMeta = null; workspaceSearchGeneration += 1;
  }

  async function handleRecent(path: string) {
    await loadPath(path, true);
  }

  async function handleDocumentLink(path: string, fragment: string | null) {
    const opened = await loadPath(path, true, false);
    if (!opened || !fragment) return;
    await tick();
    requestAnimationFrame(() => {
      const id = decodeURIComponent(fragment);
      globalThis.document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleClose(id: string) {
    const document = get(workspace).documents.find((item) => item.id === id);
    let draft = get(editor).byId[id];
    if (draft?.dirty && get(settings).autoSave && document?.id !== "sample") {
      await saveDraftById(id, true);
      draft = get(editor).byId[id];
    }
    if (draft?.dirty) {
      const discard = window.confirm(`“${document?.fileName ?? "当前文档"}”有未保存更改。确定关闭并丢弃这些更改吗？`);
      if (!discard) return;
    }
    cancelAutoSave(id);
    if (document && isTauri()) {
      try {
        await closeDocument(document.path);
      } catch (error) {
        workspace.setError(error instanceof Error ? error.message : String(error));
      }
    }
    editor.remove(id);
    workspace.closeDocument(id);
  }

  async function handleFileChange(event: DocumentFileEvent) {
    const state = get(workspace);
    const current = state.documents.find((document) => samePath(document.path, event.path));
    if (!current) return;
    if ((ignoreFileChangeUntil.get(event.path) ?? 0) > Date.now()) return;

    const draft = get(editor).byId[current.id];
    if (draft?.dirty) {
      workspace.setError(`“${current.fileName}”已在外部修改。当前编辑草稿未被覆盖，请先保存或处理当前修改后重新打开。`);
      return;
    }

    try {
      let reloaded = await openDocument(event.path);
      reloaded = await applyOptionalDocumentPlugin(reloaded);
      workspace.upsertDocument(reloaded, false);
      if (reloaded.editable) editor.replaceFromDisk(reloaded, true);
      else editor.remove(reloaded.id);
    } catch (error) {
      if (event.kind === "removed") workspace.setError(`文件已被删除或移动：${current.fileName}`);
      else workspace.setError(error instanceof Error ? error.message : String(error));
    }
  }

  function cancelAutoSave(id: string) {
    const timer = autoSaveTimers.get(id);
    if (timer) clearTimeout(timer);
    autoSaveTimers.delete(id);
  }

  function scheduleAutoSave(id: string) {
    cancelAutoSave(id);
    if (!isTauri() || !get(settings).autoSave) return;
    const state = get(workspace);
    const document = state.documents.find((item) => item.id === id);
    const draft = get(editor).byId[id];
    if (!document || document.id === "sample" || !draft?.dirty) return;
    autoSaveTimers.set(id, setTimeout(() => {
      autoSaveTimers.delete(id);
      void saveDraftById(id, true);
    }, 900));
  }

  function handleEditorChange(id: string, source: string, outline: OutlineItem[] = []) {
    editor.updateSource(id, source, outline);
    if (active?.id === id) compatibilityPreview = null;
    scheduleAutoSave(id);
  }

  async function saveDraftById(id: string, silent: boolean) {
    cancelAutoSave(id);
    const state = get(workspace);
    const document = state.documents.find((item) => item.id === id);
    const draft = get(editor).byId[id];
    if (!document || document.id === "sample" || !draft?.dirty) return;

    // Visual-editor saves must pass the same Rust lossless engine used by file-open and system preview.
    // Documents that cannot round-trip safely stay in preview-only mode instead of exposing a raw-source fallback.
    if (draft.mode === "wysiwyg" && isTauri()) {
      const compatibility = await analyzeMarkdown(draft.source);
      compatibilityPreview = compatibility;
      if (!compatibility.canWysiwyg) {
        compatibilityOpen = true;
        workspace.setError("保存已阻止：编辑结果包含当前可视编辑器无法无损 round-trip 的结构。请撤销最近修改后再保存；原文件不会被覆盖。");
        return;
      }
    }
    if (saveInFlight.has(id)) {
      savePending.add(id);
      while (saveInFlight.has(id)) await new Promise((resolve) => setTimeout(resolve, 35));
      if (get(editor).byId[id]?.dirty) await saveDraftById(id, silent);
      return;
    }

    saveInFlight.add(id);
    editor.setSaving(id, true);
    const sourceAtStart = draft.source;
    try {
      ignoreFileChangeUntil.set(document.path, Date.now() + 1400);
      const saved = await saveDocument(document.path, sourceAtStart, document.encoding, document.lineEnding);
      workspace.upsertDocument(saved, false);
      editor.markPersisted(saved, sourceAtStart);
      if (active?.id === id) compatibilityPreview = null;
      if (!silent) notice.show("已保存 Markdown");
    } catch (error) {
      editor.setSaving(id, false);
      workspace.setError(`${silent ? "自动保存" : "保存"}失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      saveInFlight.delete(id);
      const pending = savePending.delete(id);
      const current = get(editor).byId[id];
      if (current?.saving) editor.setSaving(id, false);
      if ((pending || current?.dirty) && get(settings).autoSave) scheduleAutoSave(id);
    }
  }

  async function handleSave() {
    if (!active) return;
    await saveDraftById(active.id, false);
  }

  async function handleModeChange(mode: EditorMode) {
    if (!active || active.id === "sample") return;
    const requestedMode: EditorMode = mode === "read" && active.editable && (compatibilityPreview?.canWysiwyg ?? active.compatibility.canWysiwyg) ? "wysiwyg" : mode;
    if (requestedMode === "wysiwyg" && activeDraft) {
      let compatibility = active.compatibility;
      if (isTauri()) {
        try {
          compatibility = await analyzeMarkdown(activeDraft.source);
          compatibilityPreview = compatibility;
        } catch (error) {
          workspace.setError(`无损兼容性检查失败：${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      }

      if (!compatibility.canWysiwyg) {
        compatibilityOpen = true;
        workspace.setError("为避免破坏 Markdown，当前文档包含暂不支持无损可视编辑的结构，因此仅以安全预览方式打开。可在兼容性报告中查看具体位置。");
        return;
      }
      if (compatibility.level === "guarded") {
        compatibilityOpen = true;
        notice.show("已进入受保护编辑：语义可保持，但部分 Markdown 源码写法可能在保存时规范化");
      }
    }
    editor.setMode(active.id, requestedMode);
    if (requestedMode !== "read") search.close();
  }


  async function handleReveal() {
    if (!active || !isTauri()) return;
    try {
      await revealLocalPath(active.path);
    } catch (error) {
      workspace.setError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleViewportChange(documentId: string, viewport: ViewerViewport) {
    workspace.setViewportState(
      documentId,
      viewport.scrollTop,
      viewport.progress,
      viewport.activeHeadingId,
    );
  }

  function handleTheme() {
    const current = get(resolvedTheme);
    const next: AppTheme = current === "dark" ? "light" : "dark";
    settings.setAppTheme(next);
  }

  function activeArticle(): HTMLElement | null {
    return globalThis.document.querySelector<HTMLElement>(".markdown-body, .markdown-wysiwyg");
  }

  async function withCopyFeedback(action: () => Promise<void>, message: string) {
    try {
      await action();
      notice.show(message);
    } catch (error) {
      workspace.setError(`复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleCopyDocumentText() {
    const article = activeArticle();
    if (!article) return;
    const content = cleanArticle(article);
    await withCopyFeedback(() => copyPlainText(content.text), "已复制全文纯文本");
  }

  async function handleCopyDocumentRich() {
    const article = activeArticle();
    if (!article) return;
    const content = cleanArticle(article);
    await withCopyFeedback(() => copyRichHtml(content.html, content.text), "已复制全文富文本");
  }

  async function handleCopyDocumentHtml() {
    const article = activeArticle();
    if (!article) return;
    const content = cleanArticle(article);
    await withCopyFeedback(() => copyHtmlSource(content.html), "已复制全文 HTML");
  }

  async function handleCopyDocumentPath() {
    if (!active || active.id === "sample") return;
    await withCopyFeedback(() => copyPlainText(active.path), "已复制文件路径");
  }

  async function handleExportHtml() {
    if (!active) return;
    const article = activeArticle();
    if (!article) return;
    try {
      await exportHtml(active.fileName, article, get(settings), get(resolvedTheme));
    } catch (error) {
      workspace.setError(`导出 HTML 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleExportPdf() {
    if (!active) return;
    printPdf();
  }

  function jumpTo(id: string) {
    globalThis.document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openCommandPalette() {
    settingsOpen = false;
    pluginsOpen = false;
    aboutOpen = false;
    diagnosticsOpen = false;
    contextMenuRequest = null;
    commandPaletteOpen = true;
  }

  function openSettings() {
    pluginsOpen = false;
    aboutOpen = false;
    diagnosticsOpen = false;
    commandPaletteOpen = false;
    contextMenuRequest = null;
    settingsOpen = true;
  }

  function openPlugins() {
    settingsOpen = false;
    aboutOpen = false;
    diagnosticsOpen = false;
    commandPaletteOpen = false;
    contextMenuRequest = null;
    pluginsOpen = true;
  }

  function openAbout() {
    settingsOpen = false;
    pluginsOpen = false;
    diagnosticsOpen = false;
    commandPaletteOpen = false;
    contextMenuRequest = null;
    aboutOpen = true;
  }

  function openDiagnostics() {
    settingsOpen = false;
    pluginsOpen = false;
    aboutOpen = false;
    commandPaletteOpen = false;
    diagnosticsOpen = true;
    if (isTauri()) void loadCrashLog().then((value) => crashLog = value).catch((error) => diagnostics.push("app", `读取崩溃日志失败：${String(error)}`));
  }

  async function handleCheckUpdates(showCurrentNotice = true) {
    if (!buildInfo?.updaterConfigured || updateStatus === "checking" || updateStatus === "downloading") return;
    updateStatus = "checking";
    updateError = null;
    try {
      const result = await checkForUpdate();
      availableUpdate = result;
      if (result) {
        updateStatus = "available";
        notice.show(`发现新版本 v${result.version}`);
      } else {
        updateStatus = "current";
        if (showCurrentNotice) notice.show("当前已经是最新版本");
      }
    } catch (error) {
      updateStatus = "error";
      updateError = error instanceof Error ? error.message : String(error);
      diagnostics.push("app", `更新检查失败：${updateError}`);
      if (showCurrentNotice) workspace.setError(`检查更新失败：${updateError}`);
    }
  }

  async function handleInstallUpdate() {
    if (!availableUpdate || updateStatus === "downloading") return;
    updateStatus = "downloading";
    updateProgress = 0;
    updateError = null;
    let downloaded = 0;
    let total = 0;
    try {
      await installUpdate((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          updateProgress = total > 0 ? downloaded / total : 0.02;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          updateProgress = total > 0 ? Math.min(0.98, downloaded / total) : Math.min(0.95, updateProgress + 0.025);
        } else if (event.event === "Finished") {
          updateProgress = 1;
        }
      });
    } catch (error) {
      updateStatus = "error";
      updateError = error instanceof Error ? error.message : String(error);
      diagnostics.push("app", `安装更新失败：${updateError}`);
      workspace.setError(`安装更新失败：${updateError}`);
    }
  }

  function buildDiagnosticsText() {
    const lines = [
      "oneView Diagnostics",
      `version: ${buildInfo?.version ?? "unknown"}`,
      `platform: ${buildInfo ? `${buildInfo.os}/${buildInfo.arch}` : navigator.platform}`,
      `build: ${buildInfo?.debug ? "debug" : "release"}`,
      `updater: ${buildInfo?.updaterConfigured ? "configured" : "disabled"}`,
      `tabs: ${get(workspace).documents.length}`,
      `active: ${active?.fileName ?? "none"}`,
      `encoding: ${active?.encoding ?? "n/a"}`,
      `theme-mode: ${get(settings).appTheme}`,
      `theme-family: ${get(pluginManager.state).selectedThemeFamily}`,
      `userAgent: ${navigator.userAgent}`,
      "",
      "Recent errors:",
      ...get(diagnostics).map((entry) => `${new Date(entry.at).toISOString()} [${entry.source}] ${entry.message}`),
      ...(crashLog ? ["", "Last Rust crash:", crashLog] : []),
    ];
    return lines.join("\n");
  }

  async function handleCopyDiagnostics() {
    await withCopyFeedback(() => copyPlainText(buildDiagnosticsText()), "已复制诊断信息");
  }

  async function handleClearDiagnostics() {
    diagnostics.clear();
    crashLog = null;
    if (isTauri()) {
      try { await clearCrashLog(); } catch (error) { diagnostics.push("app", `清理崩溃日志失败：${String(error)}`); }
    }
  }

  function dirtyDocumentIds() {
    return Object.entries(get(editor).byId)
      .filter(([, draft]) => draft.dirty)
      .map(([id]) => id);
  }

  async function runDocumentCloseGuard(): Promise<boolean> {
    let dirtyIds = dirtyDocumentIds();

    if (dirtyIds.length > 0 && get(settings).autoSave) {
      for (const id of dirtyIds) await saveDraftById(id, true);
      dirtyIds = dirtyDocumentIds();
    }

    if (dirtyIds.length === 0) return true;
    return window.confirm(`还有 ${dirtyIds.length} 个文档未保存。确定退出并丢弃这些更改吗？`);
  }

  async function persistSessionBeforeExit() {
    // Preferences/session state must never block a user-confirmed close. Document contents are
    // protected separately by runDocumentCloseGuard().
    const [workspaceResult, settingsResult] = await Promise.allSettled([
      saveWorkspace(toWorkspaceSnapshot(get(workspace))),
      saveSettings(get(settings)),
    ]);
    if (workspaceResult.status === "rejected") diagnostics.push("app", `退出前保存工作区失败：${String(workspaceResult.reason)}`);
    if (settingsResult.status === "rejected") diagnostics.push("app", `退出前保存设置失败：${String(settingsResult.reason)}`);
  }

  async function handleApplicationExitRequested() {
    if (quitInProgress || !isTauri()) return;
    quitInProgress = true;

    try {
      const allowed = await runDocumentCloseGuard();
      if (!allowed) {
        await cancelApplicationExit();
        quitInProgress = false;
        return;
      }

      await persistSessionBeforeExit();
      await confirmApplicationExit();
    } catch (error) {
      try { await cancelApplicationExit(); } catch { /* best effort */ }
      quitInProgress = false;
      workspace.setError(`退出应用失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function requestApplicationQuit() {
    if (!isTauri()) return;
    try {
      // Ask the native application lifecycle to quit. RunEvent::ExitRequested is the single
      // app-level gate, so menu Quit, Cmd+Q and command-palette Quit share one path.
      await requestApplicationExit();
    } catch (error) {
      workspace.setError(`请求退出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function restoreWorkspace(snapshot: WorkspaceSnapshot) {
    workspace.setSidebarOpen(snapshot.sidebarOpen);
    workspace.setRecentFiles(snapshot.recentFiles ?? []);
    workspace.setRecentProjects(snapshot.recentProjects ?? []);
    if (snapshot.projectRoot) await loadProject(snapshot.projectRoot, false, false);

    for (const tab of snapshot.openTabs ?? []) {
      const document = await loadPath(tab.path, false, false, false);
      if (document) workspace.setScrollTop(document.id, tab.scrollTop ?? 0);
    }

    if (snapshot.activePath) workspace.setActiveByPath(snapshot.activePath);
  }

  $: commands = [
    ...createAppCommands({
    hasDocument: Boolean(active),
    hasLocalDocument: Boolean(active && active.id !== "sample"),
    canEdit: Boolean(active?.editable),
    hasMultipleTabs: $workspace.documents.length > 1,
    updaterConfigured: Boolean(buildInfo?.updaterConfigured),
    dirty: Boolean(activeDraft?.dirty),
    canSearch: (activeDraft?.mode ?? "read") === "read",
    openFile: handleOpen,
    openWorkspace: handleOpenWorkspace,
    openWorkspaceSearch: handleWorkspaceSearchOpen,
    hasWorkspace: Boolean($workspace.project),
    openSearch: search.open,
    saveActive: handleSave,
    openCommandPalette,
    toggleSidebar: workspace.toggleSidebar,
    toggleTheme: handleTheme,
    closeActive: () => active ? handleClose(active.id) : undefined,
    nextTab: () => workspace.cycleActive(1),
    previousTab: () => workspace.cycleActive(-1),
    openSettings,
    openPlugins,
    revealActive: handleReveal,
    exportHtml: handleExportHtml,
    printPdf: handleExportPdf,
    copyDocumentText: handleCopyDocumentText,
    copyDocumentRich: handleCopyDocumentRich,
    copyDocumentHtml: handleCopyDocumentHtml,
    copyDocumentPath: handleCopyDocumentPath,
    checkUpdates: () => handleCheckUpdates(true),
    openAbout,
    openDiagnostics,
    quitApp: requestApplicationQuit,
    }),
    ...pluginPanels.map((panel): AppCommand => ({
      id: `plugin-panel.${panel.id}`,
      title: `打开面板：${panel.title}`,
      subtitle: panel.pluginName,
      group: "插件",
      keywords: [panel.pluginName, panel.title, "plugin", "panel", "插件", "面板"],
      run: () => pluginManager.openPanel(panel.id),
    })),
    ...$pluginState.commands.map((command): AppCommand => ({
      id: `plugin.${command.id}`,
      title: command.title,
      subtitle: command.description ? `${command.pluginName} · ${command.description}` : command.pluginName,
      group: "插件",
      keywords: [command.pluginName, "plugin", "插件", ...command.keywords],
      shortcut: $pluginState.shortcutConflicts.some((conflict) => conflict.commandId === command.id) ? undefined : command.shortcut,
      run: () => pluginManager.runCommand(command.id),
    })),
  ];

  $: {
    const nextWindowTitle = active ? `${activeDraft?.dirty ? "● " : ""}${active.fileName} — oneView` : "oneView";
    if (isTauri() && nextWindowTitle !== lastWindowTitle) {
      lastWindowTitle = nextWindowTitle;
      void setMainWindowTitle(nextWindowTitle).catch((error) => diagnostics.push("app", `设置窗口标题失败：${String(error)}`));
    }
  }

  $: pluginToolbarItems = $pluginState.contributions
    .filter((item) => item.placement === "toolbar" && isPluginContributionVisible(item, {
      hasDocument: Boolean(active),
      editable: Boolean(active?.editable),
    }))
    .slice(0, 3);

  $: pluginStatusItems = $pluginState.contributions
    .filter((item) => item.placement === "statusbar" && isPluginContributionVisible(item, {
      hasDocument: Boolean(active),
      editable: Boolean(active?.editable),
    }))
    .slice(0, 6);

  $: pluginPanels = $pluginState.panels.filter((item) => isPluginContributionVisible(item, {
    hasDocument: Boolean(active),
    editable: Boolean(active?.editable),
    hasSelection: pluginHasSelection,
    hasLink: false,
  }));

  $: activePluginPanel = pluginPanels.find((item) => item.id === $pluginState.activePanelId) ?? null;

  $: contextMenuItems = buildContextMenuItems(contextMenuRequest);

  function buildContextMenuItems(request: ViewerContextMenuRequest | null): ContextMenuItem[] {
    if (!request) return [];
    const items: ContextMenuItem[] = [];
    if (request.selectionText) {
      const cleaned = cleanHtmlFragment(request.selectionHtml);
      const findText = request.selectionText.replace(/\s+/g, " ").trim().slice(0, 160);
      items.push(
        { id: "selection.copy-text", label: "复制", hint: "Ctrl/Cmd+C", run: () => withCopyFeedback(() => copyPlainText(request.selectionText), "已复制选中文字") },
        { id: "selection.copy-rich", label: "复制为富文本", run: () => withCopyFeedback(() => copyRichHtml(cleaned.html, cleaned.text), "已复制选中富文本") },
        { id: "selection.copy-html", label: "复制 HTML", run: () => withCopyFeedback(() => copyHtmlSource(cleaned.html), "已复制选中 HTML") },
        { id: "selection.find", label: `查找“${shortLabel(findText)}”`, separatorBefore: true, run: () => { search.setQuery(findText); search.open(); } },
      );
    }

    if (request.link?.href) {
      const link = request.link;
      const externalAllowed = /^(https?:|mailto:|tel:)/i.test(link.href) || link.href.startsWith("//");
      const anchorAllowed = link.href.startsWith("#");
      items.push({
        id: "link.open",
        label: link.localMarkdown ? "在标签页中打开链接" : "打开链接",
        separatorBefore: items.length > 0,
        disabled: link.localMarkdown ? !link.localExists || !link.localPath : !(externalAllowed || anchorAllowed),
        run: async () => {
          if (link.localMarkdown && link.localPath) await handleDocumentLink(link.localPath, link.localFragment);
          else if (anchorAllowed) jumpTo(decodeURIComponent(link.href.slice(1)));
          else if (externalAllowed) await openExternalUrl(link.href.startsWith("//") ? `https:${link.href}` : link.href);
        },
      });
      items.push({ id: "link.copy", label: "复制链接地址", run: () => withCopyFeedback(() => copyPlainText(link.href), "已复制链接地址") });
    }

    const pluginContextItems = $pluginState.contributions.filter((item) =>
      item.placement === "context-menu" && isPluginContributionVisible(item, {
        hasDocument: Boolean(active),
        editable: Boolean(active?.editable),
        hasSelection: Boolean(request.selectionText),
        hasLink: Boolean(request.link?.href),
      }),
    );
    for (const [index, contribution] of pluginContextItems.entries()) {
      items.push({
        id: `plugin-contribution.${contribution.id}`,
        label: contribution.label,
        hint: contribution.pluginName,
        separatorBefore: index === 0 && items.length > 0,
        run: () => pluginManager.runContribution(contribution.id),
      });
    }

    items.push(
      { id: "document.copy-rich", label: "复制全文为富文本", separatorBefore: items.length > 0, run: handleCopyDocumentRich },
      { id: "document.copy-html", label: "复制全文 HTML", run: handleCopyDocumentHtml },
    );
    return items;
  }

  function shortLabel(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 18 ? `${normalized.slice(0, 18)}…` : normalized;
  }

  function runCommandById(id: string) {
    const command = commands.find((item) => item.id === id);
    if (!command || command.enabled === false) return;
    const now = performance.now();
    const previous = lastCommandAt.get(id) ?? -Infinity;
    if (now - previous < 80) return;
    lastCommandAt.set(id, now);
    void command.run();
  }

  function runShortcut(event: KeyboardEvent, availableCommands: AppCommand[]) {
    const command = availableCommands.find((item) => item.enabled !== false && commandMatchesKeyboard(item, event));
    if (!command) return false;
    event.preventDefault();
    void command.run();
    return true;
  }

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const state = get(workspace);
      const primary = event.metaKey || event.ctrlKey;

      if ((primary && event.key.toLowerCase() === "k") || (primary && event.shiftKey && event.key.toLowerCase() === "p")) {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (event.key === "Escape" && contextMenuRequest) {
        event.preventDefault();
        contextMenuRequest = null;
        return;
      }
      if (event.defaultPrevented) return;
      if (commandPaletteOpen) return;
      if (runShortcut(event, commands)) return;

      if (primary && /^[1-9]$/.test(event.key) && state.documents.length > 0) {
        event.preventDefault();
        const requested = Number(event.key) - 1;
        const index = requested === 8 ? state.documents.length - 1 : requested;
        workspace.setActiveAt(index);
      }
    };
    const handleWindowError = (event: ErrorEvent) => diagnostics.push("window", event.error ?? event.message);
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => diagnostics.push("promise", event.reason);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    const unsubscribeThemeSync = settings.subscribe((value) => {
      theme.set(value.appTheme);
      if (value.autoSave) {
        for (const [id, draft] of Object.entries(get(editor).byId)) if (draft.dirty) scheduleAutoSave(id);
      } else {
        for (const id of [...autoSaveTimers.keys()]) cancelAutoSave(id);
      }
    });
    pluginHasSelection = !(editorSession.getSelection()?.empty ?? true);
    const unsubscribeEditorPanelSelection = editorSession.subscribe((event) => {
      if (event.type === "selectionChanged") pluginHasSelection = !event.selection.empty;
      else if (event.type === "detached") pluginHasSelection = false;
    });

    if (!isTauri()) {
      appReady = true;
      return () => {
        unsubscribeThemeSync();
        unsubscribeEditorPanelSelection();
        window.removeEventListener("keydown", handleKeydown);
        window.removeEventListener("error", handleWindowError);
        window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      };
    }

    const unlisteners: Array<() => void> = [];
    let disposed = false;
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeWorkspace: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;
    let settingsPersistTimer: ReturnType<typeof setTimeout> | null = null;
    let persistenceFailed = false;
    let settingsPersistenceFailed = false;

    void (async () => {
      // Register the app-level exit guard before restoring files. Once ready, native Quit requests
      // can be safely held while the frontend checks/saves dirty documents.
      try {
        const unlistenAppExit = await listenForApplicationExitRequested(() => {
          void handleApplicationExitRequested();
        });
        if (disposed) {
          unlistenAppExit();
        } else {
          unlisteners.push(unlistenAppExit);
          await setApplicationExitGuardReady(true);
        }
      } catch (error) {
        diagnostics.push("app", `初始化退出保护失败：${String(error)}`);
      }

      try {
        buildInfo = await getBuildInfo();
      } catch (error) {
        diagnostics.push("app", `读取构建信息失败：${String(error)}`);
      }

      try {
        const savedSettings = await loadSettings();
        if (!disposed && savedSettings) settings.set(savedSettings);
      } catch (error) {
        workspace.setError(`读取设置失败：${error instanceof Error ? error.message : String(error)}`);
      }

      if (!disposed && buildInfo?.updaterConfigured && !buildInfo.debug && get(settings).autoCheckUpdates) {
        window.setTimeout(() => { if (!disposed) void handleCheckUpdates(false); }, 1400);
      }

      unsubscribeSettings = settings.subscribe((value) => {
        if (disposed || settingsPersistenceFailed) return;
        if (settingsPersistTimer) clearTimeout(settingsPersistTimer);
      if (workspaceSearchTimer) clearTimeout(workspaceSearchTimer);
        settingsPersistTimer = setTimeout(() => {
          settingsPersistTimer = null;
          void saveSettings(value).catch((error) => {
            settingsPersistenceFailed = true;
            workspace.setError(`保存设置失败：${error instanceof Error ? error.message : String(error)}`);
          });
        }, 180);
      });

      const unlistenNativeCommands = await listenForNativeCommands((commandId) => runCommandById(commandId));
      if (disposed) unlistenNativeCommands();
      else unlisteners.push(unlistenNativeCommands);

      try {
        if (!disposed) {
          await pluginManager.initialize();
          stopPluginEvents?.();
          stopPluginEvents = startPluginEventBridge(pluginManager);
        }
      } catch (error) {
        diagnostics.push("plugins", `初始化插件系统失败：${String(error)}`);
      }

      // Native open requests can arrive before the webview is ready (macOS cold start)
      // or while the app is already running (Finder / single-instance). Rust always queues
      // first; these events are wake-up signals only. Do not consume the queue until the
      // persisted workspace has finished restoring, otherwise startup work can race it.
      const externalOpenCoordinator = new ExternalOpenCoordinator({
        takeFiles: takeStartupFiles,
        takeActions: takeStartupActions,
        openFiles: (paths) => openPaths(paths, true),
        handleActions: handleSystemActions,
        reportError: (message) => diagnostics.push("open", message),
      });
      unlisteners.push(() => externalOpenCoordinator.dispose());

      const unlistenOpenFiles = await listenForOpenFiles(() => externalOpenCoordinator.notify());
      if (disposed) unlistenOpenFiles();
      else unlisteners.push(unlistenOpenFiles);

      const unlistenSystemActions = await listenForSystemActions(() => externalOpenCoordinator.notify());
      if (disposed) unlistenSystemActions();
      else unlisteners.push(unlistenSystemActions);

      try {
        const snapshot = await loadWorkspace();
        if (!disposed) await restoreWorkspace(snapshot);
      } catch (error) {
        workspace.setError(error instanceof Error ? error.message : String(error));
      }

      try {
        if (!disposed) await externalOpenCoordinator.markReadyAndDrain();
      } catch (error) {
        diagnostics.push("open", `恢复启动文件失败：${error instanceof Error ? error.message : String(error)}`);
      }

      // Do not reveal the Svelte tree until settings/theme, plugins, workspace and
      // queued native-open requests have settled. Otherwise the cold-start path
      // briefly paints Home and then replaces it with the requested document.
      if (!disposed) {
        await tick();
        appReady = true;
      }

      const unlistenChanges = await listenForDocumentChanges((event) => {
        void handleFileChange(event);
      });
      if (disposed) unlistenChanges();
      else unlisteners.push(unlistenChanges);

      const unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths;
        const currentActive = get(workspace).documents.find((item) => item.id === get(workspace).activeId);
        const currentDraft = currentActive ? get(editor).byId[currentActive.id] : null;
        const images = paths.filter((path) => /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path));
        if (currentActive && currentDraft?.mode === "wysiwyg" && images.length > 0) {
          window.dispatchEvent(new CustomEvent("markdown-editor:insert-images", { detail: { paths: images } }));
          const documents = paths.filter(isSupportedDocumentPath);
          if (documents.length) void openPaths(documents, true);
          return;
        }
        const supported = paths.filter(isSupportedDocumentPath);
        if (supported.length > 0) {
          void openPaths(supported, true);
        } else if (paths.length === 1) {
          void loadProject(paths[0], true, false);
        }
      });
      if (disposed) unlistenDrop();
      else unlisteners.push(unlistenDrop);

      unsubscribeWorkspace = workspace.subscribe((state) => {
        if (disposed || persistenceFailed) return;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          persistTimer = null;
          void saveWorkspace(toWorkspaceSnapshot(state)).catch((error) => {
            persistenceFailed = true;
            workspace.setError(`保存工作区失败：${error instanceof Error ? error.message : String(error)}`);
          });
        }, 220);
      });
    })()
      .catch((error) => {
        diagnostics.push("startup", `应用初始化失败：${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        // The render gate must never strand the native window blank if a non-critical
        // startup integration fails. Critical state restoration above still gets the
        // first opportunity to settle before this fallback reveal.
        if (!disposed) appReady = true;
      });

    return () => {
      disposed = true;
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (persistTimer) clearTimeout(persistTimer);
      if (settingsPersistTimer) clearTimeout(settingsPersistTimer);
      if (workspaceSearchTimer) clearTimeout(workspaceSearchTimer);
      if (defaultAppPromptTimer) clearTimeout(defaultAppPromptTimer);
      for (const id of [...autoSaveTimers.keys()]) cancelAutoSave(id);
      unsubscribeThemeSync();
      unsubscribeEditorPanelSelection();
      unsubscribeWorkspace?.();
      unsubscribeSettings?.();
      if (isTauri()) void setApplicationExitGuardReady(false).catch(() => undefined);
      unlisteners.forEach((unlisten) => unlisten());
      stopPluginEvents?.();
      stopPluginEvents = null;
      void pluginManager.destroy();
      void saveWorkspace(toWorkspaceSnapshot(get(workspace)));
      void saveSettings(get(settings));
    };
  });
</script>

<div class="app-shell flex h-screen w-screen flex-col overflow-hidden text-zinc-900 selection:bg-zinc-900 selection:text-white dark:text-zinc-100 dark:selection:bg-zinc-100 dark:selection:text-zinc-900" class:app-booting={!appReady} aria-busy={!appReady}>
  <TopBar
    mode={!active && !$workspace.project ? "home" : "document"}
    documents={$workspace.documents}
    pluginItems={pluginToolbarItems}
    onRunPluginItem={(id) => void pluginManager.runContribution(id)}
    activeId={$workspace.activeId}
    dirtyById={Object.fromEntries(Object.entries($editor.byId).map(([id, draft]) => [id, draft.dirty]))}
    sidebarOpen={$workspace.sidebarOpen}
    recentFiles={$workspace.recentFiles}
    onToggleSidebar={() => runCommandById("view.sidebar")}
    onSelectTab={workspace.setActive}
    onCloseTab={handleClose}
    onOpen={() => runCommandById("file.open")}
    onOpenWorkspace={() => runCommandById("workspace.open")}
    onOpenRecent={handleRecent}
    onClearRecent={workspace.clearRecentFiles}
    onSearch={() => runCommandById("view.search")}
    canReveal={Boolean(active && active.id !== "sample")}
    canEdit={Boolean(active?.editable)}
    canSearch={(activeDraft?.mode ?? "read") === "read"}
    dirty={activeDraft?.dirty ?? false}
    onSave={() => runCommandById("file.save")}
    onReveal={() => runCommandById("file.reveal")}
    onToggleTheme={() => runCommandById("view.toggle-theme")}
    onOpenCommands={() => runCommandById("view.command-palette")}
    onOpenSettings={() => runCommandById("settings.open")}
    onOpenPlugins={() => runCommandById("plugins.open")}
    onExportHtml={() => runCommandById("export.html")}
    onExportPdf={() => runCommandById("export.pdf")}
  />

  {#if $workspace.error}
    <div class="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      <span>{$workspace.error}</span>
      <button class="px-2" on:click={() => workspace.setError(null)}>×</button>
    </div>
  {/if}

  <DefaultAppPrompt
    open={defaultAppPromptOpen}
    onSetDefault={handleSetDefaultMarkdown}
    onLater={() => dismissDefaultAppPrompt(30)}
    onOpenSettings={() => { defaultAppPromptOpen = false; openSettings(); }}
  />

  <main class="app-main relative flex min-h-0 flex-1">
    {#if $workspace.loading}
      <div class="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <div class="loading-bar h-full w-1/3 bg-zinc-900 dark:bg-zinc-100"></div>
      </div>
    {/if}

    {#if $workspace.sidebarOpen && $workspace.project}
      <WorkspacePanel
        project={$workspace.project}
        mode={$workspace.sidebarMode}
        activePath={active?.path ?? null}
        outline={active ? (activeDraft?.outline ?? active.outline) : []}
        activeHeadingId={active ? ($workspace.activeHeadingById[active.id] ?? null) : null}
        searchQuery={workspaceSearchQuery}
        searchResults={workspaceSearchResults}
        searchLoading={workspaceSearchLoading}
        searchMeta={workspaceSearchMeta}
        onModeChange={workspace.setSidebarMode}
        onOpenFile={(path) => void loadPath(path, true)}
        onSearchChange={handleWorkspaceSearchChange}
        onOpenSearchResult={(result) => void handleWorkspaceSearchResult(result)}
        onJump={jumpTo}
        onRefresh={() => void handleRefreshWorkspace()}
        onCloseProject={handleCloseWorkspace}
      />
    {/if}

    {#if active}
      {#if $search.open}
        <SearchBar />
      {/if}
      {#if $workspace.sidebarOpen && !$workspace.project}
        <OutlinePanel items={activeDraft?.outline ?? active.outline} documentId={active.id} activeId={$workspace.activeHeadingById[active.id] ?? null} onJump={jumpTo} />
      {/if}
    {/if}

    <!-- Keep one physical content stage mounted across Home / tabs / editor modes.
         Replacing the stage itself exposes the WebView backing surface for a frame. -->
    <section
      class="app-content-stage min-w-0 flex-1"
      class:home-content-stage={!active}
    >
      {#if active}
        {#key `${active.id}:${activeDraft?.mode ?? "read"}`}
          {#if activeDraft?.mode === "wysiwyg"}
            <WysiwygEditor
              source={activeDraft.source}
              documentId={active.id}
              documentPath={active.path}
              initialScrollTop={$workspace.scrollTopById[active.id] ?? 0}
              onViewportChange={(viewport) => handleViewportChange(active.id, viewport)}
              onChange={(source, outline) => handleEditorChange(active.id, source, outline)}
              onSave={handleSave}
              onError={(message) => workspace.setError(message)}
              onContextMenu={(request) => contextMenuRequest = request}
            />
          {:else}
            {#if activeDraft?.dirty}
              <div class="absolute right-4 top-3 z-10 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 shadow-sm dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                兼容预览显示磁盘版本 · 未保存草稿仍保留
              </div>
            {/if}
            <MarkdownView
              document={active}
              initialScrollTop={$workspace.scrollTopById[active.id] ?? 0}
              onViewportChange={(viewport) => handleViewportChange(active.id, viewport)}
              onOpenDocument={handleDocumentLink}
              onContextMenu={(request) => contextMenuRequest = request}
            />
          {/if}
        {/key}
      {:else if appReady}
        <EmptyState
          recentFiles={$workspace.recentFiles}
          recentProjects={$workspace.recentProjects}
          onOpen={handleOpen}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenRecent={handleRecent}
          onOpenRecentProject={(path) => void loadProject(path, true)}
          onOpenCommands={() => runCommandById("view.command-palette")}
          onOpenPlugins={() => runCommandById("plugins.open")}
          onOpenSettings={() => runCommandById("settings.open")}
        />
      {/if}
    </section>
  </main>

  {#if active}
    <StatusBar
      pluginItems={pluginStatusItems}
      onRunPluginItem={(id) => void pluginManager.runContribution(id)}
      lineCount={activeDraft?.lineCount ?? active.lineCount}
      sizeBytes={activeDraft?.sizeBytes ?? active.sizeBytes}
      format={active.format}
      encoding={active.encoding}
      readingProgress={$workspace.readingProgressById[active.id] ?? 0}
      largeDocument={isLargeDocument(active.lineCount, active.sizeBytes)}
      wordCount={activeDraft?.wordCount ?? active.wordCount}
      characterCount={activeDraft?.characterCount ?? active.characterCount}
      estimatedReadMinutes={Math.max(0, Math.ceil((activeDraft?.wordCount ?? active.wordCount) / 350))}
      editorMode={activeDraft?.mode ?? "read"}
      editable={active.editable}
      dirty={activeDraft?.dirty ?? false}
      saving={activeDraft?.saving ?? false}
      autoSave={$settings.autoSave}
      compatibilityLevel={compatibilityPreview?.level ?? active.compatibility.level}
      onOpenCompatibility={() => compatibilityOpen = true}
    />
  {/if}
  <PluginPanelDrawer
    manager={pluginManager}
    panels={pluginPanels}
    panel={activePluginPanel}
    theme={$resolvedTheme}
    onSelect={(id) => pluginManager.openPanel(id)}
    onClose={() => pluginManager.closePanel()}
  />
  <SettingsPanel open={settingsOpen} onClose={() => settingsOpen = false} pluginManager={pluginManager} />
  <PluginCenterPanel open={pluginsOpen} manager={pluginManager} onClose={() => pluginsOpen = false} />
  <CommandPalette open={commandPaletteOpen} {commands} onClose={() => commandPaletteOpen = false} />
  <ContextMenu open={Boolean(contextMenuRequest)} x={contextMenuRequest?.x ?? 0} y={contextMenuRequest?.y ?? 0} items={contextMenuItems} onClose={() => contextMenuRequest = null} />
  <AboutPanel
    open={aboutOpen}
    {buildInfo}
    {updateStatus}
    update={availableUpdate}
    {updateProgress}
    {updateError}
    onClose={() => aboutOpen = false}
    onCheckUpdates={() => handleCheckUpdates(true)}
    onInstallUpdate={handleInstallUpdate}
    onOpenDiagnostics={openDiagnostics}
  />
  <CompatibilityPanel
    open={compatibilityOpen}
    report={compatibilityPreview ?? active?.compatibility ?? null}
    fileName={active?.fileName ?? ""}
    onClose={() => compatibilityOpen = false}
  />
  <DiagnosticsPanel
    open={diagnosticsOpen}
    {buildInfo}
    {active}
    tabCount={$workspace.documents.length}
    settings={$settings}
    themeFamily={$pluginState.selectedThemeFamily}
    entries={$diagnostics}
    {crashLog}
    onClose={() => diagnosticsOpen = false}
    onCopy={handleCopyDiagnostics}
    onClear={handleClearDiagnostics}
  />
  <NoticeToast />
</div>

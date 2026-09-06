<script lang="ts">
  import { afterUpdate } from "svelte";
  import type { RecentFile, RenderedDocument } from "../../lib/contracts";
  import Icon from "../ui/Icon.svelte";
  import MoreMenu from "./MoreMenu.svelte";
  import { isTauri } from "../../lib/runtime";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import type { PluginUiContribution } from "../../features/plugins/domain/plugin";
  import { tabMotion } from "../../lib/motion";

  export let mode: "home" | "document" = "document";
  export let documents: RenderedDocument[] = [];
  export let activeId: string | null = null;
  export let dirtyById: Record<string, boolean> = {};
  export let pluginItems: PluginUiContribution[] = [];
  export let onRunPluginItem: (id: string) => void = () => {};
  export let sidebarOpen = true;
  export let recentFiles: RecentFile[] = [];
  export let canReveal = false;
  export let canEdit = false;
  export let canSearch = false;
  export let dirty = false;
  export let onToggleSidebar: () => void;
  export let onSelectTab: (id: string) => void;
  export let onCloseTab: (id: string) => void;
  export let onOpen: () => void;
  export let onOpenWorkspace: () => void;
  export let onOpenRecent: (path: string) => void;
  export let onClearRecent: () => void;
  export let onSearch: () => void;
  export let onReveal: () => void;
  export let onToggleTheme: () => void;
  export let onOpenCommands: () => void;
  export let onOpenSettings: () => void;
  export let onOpenPlugins: () => void;
  export let onExportHtml: () => void;
  export let onExportPdf: () => void;
  export let onSave: () => void;

  let tabsHost: HTMLDivElement;
  let lastActiveId: string | null = null;
  const isMac = isTauri() && typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  afterUpdate(() => {
    if (!tabsHost || !activeId || lastActiveId === activeId) return;
    lastActiveId = activeId;
    tabsHost.querySelector<HTMLElement>("[data-title-tab-active='true']")?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  });

  function isInteractiveTitlebarTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(
      "button, a, input, textarea, select, [role='button'], [role='menu'], [data-no-window-drag]"
    ));
  }

  async function handleTitlebarMouseDown(event: MouseEvent) {
    if (!isMac || event.button !== 0 || isInteractiveTitlebarTarget(event.target)) return;
    event.preventDefault();
    try {
      const window = getCurrentWindow();
      if (event.detail === 2) {
        await window.toggleMaximize();
      } else {
        await window.startDragging();
      }
    } catch (error) {
      console.warn("[titlebar] start dragging failed", error);
    }
  }
</script>

<header class:mac-titlebar={isMac} class:home-titlebar={mode === "home"} class="app-topbar title-tabs-bar" on:mousedown={handleTitlebarMouseDown}>
  {#if mode === "document"}
    <div class="titlebar-leading">
      <button
        class="titlebar-icon-btn titlebar-sidebar-toggle"
        aria-label="切换侧栏"
        aria-pressed={sidebarOpen}
        data-tooltip="切换侧栏 · ⌘B"
        on:click={onToggleSidebar}
      >
        <Icon name="sidebar" size={24} />
      </button>
    </div>

    <div bind:this={tabsHost} class="title-tabs-scroll" aria-label="打开的文档标签">
      <div class="title-tabs-strip">
        {#each documents as doc, index (doc.id)}
          <button
            class="title-document-tab"
            class:active-title-tab={doc.id === activeId}
            data-title-tab-active={doc.id === activeId ? "true" : undefined}
            title={`${doc.fileName} · ⌘${index < 8 ? index + 1 : 9}`}
            on:click={() => onSelectTab(doc.id)}
            on:auxclick={(event) => { if (event.button === 1) { event.preventDefault(); onCloseTab(doc.id); } }}
            transition:tabMotion
          >
            <span class="title-document-icon"><Icon name="document" size={13} /></span>
            <span class="title-document-name">{doc.fileName}</span>
            {#if dirtyById[doc.id]}<span class="dirty-dot" title="未保存"></span>{/if}
            <span
              class="title-tab-close"
              role="button"
              tabindex="0"
              aria-label={`关闭 ${doc.fileName}`}
              on:click={(event) => { event.stopPropagation(); onCloseTab(doc.id); }}
              on:keydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseTab(doc.id);
                }
              }}
            ><Icon name="close" size={11} /></span>
          </button>
        {/each}
      </div>
    </div>

    <button class="titlebar-icon-btn titlebar-new-tab" aria-label="打开新文件" data-tooltip="打开文件 · ⌘O" on:click={onOpen}>
      <Icon name="plus" size={16} />
    </button>
  {/if}

  <div class="titlebar-drag-space" aria-hidden="true"></div>

  <div class="titlebar-actions">
    {#if mode === "document"}
      {#each pluginItems as item (item.id)}
        <button
          class="titlebar-icon-btn plugin-toolbar-action"
          aria-label={item.label}
          data-tooltip={item.tooltip ? `${item.label} · ${item.tooltip}` : `${item.label} · ${item.pluginName}`}
          on:click={() => onRunPluginItem(item.id)}
        >
          <Icon name={item.icon ?? "code"} size={15} />
        </button>
      {/each}
      {#if canSearch}
        <button
          class="titlebar-icon-btn"
          aria-label="查找"
          data-tooltip="查找 · ⌘F"
          on:click={onSearch}
        >
          <Icon name="search" size={15} />
        </button>
      {/if}
    {/if}
    <span class="titlebar-action-divider" aria-hidden="true"></span>
    <button class="titlebar-icon-btn" aria-label="命令面板" data-tooltip="命令面板 · ⌘K" on:click={onOpenCommands}>
      <Icon name="command" size={15} />
    </button>
    <button class="titlebar-icon-btn" aria-label="插件中心" data-tooltip="插件中心" on:click={onOpenPlugins}>
      <Icon name="plugin" size={15} />
    </button>
    <MoreMenu
      {mode}
      {recentFiles}
      {canReveal}
      {canEdit}
      {dirty}
      {onOpen}
      {onOpenWorkspace}
      {onOpenRecent}
      {onClearRecent}
      {onReveal}
      {onOpenCommands}
      {onOpenSettings}
      {onOpenPlugins}
      {onToggleTheme}
      {onExportHtml}
      {onExportPdf}
      {onSave}
    />
  </div>
</header>

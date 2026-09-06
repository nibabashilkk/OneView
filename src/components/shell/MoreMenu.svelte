<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { RecentFile } from "../../lib/contracts";
  import Icon from "../ui/Icon.svelte";
  import { popoverMotion } from "../../lib/motion";

  export let mode: "home" | "document" = "document";
  export let recentFiles: RecentFile[] = [];
  export let canReveal = false;
  export let canEdit = false;
  export let dirty = false;
  export let onOpen: () => void | Promise<void>;
  export let onOpenWorkspace: () => void | Promise<void>;
  export let onOpenRecent: (path: string) => void | Promise<void>;
  export let onClearRecent: () => void | Promise<void>;
  export let onReveal: () => void | Promise<void>;
  export let onOpenCommands: () => void | Promise<void>;
  export let onOpenSettings: () => void | Promise<void>;
  export let onOpenPlugins: () => void | Promise<void>;
  export let onToggleTheme: () => void | Promise<void>;
  export let onExportHtml: () => void | Promise<void>;
  export let onExportPdf: () => void | Promise<void>;
  export let onSave: () => void | Promise<void>;

  let host: HTMLDivElement;
  let open = false;

  function toggle() {
    open = !open;
  }

  async function invoke(action: () => void | Promise<void>) {
    open = false;
    await tick();
    await action();
  }

  async function openRecent(path: string) {
    open = false;
    await tick();
    await onOpenRecent(path);
  }

  function handlePointerDown(event: PointerEvent) {
    if (!open || host?.contains(event.target as Node)) return;
    open = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) open = false;
  }

  function closeOnWindowBlur() {
    if (open) open = false;
  }

  onMount(() => {
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", closeOnWindowBlur);
  });

  onDestroy(() => {
    document.removeEventListener("pointerdown", handlePointerDown, true);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("blur", closeOnWindowBlur);
  });
</script>

<div class="titlebar-more relative" bind:this={host}>
  <button
    class="titlebar-icon-btn"
    aria-label="更多"
    aria-expanded={open}
    data-tooltip="更多"
    on:click={toggle}
  >
    <Icon name="more" size={16} />
  </button>

  {#if open}
    <div class="titlebar-more-popover chrome-popover absolute right-0 top-[34px] z-[80] w-64 p-1.5" role="menu" aria-label="更多操作" transition:popoverMotion>
      {#if mode === "document"}
        {#if canEdit && dirty}
          <button class="compact-menu-item" on:click={() => invoke(onSave)}>
            <Icon name="save" size={14} /><span>保存</span><kbd>⌘S</kbd>
          </button>
          <div class="compact-menu-separator"></div>
        {/if}

        <button class="compact-menu-item" on:click={() => invoke(onOpen)}>
          <Icon name="file" size={14} /><span>打开文件</span><kbd>⌘O</kbd>
        </button>
        <button class="compact-menu-item" on:click={() => invoke(onOpenWorkspace)}>
          <Icon name="folder" size={14} /><span>打开文件夹</span><kbd>⇧⌘O</kbd>
        </button>
        <button class="compact-menu-item" on:click={() => invoke(onOpenCommands)}>
          <Icon name="command" size={14} /><span>命令面板</span><kbd>⌘K</kbd>
        </button>
        {#if canReveal}
          <button class="compact-menu-item" on:click={() => invoke(onReveal)}>
            <Icon name="reveal" size={14} /><span>在文件管理器中显示</span>
          </button>
        {/if}

        <div class="compact-menu-separator"></div>
        <button class="compact-menu-item" disabled={!canReveal} on:click={() => invoke(onExportHtml)}>
          <Icon name="export" size={14} /><span>导出 HTML</span>
        </button>
        <button class="compact-menu-item" disabled={!canReveal} on:click={() => invoke(onExportPdf)}>
          <Icon name="document" size={14} /><span>打印 / PDF</span>
        </button>

        {#if recentFiles.length > 0}
          <div class="compact-menu-separator"></div>
          <div class="compact-menu-heading">
            <span>最近打开</span>
            <button on:click={() => invoke(onClearRecent)}>清除</button>
          </div>
          {#each recentFiles.slice(0, 4) as item (item.path)}
            <button class="compact-menu-recent" title={item.path} on:click={() => openRecent(item.path)}>
              <Icon name="document" size={13} />
              <span>{item.fileName}</span>
            </button>
          {/each}
        {/if}

        <div class="compact-menu-separator"></div>
      {/if}
      <button class="compact-menu-item" on:click={() => invoke(onOpenPlugins)}>
        <Icon name="plugin" size={14} /><span>插件中心</span>
      </button>
      <button class="compact-menu-item" on:click={() => invoke(onOpenSettings)}>
        <Icon name="settings" size={14} /><span>设置</span>
      </button>
      <button class="compact-menu-item" on:click={() => invoke(onToggleTheme)}>
        <Icon name="theme" size={14} /><span>切换明暗主题</span>
      </button>
    </div>
  {/if}
</div>

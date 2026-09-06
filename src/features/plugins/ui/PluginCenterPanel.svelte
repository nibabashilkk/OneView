<script lang="ts">
  import type { PluginManager } from "../application/plugin-manager";
  import Icon from "../../../components/ui/Icon.svelte";
  import PluginSettingsSection from "./PluginSettingsSection.svelte";
  import { effectivePluginRuntimeKind } from "../domain/plugin";

  export let open = false;
  export let manager: PluginManager;
  export let onClose: () => void;

  type Filter = "all" | "document" | "theme" | "extension";
  const pluginState = manager.state;
  let filter: Filter = "all";
  let query = "";
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "全部" },
    { id: "document", label: "文档" },
    { id: "theme", label: "主题" },
    { id: "extension", label: "扩展" },
  ];

  function closeOnBackdrop(event: MouseEvent) { if (event.target === event.currentTarget) onClose(); }
  function handleKeyDown(event: KeyboardEvent) { if (open && event.key === "Escape") onClose(); }

  $: installedCount = $pluginState.plugins.length;
  $: enabledCount = $pluginState.plugins.filter((plugin) => plugin.enabled).length;

  function filterCount(id: Filter) {
    if (id === "all") return $pluginState.plugins.length;
    if (id === "document") return $pluginState.plugins.filter((plugin) => (plugin.manifest.contributes?.documentFormats?.length ?? 0) > 0).length;
    if (id === "theme") return $pluginState.plugins.filter((plugin) => (plugin.manifest.contributes?.themes?.length ?? 0) > 0).length;
    return $pluginState.plugins.filter((plugin) => effectivePluginRuntimeKind(plugin.manifest) === "extension").length;
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="plugin-center-backdrop modern-modal-backdrop persistent-modal-layer" class:is-open={open} role="presentation" aria-hidden={open ? undefined : "true"} inert={!open} on:click={closeOnBackdrop}>
  <div class="plugin-center-window" role="dialog" aria-modal={open ? "true" : undefined} aria-label="插件中心">
    <header class="plugin-center-header">
      <div class="plugin-center-title-group">
        <div class="plugin-center-icon"><Icon name="plugin" size={18} /></div>
        <div><h2>插件中心</h2><p>安装、启用和管理你的文档能力、主题与扩展</p></div>
      </div>
      <button class="modal-close-button" aria-label="关闭插件中心" on:click={onClose}><Icon name="close" size={15} /></button>
    </header>

    <div class="plugin-center-summary" aria-label="插件概览">
      <div><strong>{installedCount}</strong><span>已安装</span></div>
      <div><strong>{enabledCount}</strong><span>已启用</span></div>
      <div class:safe={$pluginState.safeMode}><strong>{$pluginState.safeMode ? "开启" : "关闭"}</strong><span>安全模式</span></div>
    </div>

    <div class="plugin-center-tools">
      <div class="plugin-center-search">
        <Icon name="search" size={14} />
        <input bind:value={query} placeholder="搜索插件、主题或格式…" aria-label="搜索插件" />
        {#if query}<button aria-label="清除搜索" on:click={() => query = ""}><Icon name="close" size={11} /></button>{/if}
      </div>
      <div class="plugin-center-tabs" aria-label="插件分类">
        {#each filters as item}
          <button class:active={filter === item.id} on:click={() => filter = item.id}><span>{item.label}</span><small>{filterCount(item.id)}</small></button>
        {/each}
      </div>
    </div>

    <div class="plugin-center-scroll">
      <PluginSettingsSection {manager} standalone={true} {filter} {query} />
    </div>
  </div>
</div>

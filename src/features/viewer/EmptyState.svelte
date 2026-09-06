<script lang="ts">
  import { primaryContentMotion } from "../../lib/motion";
  import type { RecentFile, RecentProject } from "../../lib/contracts";
  import Icon from "../../components/ui/Icon.svelte";
  import appIcon from "../../assets/oneview-icon.png";

  export let recentFiles: RecentFile[] = [];
  export let recentProjects: RecentProject[] = [];
  export let onOpen: () => void;
  export let onOpenWorkspace: () => void;
  export let onOpenRecent: (path: string) => void;
  export let onOpenRecentProject: (path: string) => void;
  export let onOpenCommands: () => void = () => {};
  export let onOpenPlugins: () => void = () => {};
  export let onOpenSettings: () => void = () => {};

  const fileBadge = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() ?? "DOC";
    return ext === "MARKDOWN" ? "MD" : ext.slice(0, 4);
  };
</script>

<div class="empty-state-shell" in:primaryContentMotion={{ y: 2, duration: 120 }}>
  <div class="empty-state-card empty-dashboard">
    <section class="empty-welcome-card">
      <div class="empty-welcome-copy">
        <div class="empty-brand-row">
          <div class="empty-logo"><img src={appIcon} alt="" aria-hidden="true" /></div>
          <div>
            <div class="empty-eyebrow">oneView</div>
            <div class="empty-brand-subtitle">轻量多格式文件查看器</div>
          </div>
        </div>
        <h1>从这里开始。</h1>
        <p>打开一个文件快速查看，或打开文件夹进入完整工作区。Markdown 可直接阅读和编辑，更多格式由插件按需扩展。</p>
      </div>

      <div class="empty-start-actions" aria-label="开始使用">
        <button class="empty-start-card primary" on:click={onOpenWorkspace}>
          <span class="empty-start-icon"><Icon name="folder" size={18} /></span>
          <span class="empty-start-copy"><strong>打开文件夹</strong><small>浏览、搜索和管理一组文档</small></span>
          <kbd>⇧⌘O</kbd>
        </button>
        <button class="empty-start-card" on:click={onOpen}>
          <span class="empty-start-icon"><Icon name="file" size={18} /></span>
          <span class="empty-start-copy"><strong>打开文件</strong><small>快速阅读或编辑单个文档</small></span>
          <kbd>⌘O</kbd>
        </button>
      </div>

      <div class="empty-utility-row" aria-label="快捷工具">
        <button on:click={onOpenCommands}><Icon name="command" size={14} /><span>命令面板</span><kbd>⌘K</kbd></button>
        <button on:click={onOpenPlugins}><Icon name="plugin" size={14} /><span>插件中心</span></button>
        <button on:click={onOpenSettings}><Icon name="settings" size={14} /><span>偏好设置</span></button>
      </div>
    </section>

    {#if recentProjects.length > 0 || recentFiles.length > 0}
      <section class="empty-recents-block">
        <div class="empty-recents-heading">
          <div>
            <strong>继续上次的工作</strong>
            <span>最近打开的内容会保留在这里</span>
          </div>
        </div>

        <div class="empty-recents-grid">
          {#if recentProjects.length > 0}
            <section class="recent-section">
              <div class="recent-section-title"><span>工作区</span><small>{recentProjects.length}</small></div>
              <div class="recent-list">
                {#each recentProjects.slice(0, 5) as item (item.path)}
                  <button class="empty-recent-item" title={item.path} on:click={() => onOpenRecentProject(item.path)}>
                    <span class="empty-recent-icon"><Icon name="folder" size={15} /></span>
                    <span class="min-w-0 flex-1"><strong>{item.name}</strong><small>{item.path}</small></span>
                    <span class="empty-recent-arrow">›</span>
                  </button>
                {/each}
              </div>
            </section>
          {/if}

          {#if recentFiles.length > 0}
            <section class="recent-section">
              <div class="recent-section-title"><span>文件</span><small>{recentFiles.length}</small></div>
              <div class="recent-list">
                {#each recentFiles.slice(0, 5) as item (item.path)}
                  <button class="empty-recent-item" title={item.path} on:click={() => onOpenRecent(item.path)}>
                    <span class="empty-file-badge">{fileBadge(item.fileName)}</span>
                    <span class="min-w-0 flex-1"><strong>{item.fileName}</strong><small>{item.path}</small></span>
                    <span class="empty-recent-arrow">›</span>
                  </button>
                {/each}
              </div>
            </section>
          {/if}
        </div>
      </section>
    {/if}
  </div>
</div>

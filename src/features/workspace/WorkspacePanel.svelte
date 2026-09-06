<script lang="ts">
  import { sidePanelMotion } from "../../lib/motion";
  import type { OutlineItem, WorkspaceEntry, WorkspaceProject, WorkspaceSearchResponse, WorkspaceSearchResult } from "../../lib/contracts";
  import type { SidebarMode } from "../../stores/workspace";
  import OutlinePanel from "../viewer/OutlinePanel.svelte";
  import Icon from "../../components/ui/Icon.svelte";

  export let project: WorkspaceProject;
  export let mode: SidebarMode = "project";
  export let activePath: string | null = null;
  export let outline: OutlineItem[] = [];
  export let activeHeadingId: string | null = null;
  export let searchQuery = "";
  export let searchResults: WorkspaceSearchResult[] = [];
  export let searchMeta: WorkspaceSearchResponse | null = null;
  export let searchLoading = false;
  export let onModeChange: (mode: SidebarMode) => void;
  export let onOpenFile: (path: string) => void;
  export let onSearchChange: (query: string) => void;
  export let onOpenSearchResult: (result: WorkspaceSearchResult) => void;
  export let onJump: (id: string) => void;
  export let onRefresh: () => void;
  export let onCloseProject: () => void;

  let treeQuery = "";
  let collapsedDirectories = new Set<string>();

  $: visibleEntries = filterTree(project.entries, treeQuery, collapsedDirectories);
  $: groupedSearchResults = groupSearchResults(searchResults);

  const fileGlyph = (format: string | null) => {
    if (format === "markdown") return "M";
    if (format === "json") return "{}";
    if (format === "yaml") return "Y";
    if (format === "csv") return "▦";
    if (format === "toml") return "T";
    if (format === "log") return "≡";
    if (format === "diff") return "±";
    return "·";
  };

  function toggleDirectory(path: string) {
    const next = new Set(collapsedDirectories);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsedDirectories = next;
  }

  function filterTree(entries: WorkspaceEntry[], query: string, collapsed: Set<string>): WorkspaceEntry[] {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return entries.filter((entry) => !hiddenByCollapsedAncestor(entry, collapsed));

    const matchingFiles = new Set<string>();
    const matchingDirectories = new Set<string>();
    for (const entry of entries) {
      const haystack = `${entry.name} ${entry.relativePath}`.toLocaleLowerCase();
      if (!haystack.includes(needle)) continue;
      if (entry.directory) matchingDirectories.add(entry.relativePath);
      else matchingFiles.add(entry.relativePath);
    }

    const requiredDirectories = new Set<string>();
    for (const path of matchingFiles) addAncestorDirectories(path, requiredDirectories);
    for (const path of matchingDirectories) addAncestorDirectories(path, requiredDirectories);

    return entries.filter((entry) => {
      if (entry.directory) {
        if (requiredDirectories.has(entry.relativePath) || matchingDirectories.has(entry.relativePath)) return true;
        return [...matchingDirectories].some((prefix) => entry.relativePath.startsWith(`${prefix}/`));
      }
      if (matchingFiles.has(entry.relativePath)) return true;
      return [...matchingDirectories].some((prefix) => entry.relativePath.startsWith(`${prefix}/`));
    });
  }

  function hiddenByCollapsedAncestor(entry: WorkspaceEntry, collapsed: Set<string>) {
    const parts = entry.relativePath.split("/").filter(Boolean);
    let current = "";
    for (let index = 0; index < parts.length - (entry.directory ? 0 : 1); index += 1) {
      current = current ? `${current}/${parts[index]}` : parts[index];
      if (collapsed.has(current) && current !== entry.relativePath) return true;
    }
    return false;
  }

  function addAncestorDirectories(relativePath: string, output: Set<string>) {
    const parts = relativePath.split("/").filter(Boolean);
    let current = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      current = current ? `${current}/${parts[index]}` : parts[index];
      output.add(current);
    }
  }

  type SearchGroup = {
    path: string;
    relativePath: string;
    fileName: string;
    format: string;
    results: WorkspaceSearchResult[];
  };

  function groupSearchResults(results: WorkspaceSearchResult[]): SearchGroup[] {
    const groups = new Map<string, SearchGroup>();
    for (const result of results) {
      let group = groups.get(result.path);
      if (!group) {
        group = {
          path: result.path,
          relativePath: result.relativePath,
          fileName: result.fileName,
          format: result.format,
          results: [],
        };
        groups.set(result.path, group);
      }
      group.results.push(result);
    }
    return [...groups.values()];
  }
</script>

<aside class="workspace-panel flex shrink-0 flex-col" transition:sidePanelMotion={{ side: "left" }}>
  <header class="workspace-header">
    <div class="workspace-project-row">
      <div class="workspace-project-icon"><Icon name="folder" size={16} /></div>
      <div class="workspace-project-copy min-w-0 flex-1">
        <div class="workspace-project-name" title={project.root}>{project.name}</div>
        <div class="workspace-project-meta" title={`扫描 ${project.scanDurationMs}ms${project.indexReusedFiles > 0 ? ` · 复用索引 ${project.indexReusedFiles}` : ""}`}>
          {project.fileCount} 个文档{project.truncated ? " · 列表已截断" : ""}
        </div>
      </div>
      <button class="workspace-mini-btn" aria-label="刷新工作区" data-tooltip="刷新工作区" on:click={onRefresh}><Icon name="refresh" size={14} /></button>
      <button class="workspace-mini-btn" aria-label="关闭工作区" data-tooltip="关闭工作区" on:click={onCloseProject}><Icon name="close" size={14} /></button>
    </div>

    <div class="workspace-mode-switch" aria-label="侧栏工具">
      <button class:active={mode === "project"} class="workspace-mode-btn" on:click={() => onModeChange("project")}><Icon name="file" size={13} /><span>文件</span></button>
      <button class:active={mode === "search"} class="workspace-mode-btn" on:click={() => onModeChange("search")}><Icon name="search" size={13} /><span>搜索</span></button>
      <button class:active={mode === "outline"} class="workspace-mode-btn" on:click={() => onModeChange("outline")}><Icon name="outline" size={13} /><span>目录</span></button>
    </div>
  </header>

  {#if mode === "project"}
    <div class="workspace-tool-row">
      <div class="workspace-input-shell">
        <Icon name="search" size={13} />
        <input class="workspace-search-input" bind:value={treeQuery} placeholder="筛选文件…" aria-label="筛选文件" />
        {#if treeQuery}
          <button class="workspace-input-clear" aria-label="清除筛选" on:click={() => treeQuery = ""}><Icon name="close" size={11} /></button>
        {/if}
      </div>
    </div>
    <div class="workspace-tree-scroll">
      {#each visibleEntries as entry (entry.path)}
        {#if entry.directory}
          <button
            class="workspace-tree-row workspace-tree-dir"
            style={`padding-left:${10 + entry.depth * 14}px`}
            title={entry.relativePath}
            on:click={() => toggleDirectory(entry.relativePath)}
          >
            <span class="workspace-dir-chevron" class:collapsed={collapsedDirectories.has(entry.relativePath)}>⌄</span>
            <span class="workspace-folder-mark"><Icon name="folder" size={13} /></span>
            <span class="truncate">{entry.name}</span>
          </button>
        {:else}
          <button
            class:active={activePath === entry.path}
            class="workspace-tree-row workspace-tree-file"
            style={`padding-left:${10 + entry.depth * 14}px`}
            title={`${entry.relativePath} · ${(entry.sizeBytes / 1024).toFixed(entry.sizeBytes < 1024 ? 1 : 0)} KB`}
            on:click={() => onOpenFile(entry.path)}
          >
            <span class="workspace-tree-icon format-{entry.format ?? 'file'}">{fileGlyph(entry.format)}</span>
            <span class="truncate">{entry.name}</span>
          </button>
        {/if}
      {/each}
      {#if visibleEntries.length === 0}
        <div class="workspace-empty-state">
          <Icon name={treeQuery.trim() ? "search" : "file"} size={18} />
          <strong>{treeQuery.trim() ? "没有匹配的文件" : "这里还没有可打开的文档"}</strong>
          <span>{treeQuery.trim() ? "换个关键词试试" : "刷新工作区后会重新扫描支持的格式"}</span>
        </div>
      {/if}
    </div>
  {:else if mode === "search"}
    <div class="workspace-search-pane">
      <div class="workspace-tool-row">
        <div class="workspace-input-shell">
          <Icon name="search" size={13} />
          <input class="workspace-search-input" value={searchQuery} placeholder="搜索整个工作区…" on:input={(event) => onSearchChange(event.currentTarget.value)} />
          {#if searchQuery}
            <button class="workspace-input-clear" aria-label="清除搜索" on:click={() => onSearchChange("")}><Icon name="close" size={11} /></button>
          {/if}
        </div>
        {#if searchMeta && searchQuery.trim()}
          <div class="workspace-search-summary">
            <span>{searchMeta.results.length} 处结果</span>
            <span>·</span>
            <span>{searchMeta.filesScanned} 个文件</span>
            <span>·</span>
            <span>{searchMeta.durationMs}ms</span>
            {#if searchMeta.truncated}<span class="workspace-search-warning">· 结果已截断</span>{/if}
          </div>
        {/if}
      </div>
      <div class="workspace-search-scroll">
        {#if searchLoading}
          <div class="workspace-empty-state"><Icon name="search" size={18} /><strong>正在搜索…</strong><span>正在查找整个工作区</span></div>
        {:else if searchQuery.trim() && searchResults.length === 0}
          <div class="workspace-empty-state"><Icon name="search" size={18} /><strong>没有找到相关内容</strong><span>尝试更短的关键词，或检查拼写</span></div>
        {:else if !searchQuery.trim()}
          <div class="workspace-empty-state workspace-search-guide"><Icon name="search" size={19} /><strong>搜索整个工作区</strong><span>输入关键词即可跨文件查找内容，点击结果会直接定位到对应文档。</span></div>
        {:else}
          {#each groupedSearchResults as group (group.path)}
            <section class="workspace-search-group">
              <div class="workspace-search-group-header" title={group.relativePath}>
                <span class="workspace-format-pill">{group.format}</span>
                <span class="min-w-0 flex-1 truncate font-medium">{group.fileName}</span>
                <span class="workspace-result-count">{group.results.length}</span>
              </div>
              <div class="workspace-search-path">{group.relativePath}</div>
              {#each group.results as result, index (`${result.path}:${result.line}:${index}`)}
                <button class="workspace-search-result" on:click={() => onOpenSearchResult(result)} title={`${result.relativePath}:${result.line}:${result.column}`}>
                  {#each result.contextBefore as context (context.line)}
                    <div class="workspace-search-context"><span>{context.line}</span><code>{context.text}</code></div>
                  {/each}
                  <div class="workspace-search-match"><span>{result.line}</span><code>{result.preview}</code></div>
                  {#each result.contextAfter as context (context.line)}
                    <div class="workspace-search-context"><span>{context.line}</span><code>{context.text}</code></div>
                  {/each}
                </button>
              {/each}
            </section>
          {/each}
        {/if}
      </div>
    </div>
  {:else}
    <div class="workspace-outline-pane">
      <OutlinePanel embedded items={outline} documentId={activePath ?? project.root} activeId={activeHeadingId} onJump={onJump} />
    </div>
  {/if}
</aside>

<script lang="ts">
  import type { CompatibilityLevel } from "../../lib/contracts";
  import type { EditorMode } from "../../stores/editor";
  import { compatibilityLabel } from "../../features/editor/compatibility-labels";
  import type { PluginUiContribution } from "../../features/plugins/domain/plugin";
  import { primaryContentMotion } from "../../lib/motion";

  export let lineCount = 0;
  export let sizeBytes = 0;
  export let format = "Markdown";
  export let encoding = "UTF-8";
  export let readingProgress = 0;
  export let largeDocument = false;
  export let wordCount = 0;
  export let characterCount = 0;
  export let estimatedReadMinutes = 0;
  export let editorMode: EditorMode = "read";
  export let editable = true;
  export let dirty = false;
  export let saving = false;
  export let autoSave = false;
  export let compatibilityLevel: CompatibilityLevel = "safe";
  export let onOpenCompatibility: () => void = () => {};
  export let pluginItems: PluginUiContribution[] = [];
  export let onRunPluginItem: (id: string) => void = () => {};

  const humanSize = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  $: progressLabel = `${Math.round(Math.min(1, Math.max(0, readingProgress)) * 100)}%`;
  $: modeLabel = !editable ? "只读" : editorMode === "read" ? "兼容预览" : "所见即所得";
</script>

<footer class="app-statusbar" in:primaryContentMotion={{ y: 1, duration: 100 }}>
  <div class="status-left">
    <span class="status-mode">{modeLabel}</span>
    {#each pluginItems.filter((item) => item.side === "left") as item (item.id)}
      <button class="plugin-status-item" title={item.tooltip ?? `${item.pluginName} · ${item.label}`} on:click={() => onRunPluginItem(item.id)}>{item.label}</button>
    {/each}
    {#if saving}<span class="status-subtle">保存中…</span>{:else if dirty}<span class="status-warning">{autoSave ? "等待自动保存" : "未保存"}</span>{/if}
    {#if editorMode === "read"}<span class="status-subtle tabular-nums">{progressLabel}</span>{/if}
    {#if largeDocument}<span class="status-chip" title="已启用视口渲染和分批富文本增强">大文档</span>{/if}
    {#if editable}
      <button class="compatibility-status" data-level={compatibilityLevel} title="查看 Markdown 无损兼容性报告" on:click={onOpenCompatibility}>
        <span class="compatibility-status-dot"></span>{compatibilityLabel(compatibilityLevel)}
      </button>
    {/if}
  </div>
  <div class="status-right">
    {#each pluginItems.filter((item) => item.side !== "left") as item (item.id)}
      <button class="plugin-status-item" title={item.tooltip ?? `${item.pluginName} · ${item.label}`} on:click={() => onRunPluginItem(item.id)}>{item.label}</button>
    {/each}
    <span>{format}</span>
    <span title={`${characterCount.toLocaleString()} 个非空白字符`}>{wordCount.toLocaleString()} 字词</span>
    {#if estimatedReadMinutes > 0}<span class="status-optional">约 {estimatedReadMinutes} 分钟</span>{/if}
    <span class="status-optional">{lineCount} 行</span>
    <span>{humanSize(sizeBytes)}</span>
    <span>{encoding}</span>
  </div>
</footer>

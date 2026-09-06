<script lang="ts">
  import type { CompatibilityReport } from "../../lib/contracts";
  import { backdropMotion, modalMotion } from "../../lib/motion";
  import { compatibilityIssueLabel, compatibilityLabel, compatibilityShortDescription } from "../../features/editor/compatibility-labels";

  export let open = false;
  export let report: CompatibilityReport | null = null;
  export let fileName = "";
  export let onClose: () => void;
</script>

{#if open && report}
  <div class="settings-backdrop fixed inset-0 z-[76] grid place-items-center bg-black/20 p-5 backdrop-blur-[2px] dark:bg-black/45" role="presentation" on:click={onClose} transition:backdropMotion>
    <section class="compatibility-panel" role="dialog" aria-modal="true" aria-label="Markdown 无损兼容性" on:click={(event) => event.stopPropagation()} transition:modalMotion>
      <header class="compatibility-header">
        <div class="min-w-0">
          <div class="text-xs text-zinc-500 dark:text-zinc-400">Lossless Compatibility</div>
          <h2 class="truncate text-base font-semibold">{fileName || "当前文档"}</h2>
        </div>
        <button class="icon-btn" aria-label="关闭" on:click={onClose}>×</button>
      </header>

      <div class="compatibility-summary" data-level={report.level}>
        <div class="compatibility-grade">{compatibilityLabel(report.level)}</div>
        <div>
          <div class="text-sm font-medium">{compatibilityShortDescription(report)}</div>
          <div class="mt-1 text-xs opacity-75">
            {report.canWysiwyg ? "允许所见即所得" : "所见即所得已保护性禁用"}
            · {report.sourceStyleStable ? "Markdown 写法稳定" : "Markdown 写法可能规范化"}
          </div>
        </div>
      </div>

      {#if report.issues.length === 0}
        <div class="compatibility-empty">没有检测到已知的 round-trip 风险。</div>
      {:else}
        <div class="compatibility-list">
          {#each report.issues as issue}
            {@const label = compatibilityIssueLabel(issue)}
            <article class="compatibility-issue" data-level={issue.level}>
              <div class="compatibility-issue-title">
                <span>{label.title}</span>
                <span class="compatibility-count">×{issue.count}</span>
              </div>
              <p>{label.detail}</p>
              {#if issue.lines.length > 0}
                <div class="compatibility-lines">行 {issue.lines.join("、")}{issue.count > issue.lines.length ? " …" : ""}</div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}

      <footer class="compatibility-footer">
        <span>Safe 代表已知结构可安全往返；Guarded 允许编辑，但源码写法可能被规范化。</span>
        <button class="toolbar-btn" on:click={onClose}>完成</button>
      </footer>
    </section>
  </div>
{/if}

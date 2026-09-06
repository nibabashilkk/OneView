<script lang="ts">
  import type { BuildInfo, RenderedDocument, UserSettings } from "../../lib/contracts";
  import { backdropMotion, modalMotion } from "../../lib/motion";
  import type { DiagnosticEntry } from "../../stores/diagnostics";

  export let open = false;
  export let buildInfo: BuildInfo | null = null;
  export let active: RenderedDocument | null = null;
  export let tabCount = 0;
  export let settings: UserSettings;
  export let themeFamily = "default";
  export let entries: DiagnosticEntry[] = [];
  export let crashLog: string | null = null;
  export let onClose: () => void;
  export let onCopy: () => void;
  export let onClear: () => void;

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

{#if open}
  <div class="settings-backdrop fixed inset-0 z-[75] grid place-items-center bg-black/20 p-5 backdrop-blur-[2px] dark:bg-black/45" role="presentation" on:click={closeOnBackdrop} transition:backdropMotion>
    <section class="flex max-h-[82vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950" aria-label="诊断信息" transition:modalMotion>
      <div class="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div><div class="text-sm font-semibold">诊断信息</div><div class="mt-0.5 text-[10px] text-zinc-400">用于排查启动、渲染和文件问题；不包含文件正文</div></div>
        <button class="icon-btn" aria-label="关闭" on:click={onClose}>×</button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-5 text-[11px]">
        <div class="diagnostic-grid">
          <span>版本</span><strong>{buildInfo?.version ?? "—"}</strong>
          <span>系统</span><strong>{buildInfo ? `${buildInfo.os} / ${buildInfo.arch}` : navigator.platform}</strong>
          <span>构建</span><strong>{buildInfo?.debug ? "Debug" : "Release"}</strong>
          <span>Updater</span><strong>{buildInfo?.updaterConfigured ? "configured" : "disabled"}</strong>
          <span>标签页</span><strong>{tabCount}</strong>
          <span>当前文档</span><strong class="truncate">{active?.fileName ?? "无"}</strong>
          <span>当前编码</span><strong>{active?.encoding ?? "—"}</strong>
          <span>主题</span><strong>{themeFamily}</strong>
          <span>明暗模式</span><strong>{settings.appTheme}</strong>
        </div>

        {#if crashLog}
          <div class="mt-5 font-semibold">上次 Rust 崩溃</div>
          <pre class="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-3 font-mono text-[10px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{crashLog}</pre>
        {/if}

        <div class="mt-5 flex items-center justify-between"><div class="font-semibold">最近错误</div><button class="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" on:click={onClear}>清空</button></div>
        {#if entries.length === 0}
          <div class="mt-3 rounded-lg bg-zinc-50 p-4 text-zinc-400 dark:bg-zinc-900">当前会话没有捕获到前端异常。</div>
        {:else}
          <div class="mt-3 space-y-2">
            {#each entries as entry}
              <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div class="flex justify-between gap-3 text-[9px] uppercase tracking-wide text-zinc-400"><span>{entry.source}</span><span>{new Date(entry.at).toLocaleTimeString()}</span></div>
                <div class="mt-2 break-words font-mono text-[10px] leading-5 text-zinc-600 dark:text-zinc-300">{entry.message}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800"><button class="rounded-lg border border-zinc-200 px-3 py-2 text-[11px] dark:border-zinc-800" on:click={onCopy}>复制诊断信息</button></div>
    </section>
  </div>
{/if}

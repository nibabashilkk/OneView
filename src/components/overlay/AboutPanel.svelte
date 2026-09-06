<script lang="ts">
  import appIcon from "../../assets/oneview-icon.png";
  import type { BuildInfo, UpdateMetadata } from "../../lib/contracts";
  import { backdropMotion, modalMotion } from "../../lib/motion";

  export let open = false;
  export let buildInfo: BuildInfo | null = null;
  export let updateStatus: "idle" | "checking" | "available" | "current" | "downloading" | "error" = "idle";
  export let update: UpdateMetadata | null = null;
  export let updateProgress = 0;
  export let updateError: string | null = null;
  export let onClose: () => void;
  export let onCheckUpdates: () => void;
  export let onInstallUpdate: () => void;
  export let onOpenDiagnostics: () => void;

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

{#if open}
  <div class="settings-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/20 p-5 backdrop-blur-[2px] dark:bg-black/45" role="presentation" on:click={closeOnBackdrop} transition:backdropMotion>
    <section class="w-full max-w-[460px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950" aria-label="关于 oneView" transition:modalMotion>
      <div class="flex items-start justify-between border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
        <div class="flex items-center gap-3">
          <img src={appIcon} alt="" class="h-11 w-11 rounded-[12px] shadow-sm" aria-hidden="true" />
          <div>
            <div class="text-lg font-semibold tracking-tight">oneView</div>
            <div class="mt-1 text-xs text-zinc-400">轻量、快速、本地优先的多格式文件查看器</div>
          </div>
        </div>
        <button class="icon-btn" aria-label="关闭" on:click={onClose}>×</button>
      </div>

      <div class="space-y-5 p-6">
        <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div><div class="text-zinc-400">版本</div><div class="mt-1 font-medium">{buildInfo?.version ?? "—"}</div></div>
          <div><div class="text-zinc-400">平台</div><div class="mt-1 font-medium">{buildInfo ? `${buildInfo.os} / ${buildInfo.arch}` : "—"}</div></div>
          <div><div class="text-zinc-400">文件能力</div><div class="mt-1 font-medium">Markdown + Plugins</div></div>
          <div><div class="text-zinc-400">构建</div><div class="mt-1 font-medium">{buildInfo?.debug ? "Debug" : "Release"}</div></div>
        </div>

        <div class="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-semibold">软件更新</div>
              <div class="mt-1 text-[11px] leading-5 text-zinc-400">
                {#if !buildInfo?.updaterConfigured}
                  当前构建未配置发布更新源。
                {:else if updateStatus === "checking"}
                  正在检查更新…
                {:else if updateStatus === "current"}
                  当前已经是最新版本。
                {:else if updateStatus === "available" && update}
                  发现新版本 v{update.version}。
                {:else if updateStatus === "downloading"}
                  正在下载并安装… {Math.round(updateProgress * 100)}%
                {:else if updateStatus === "error"}
                  {updateError ?? "检查更新失败"}
                {:else}
                  可手动检查新版本。
                {/if}
              </div>
            </div>
            {#if updateStatus === "available"}
              <button class="rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" on:click={onInstallUpdate}>安装更新</button>
            {:else}
              <button class="rounded-lg border border-zinc-200 px-3 py-2 text-[11px] font-medium disabled:opacity-40 dark:border-zinc-800" disabled={!buildInfo?.updaterConfigured || updateStatus === "checking" || updateStatus === "downloading"} on:click={onCheckUpdates}>检查更新</button>
            {/if}
          </div>
          {#if updateStatus === "downloading"}
            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div class="h-full rounded-full bg-zinc-900 transition-[width] dark:bg-zinc-100" style={`width:${Math.max(2, updateProgress * 100)}%`}></div></div>
          {/if}
          {#if update?.body && updateStatus === "available"}
            <div class="mt-3 max-h-24 overflow-auto whitespace-pre-wrap border-t border-zinc-100 pt-3 text-[10px] leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">{update.body}</div>
          {/if}
        </div>

        <button class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900" on:click={onOpenDiagnostics}>打开诊断信息</button>
      </div>
    </section>
  </div>
{/if}

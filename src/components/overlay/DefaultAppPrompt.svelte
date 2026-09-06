<script lang="ts">
  import { contentMotion } from "../../lib/motion";
  import { defaultApp } from "../../stores/default-app";

  export let open = false;
  export let onSetDefault: () => void | Promise<void>;
  export let onLater: () => void;
  export let onOpenSettings: () => void;

  $: markdown = $defaultApp.status?.associations.find((item) => item.key === "markdown") ?? null;
  $: platform = $defaultApp.status?.platform ?? "";
  $: actionBusy = $defaultApp.actionGroup === "markdown";
</script>

{#if open}
  <div class="default-app-prompt" role="status" aria-live="polite" transition:contentMotion>
    <div class="default-app-prompt-icon" aria-hidden="true">M↓</div>
    <div class="min-w-0 flex-1">
      <div class="default-app-prompt-title">双击 Markdown，直接用 oneView 打开</div>
      <div class="default-app-prompt-copy">
        {#if platform === "macos"}
          {#if markdown?.currentAppName}
            当前默认是 {markdown.currentAppName}。设为默认后，.md / .markdown 会直接进入这里。
          {:else}
            将 oneView 设为 Markdown 默认应用；macOS 如需确认会显示系统授权。
          {/if}
        {:else if platform === "windows"}
          Windows 会打开系统“默认应用”页面，由你确认 oneView。
        {:else}
          可在设置里管理 Markdown 的默认打开方式。
        {/if}
      </div>
    </div>
    <div class="default-app-prompt-actions">
      <button class="default-app-primary" disabled={actionBusy} on:click={() => void onSetDefault()}>
        {actionBusy ? "处理中…" : platform === "windows" ? "去设置" : "设为默认"}
      </button>
      <button class="default-app-secondary" on:click={onLater}>以后再说</button>
      <button class="default-app-link" on:click={onOpenSettings}>更多</button>
    </div>
  </div>
{/if}

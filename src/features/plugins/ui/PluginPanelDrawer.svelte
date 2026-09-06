<script lang="ts">
  import { onMount } from "svelte";
  import type { PluginManager } from "../application/plugin-manager";
  import type { PluginPanelContribution } from "../domain/plugin";
  import { sidePanelMotion } from "../../../lib/motion";

  export let manager: PluginManager;
  export let panels: PluginPanelContribution[] = [];
  export let panel: PluginPanelContribution | null = null;
  export let theme: "light" | "dark" = "light";
  export let onSelect: (id: string) => void = () => {};
  export let onClose: () => void = () => {};

  let frame: HTMLIFrameElement | null = null;
  let unsubscribePanel: (() => void) | null = null;
  let subscribedPanelId: string | null = null;
  let srcdoc = "";

  $: srcdoc = panel ? buildPanelDocument(panel, theme) : "";
  $: syncSubscription(panel?.id ?? null);

  function syncSubscription(panelId: string | null) {
    if (panelId === subscribedPanelId) return;
    unsubscribePanel?.();
    unsubscribePanel = null;
    subscribedPanelId = panelId;
    if (!panelId) return;
    unsubscribePanel = manager.subscribePanelMessages(panelId, (payload) => {
      frame?.contentWindow?.postMessage({ channel: "mdv-panel-host", panelId, payload }, "*");
    });
  }

  function handleMessage(event: MessageEvent) {
    if (!panel || !frame?.contentWindow || event.source !== frame.contentWindow) return;
    const data = event.data as { channel?: string; panelId?: string; payload?: unknown } | null;
    if (!data || data.channel !== "mdv-panel" || data.panelId !== panel.id) return;
    try {
      manager.sendPanelMessage(panel.id, data.payload);
    } catch {
      // Panel failures are diagnosed by the plugin runtime; never break the host UI.
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      unsubscribePanel?.();
      unsubscribePanel = null;
      subscribedPanelId = null;
    };
  });

  function buildPanelDocument(value: PluginPanelContribution, resolvedTheme: "light" | "dark") {
    const panelId = JSON.stringify(value.id).replace(/</g, "\\u003c");
    const themeName = JSON.stringify(resolvedTheme);
    const css = (value.css ?? "").replace(/<\/style/gi, "<\\/style");
    return `<!doctype html>
<html data-theme=${themeName}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'">
<style>
:root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;background:#fff;color:#18181b}
html[data-theme="dark"]{background:#18181b;color:#f4f4f5}
*{box-sizing:border-box}
body{margin:0;padding:14px;font-size:12px;line-height:1.55;background:transparent;color:inherit}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit}
${css}
</style>
<script>
(() => {
  const panelId = ${panelId};
  const listeners = new Set();
  const send = (payload) => parent.postMessage({ channel: "mdv-panel", panelId, payload }, "*");
  Object.defineProperty(window, "markdownViewerPanel", {
    value: Object.freeze({
      postMessage: send,
      onMessage(handler) {
        if (typeof handler !== "function") throw new Error("markdownViewerPanel.onMessage 需要函数");
        listeners.add(handler);
        return () => listeners.delete(handler);
      }
    }),
    configurable: false,
    writable: false
  });
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== parent || !data || data.channel !== "mdv-panel-host" || data.panelId !== panelId) return;
    for (const handler of [...listeners]) {
      try { handler(data.payload); }
      catch (error) { send({ type: "panel-error", message: error instanceof Error ? error.message : String(error) }); }
    }
  });
  window.addEventListener("DOMContentLoaded", () => send({ type: "ready" }), { once: true });
})();
<\/script>
</head>
<body>${value.html}</body>
</html>`;
  }
</script>

{#if panel}
  <aside class="plugin-panel-drawer" aria-label={`插件面板：${panel.title}`} transition:sidePanelMotion={{ side: "right" }}>
    <div class="plugin-panel-header">
      <div class="plugin-panel-title-wrap">
        <div class="plugin-panel-title">{panel.title}</div>
        <div class="plugin-panel-subtitle">{panel.pluginName}</div>
      </div>
      <button class="plugin-panel-close" aria-label="关闭插件面板" title="关闭" on:click={onClose}>×</button>
    </div>

    {#if panels.length > 1}
      <div class="plugin-panel-tabs" role="tablist" aria-label="插件面板">
        {#each panels.slice(0, 6) as item (item.id)}
          <button
            class:active={item.id === panel.id}
            class="plugin-panel-tab"
            role="tab"
            aria-selected={item.id === panel.id}
            title={`${item.pluginName} · ${item.title}`}
            on:click={() => onSelect(item.id)}
          >{item.title}</button>
        {/each}
      </div>
    {/if}

    <div class="plugin-panel-frame-wrap">
      <iframe
        bind:this={frame}
        class="plugin-panel-frame"
        title={`${panel.pluginName} · ${panel.title}`}
        sandbox="allow-scripts"
        {srcdoc}
      ></iframe>
    </div>
  </aside>
{/if}

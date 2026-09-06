# v0.18.4 — Sandboxed Plugin Panels

这一版把复杂插件 UI 放进独立安全边界，而不是允许第三方插件直接操作宿主 Svelte/DOM。

```text
Plugin Worker
    │ registerPanel / postMessage
    ▼
PluginManager + PluginPanelMessageBus
    │
    ▼
PluginPanelDrawer
    │ postMessage only
    ▼
sandboxed iframe + strict CSP
```

## 核心约束

- `ctx.ui.registerPanel()` 需要独立 `ui.panel` 权限。
- iframe 只有 `allow-scripts`，没有 `allow-same-origin`、文件系统、Tauri、宿主 DOM 或网络能力。
- iframe 额外注入 `default-src 'none'` CSP；仅允许内联样式/脚本和 data/blob 图片。
- Panel 与 Worker 之间只传 structured-clone 消息。
- 单插件最多 8 个面板，单面板 HTML 256k、CSS 128k。
- 面板消息不进入持久化 store，由 `PluginPanelMessageBus` 负责瞬时路由。
- 面板关闭/插件禁用/卸载会自动清理注册和消息监听。

## API

```js
const panel = ctx.ui.registerPanel({
  id: "inspector",
  title: "检查器",
  html: `<button id="refresh">刷新</button>`,
  css: `button { border-radius: 8px; }`,
  when: "document"
});

panel.onMessage((message) => {
  // iframe -> Worker
});

panel.postMessage({ type: "update", value: 1 }); // Worker -> iframe
panel.open();
```

iframe 内唯一宿主桥：

```js
window.markdownViewerPanel.postMessage(payload);
window.markdownViewerPanel.onMessage(handler);
```

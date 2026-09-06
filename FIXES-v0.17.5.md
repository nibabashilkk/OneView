# v0.17.5 — macOS 标题栏拖动修复

根因：v0.17.3 起启用了 `titleBarStyle: Overlay`，但只给一个很窄的空白块加了 `data-tauri-drag-region`，同时 capability 没有显式开放 `core:window:allow-start-dragging`。

修复：

- capability 增加 `core:window:allow-start-dragging` 和 `core:window:allow-toggle-maximize`。
- 标题栏空白区域统一支持拖动。
- 交互控件（标签、关闭按钮、菜单、搜索等）从拖动命中中排除。
- 双击空白标题栏区域切换最大化。

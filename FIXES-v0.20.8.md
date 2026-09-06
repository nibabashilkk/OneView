# v0.20.8 — Flicker-free rendering

本版修复 v0.20.7 Motion System 在 WKWebView 上暴露 backing surface 导致的页面闪烁。

- Primary surface 永远保持 opacity=1。
- 主内容使用持久 stage，Tab/模式切换仅替换 stage 内子节点。
- 冷启动完成 Workspace / external-open 恢复后再显示应用内容。
- HTML head 提前应用 persisted/system theme。
- Overlay 与 popover 仍允许透明度动画。

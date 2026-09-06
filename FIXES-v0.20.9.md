# v0.20.9 — Persistent Modal Layer

## 问题

设置与插件中心在关闭动画结束后会出现一次整页闪烁。根因不是 Markdown 主内容，而是 WKWebView 在销毁带 `backdrop-filter` 的全屏 fixed layer 时重建 compositor tree。

## 修复

- 设置 / 插件中心浮层始终保持挂载。
- 删除两者的 Svelte `transition:backdropMotion` / `transition:modalMotion`。
- 全屏遮罩不使用 `backdrop-filter`。
- scrim 只过渡 `background-color`，不对全屏容器做 opacity 动画。
- 面板窗口只做局部 opacity / transform。
- 关闭时使用 `pointer-events:none + inert + aria-hidden`，不销毁 DOM。

## 预期

打开和关闭仍有轻量动画，但关闭最后一帧不会再触发后方页面重新合成。

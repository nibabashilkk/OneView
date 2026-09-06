# v0.21.2 — Stable Scroll Layout

## 问题

部分页面使用 `overflow-y: auto` / `overflow: auto`。当内容刚好从“不需要滚动”切换为“需要滚动”时，传统滚动条会占用内容区宽度，导致居中的 Reader、设置内容、插件卡片等瞬间横向重排，看起来像窗口本身在变大变小。

代码中不存在 `setSize`、`resizeTo` 等运行时窗口缩放调用，因此这属于 scrollbar layout shift，而不是 Tauri Window resize。

## 修复

统一为主要自动滚动容器设置：

```css
scrollbar-gutter: stable;
```

这会提前保留纵向滚动条槽位：

- 没有滚动内容时，不强制画出滚动条；
- 出现滚动内容时，不再额外吃掉内容宽度；
- Reader / Editor / Settings / Plugin Center / Workspace / Command Palette / Diagnostics 等区域保持尺寸稳定；
- 不修改 Tauri 原生窗口大小和 window-state 行为。

## 为什么不用 `overflow-y: scroll`

`overflow-y: scroll` 虽然也能避免宽度变化，但会在无需滚动时永久显示滚动轨道。`scrollbar-gutter: stable` 能保留稳定布局，同时维持更干净的桌面应用视觉。

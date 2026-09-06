# v0.17.0 — 所见即所得与布局收敛

## 目标

消除 Markdown 的“先阅读、再点编辑、再切回预览”摩擦，让渲染后的文档本身就是编辑器。

## 实现

- 安全 Markdown 默认 `wysiwyg`。
- `read` 仅作为不支持无损 WYSIWYG 时的兼容预览内部状态。
- 顶栏仅保留“源码”辅助开关。
- 单文档不显示标签条。
- WYSIWYG 和 Reader 去卡片化，正文直接铺在主题画布上。
- WYSIWYG 使用 `ViewportTracker`，补齐滚动恢复、进度和目录当前项。
- 编辑标题同步生成稳定 DOM id，目录点击可直接跳转。
- WYSIWYG 内直接响应 Ctrl/Cmd+S。

## 数据安全

`CompatibilityReport.canWysiwyg` 仍是强制门禁。无法无损 round-trip 的 Markdown 不会自动进入可视编辑，而是保留安全预览和源码编辑。

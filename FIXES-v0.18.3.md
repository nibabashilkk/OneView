# v0.18.3 — Plugin Contribution Registry

- 新增统一 `PluginContributionRegistry`，命令与 UI contribution 的注册/清理由专门 Registry 负责。
- Plugin API 新增 `ui.contribute()`：支持 `statusbar`、`context-menu`、`toolbar` 三个受控位置。
- 新增声明式 `when` 条件，不执行第三方表达式。
- 插件命令支持 `shortcut`；核心应用快捷键优先。
- 顶部最多展示 3 个插件入口、状态栏最多 6 个，防止插件破坏正文优先布局。
- 新增 `ui.contribute` 权限，所有注册仍经过 Worker -> Host capability gate。
- 新增 `examples/plugins/ui-contributions` 示例。
- Panel/自定义复杂 UI 保留到后续独立 iframe/WebView 方案，不把 DOM 暴露给插件。

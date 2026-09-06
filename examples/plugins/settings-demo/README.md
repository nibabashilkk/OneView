# Settings Demo

用于验证 v0.18.5 的 Schema-driven Plugin Settings：

- `ctx.settings.register()` 声明设置结构；
- 设置 UI 由 oneView 宿主统一渲染；
- `ctx.settings.get/set()` 通过受控存储访问；
- `ctx.settings.onChanged()` 接收来自宿主设置页或插件自身的变更；
- 插件不接触设置页 DOM、Svelte store 或 Tauri。

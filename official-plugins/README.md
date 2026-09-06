# Official Plugins — v0.21

oneView 是 Markdown-first。官方可选包统一使用 `.mdvplugin`：

- `developer-pack.mdvplugin`：JSON / YAML / TOML / CSV / LOG / DIFF/PATCH；
- 各独立 Document Viewer；
- `slate-theme.mdvplugin`：纯声明式主题，0 JS / 0 Worker / 0 permissions。

Document Plugins 使用 `runtime: { kind: "worker", role: "document", main: "main.js" }`，零权限进入独立 Sandbox Worker。Theme Plugin 只提供 Theme JSON，由 Rust/TypeScript 校验后写入 Semantic Token，不进入 Worker。

重新生成：

```bash
python3 scripts/build-official-plugins.py
```

生成物位于 `official-plugins/dist/*.mdvplugin`，不会写入 Tauri bundle resources。

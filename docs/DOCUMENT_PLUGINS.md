# Document Plugins — v0.21

Markdown / Plain Text 仍由 Core 拥有。JSON/YAML/TOML/CSV/LOG/DIFF 等格式通过可选 Document Plugin 提供。

新 manifest：

```json
{
  "runtime": { "kind": "worker", "role": "document", "main": "main.js" },
  "permissions": [],
  "contributes": {
    "documentFormats": [
      { "id": "json", "label": "JSON", "extensions": ["json"] }
    ]
  }
}
```

Document Worker 必须零权限；Extension Worker 不能声明 `documentFormats`。v0.20 的 `main + runtime: "document"` 继续兼容。

## Runtime flow

```text
open_document (Rust)
  -> Markdown? Markdown Core : Plain Text DTO
  -> active documentFormats contribution
  -> DocumentPluginRuntime.renderDocument
  -> trusted Host Worker
  -> disposable Sandbox Worker
  -> PluginDocumentRenderResult
  -> host sanitizer
  -> Viewer
```

Workspace 只接收活动 Document Plugin 的标准化 `{ id, extensions }` 用于文件 eligibility；Rust 不导入插件解析器。插件禁用后，下次 Workspace refresh/search 立刻收缩对应格式。

## Official packages

`python3 scripts/build-official-plugins.py` 会可重复生成：Developer Pack、JSON/YAML/TOML/CSV/LOG/DIFF Viewer，以及纯声明式 Slate Theme。Document 包版本为 1.2.0，最低 App 版本 0.21.0。生成物位于 `official-plugins/dist/`，不进入 Tauri bundle resources。

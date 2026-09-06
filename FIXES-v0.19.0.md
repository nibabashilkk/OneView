# v0.19.0 — Markdown Core / Document Plugins

## 目标

把产品重新收敛成 Markdown-first：Markdown 富渲染/编辑留在主程序，开发文档格式改为真正可选插件，避免每增加一种格式都扩大主二进制和系统关联面。

## 已完成

- 删除主程序 `structured-core` workspace crate 和 desktop dependency。
- Rust `DocumentService` 只做 Markdown 富渲染；其他文本文件只返回安全 Plain Text DTO。
- manifest 新增 `contributes.documentFormats`，Markdown / Plain Text 扩展名由 Core 独占。
- Plugin Runtime 新增 Worker document-render RPC、5 秒超时、结果尺寸限制和卡死 Worker 终止。
- 插件 HTML 在宿主 DOM 写入前执行 tag / attribute / URL / class allowlist 清洗。
- Workspace 的格式表改为前端根据启用插件动态传入，Rust 不再写死 JSON/YAML/TOML/CSV/LOG/DIFF。
- 插件启用/禁用时自动重渲染已打开的非 Markdown Tab，并刷新 Workspace。
- 打开文件对话框不再保留 JSON/YAML/TOML/CSV/LOG/DIFF 的宿主白名单；格式发现只来自 Core + 当前启用插件。
- JSON 展开/收起动作改成宿主通用 `data-plugin-action` details 控制，不再在 Viewer 中写死 JSON action 协议。
- `markdown/text/plaintext/plain-text` format id 与 Markdown/TXT 扩展名设为 Core 保留项，manifest 校验和前端 Registry 双层阻止插件覆盖。
- 系统默认文件关联收缩为 Markdown；插件不自动抢占开发格式默认应用。
- 新增 6 个独立官方格式插件和 1 个 Developer Pack。
- 新增 `scripts/build-official-plugins.py`，插件安装包不进入 Tauri bundle resources。

## 发布前仍需在开发机执行

```bash
npm install
npm run check
npm run build
cargo check --workspace
npm run tauri dev
```

当前生成环境无 Rust toolchain，且源码包未携带 `node_modules`，因此无法在这里做最终 Rust/Svelte 全量编译。

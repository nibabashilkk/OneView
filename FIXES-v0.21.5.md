# v0.21.5 — macOS Open With / LaunchServices

## 问题

应用内部已经可以通过 Document Plugin 渲染 JSON 等开发文档，但 macOS Finder 的“打开方式”里没有 Markdown Viewer。原因是 v0.21.4 的 bundle 只声明 Markdown 扩展；LaunchServices 不会读取运行时 Plugin Registry。

## 修复

- 在 `src-tauri/tauri.macos.conf.json` 增加 JSON / YAML / TOML / CSV / LOG / DIFF/PATCH document associations。
- 所有开发文本格式使用 `rank: "Alternate"`，只成为候选打开器，不抢系统默认。
- Markdown 保持 `Editor + Alternate`；开发文档使用 `Viewer + Alternate`。
- `default_apps.rs` 在 macOS 暴露对应格式组，允许用户主动设置默认应用。
- Windows 的默认应用/系统关联范围仍只有 Markdown。
- 没有对应 Document Plugin 时依旧走 Plain Text fallback，因此静态系统能力声明不会绕过插件架构。

## 重要边界

`.app` 的 document types 是签名 bundle 的静态元数据。启用/禁用插件时不动态重写 `Info.plist`，也不调用 LaunchServices 私有方式做运行时注册。

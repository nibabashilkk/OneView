# v0.21.9 — oneView Branding & App Icon

- 正式产品名：`oneView`。
- 产品定位：轻量、快速、本地优先的多格式文件查看器。
- 系统 App Icon 改为新的 Soft UI 文件图标，提供 PNG / ICO / ICNS。
- 首页和关于页复用同一份品牌图标，避免系统图标与应用内品牌不一致。
- Windows `RegisteredApplications` / Explorer 右键动作改为 oneView，并清理旧 Markdown Viewer 注册项。
- macOS Finder 文件关联仍沿用现有 bundle identifier 以保留用户数据兼容性，但系统展示名改为 oneView。
- `markdownViewer` 插件全局 API、`MarkdownViewer*` TypeScript SDK 类型以及 `com.markdownviewer.*` 插件 ID 保持不变，属于兼容层，不随品牌改名。

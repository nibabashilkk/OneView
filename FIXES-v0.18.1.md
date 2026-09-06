# v0.18.1 — Plugin Development Workflow

本版在 v0.18.0 插件底座上补齐“开发插件”的实际工作流，同时收紧权限升级边界。

## 架构

- `PluginRepository` 新增选择/链接开发目录的 Port。
- `TauriPluginRepository` 仍只是 IPC Adapter。
- Rust `PluginService` 负责校验与持久化开发目录引用，不复制源码。
- `PluginManager.reload()` 统一编排 unload → refresh → load，正式插件与开发插件共享同一生命周期。
- `PluginSource` 明确区分 installed / development，UI 不再靠路径或命名猜来源。

## 权限升级保护

注册表把 `enabled` 与 `grantedPermissions` 分开保存。只要新版 manifest 新增了未授权权限，插件就不会继续自动运行；用户重新启用时才写入新的授权快照。

这同时覆盖正式插件升级和开发目录修改 manifest 的场景。

# v0.18.8 — Plugin Shortcut Remapping

本版把 v0.18.7 的“冲突检测”升级成完整的宿主快捷键绑定层。

- 新增 `PluginShortcutRegistry`：原始插件命令保持默认快捷键不变，用户覆盖只在宿主层计算 effective shortcut。
- 新增持久化 `shortcutOverrides`，支持自定义字符串和 `null`（显式禁用），registry schema 升级到 v5。
- 新增插件卡片快捷键编辑器：录制、禁用、恢复默认。
- 保存自定义组合前检查宿主保留快捷键和其他插件当前有效绑定。
- 修复 shortcut identity 中 `Ctrl` 被忽略的问题；`Ctrl+Tab` 与 `Mod+Tab` 现在是不同组合。
- 插件卸载时清理其 `<plugin-id>:` 命名空间下的覆盖记录。

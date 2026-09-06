# v0.21.4 — Theme-owned Reader Visuals

## 问题

v0.21 引入 App / Reader / Syntax Semantic Token 后，Settings 仍保留旧的 GitHub / Paper / Minimal / Sepia “阅读样式”。这形成两套视觉来源：Theme Registry 已经控制 Reader 配色，但 `readerTheme` 仍存在于设置、DOM attribute 和少量 CSS 分支中，用户点击后大部分效果已经被 Theme Token 覆盖。

## 调整

- 删除 `ReaderTheme` 类型、`UserSettings.readerTheme`、`setReaderTheme` 与四个旧 Profile。
- Rust `UserSettings` 同步删除 `reader_theme`，settings schema 从 v4 升到 v5。
- Reader / WYSIWYG / content stage 删除 `data-reader-theme`。
- Markdown CSS 直接消费 `reader.*` Semantic Token，不再通过 Profile selector 间接接入。
- “阅读”设置只保留字体、字号、行高、正文宽度和代码字号。
- Settings 的主题卡同时预览 App surface 与 Reader surface，并明确 Theme 同时控制 App / Reader / Syntax。
- Diagnostics 分开显示 Theme family 与明暗模式。
- HTML export 继续复用 Theme Registry 的 Reader / Syntax Token。

## 兼容

旧 `settings-v1.json` 中即使存在 `readerTheme`，Serde 默认忽略未知字段；前端 normalize 也不再读取它。升级不会重置其他阅读排版设置。

## 安全边界

Theme schema、安全颜色值限制、Theme Bootstrap Cache、atomic replace、Safe Mode 与 Worker Runtime 均未改变。

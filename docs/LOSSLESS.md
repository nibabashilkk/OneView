# Lossless Compatibility Engine — v0.17.2

目标不是宣称“所有 Markdown 都能 WYSIWYG”，而是给每个文档一个可解释的 round-trip 风险等级，并让打开、进入编辑、保存和系统预览共用同一套 Rust 规则。

## Levels

| Level | Meaning | WYSIWYG | Save policy |
| --- | --- | --- | --- |
| Safe | 已知结构可在当前 Editor Schema 中稳定往返 | 直接允许 | 正常保存 |
| Guarded | 语义可保留，但源码写法可能规范化 | 允许并提示 | 正常保存，报告可见 |
| Preview Only (`sourceOnly`) | 存在当前 Schema 不能无损表达的语义/属性 | 禁止进入 | 保存前再次阻止；原文件保持不变 |

## v0.12 Rules

### Preview Only (`sourceOnly`)

- Front Matter
- Footnotes
- Raw HTML / HTML comments
- Heading attributes，例如 `{#install .compact}`

### Guarded

- Setext heading
- `~~~` fenced code / fence length > 3
- reference-style links
- table source spacing/alignment formatting
- `*` / `+` list marker style
- `1)` ordered list delimiter
- indented code block
- closing heading hashes
- autolink source form
- HTML entities
- escaped punctuation
- hard-break source style
- `***` / `___` thematic break style

## Single Source of Truth

```text
markdown-core::analyze_markdown_compatibility
          │
          ├── file open → RenderedDocument.compatibility
          ├── enter WYSIWYG → analyze_markdown Tauri command
          └── WYSIWYG save → analyze_markdown Tauri command again
```

旧的前端 regex compatibility checker 已删除，避免 Rust 与 WebView 出现两份规则。

## Fixtures

- `fixtures/lossless-safe.md`
- `fixtures/lossless-guarded.md`
- `fixtures/lossless-source-only.md`

发布前应把每条规则都补成 Rust 单测 + fixture round-trip 测试；任何新 Editor Schema 能力都应该同时更新本文件与兼容规则。

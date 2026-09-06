# Architecture

工作区、`DocumentFormat`、Rust `WorkspaceIndexCache` 和跨文件搜索共享 Core 能力。

v0.15 支持 Markdown、JSON、YAML、CSV、TOML、LOG、DIFF/PATCH。

`workspace-search-probe` 也会出现在这个文件中，用于验证跨文件搜索分组和上下文。

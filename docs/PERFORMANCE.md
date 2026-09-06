# Performance Baseline

v0.15 开始把“快”变成可重复验证的指标，而不是主观描述。

## Core render benchmark

```bash
npm run bench:core
```

它会在 Release 模式下对约 100KB / 1MB / 10MB 的生成 Markdown 分别运行 5 次，输出：

- source size
- median render time
- best render time
- generated HTML size
- heading count

这里测的是 `markdown-core` 的 parse + outline + lossless analysis + HTML render，不包含 WebView DOM、KaTeX、Mermaid 和图片加载。

## Desktop release gate

正式发布前还应在同一台真实机器上固定记录：

1. 冷启动：双击 100KB Markdown 到首屏正文可见。
2. 1MB Markdown：打开耗时、峰值内存、快速滚动 FPS。
3. 10MB Markdown：打开耗时、峰值内存、全文搜索耗时。
4. Workspace：1k / 5k 支持文件的首次扫描耗时。
5. Workspace search：第一次查询与第二次同项目查询耗时，对比 index cache 命中率。
6. 安装包体积与空闲内存。

建议 Windows 与 macOS 各保存一份机器配置和结果，避免不同机器数字混在一起。

## Current environment

当前生成环境没有 Rust toolchain，且 npm registry 访问超时，因此 v0.15 **只提供 benchmark harness，不填写虚构的性能数字**。第一次在开发机成功构建后，应把真实结果记录到发布说明或单独 benchmark 历史文件中。

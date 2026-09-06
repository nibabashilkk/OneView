# v0.21.0 — Contribution-first Plugin Platform

## 核心变化

Plugin 不再以“有没有 `main.js`”定义类型，而以 contribution 定义能力；Worker 只是需要执行代码时的可选 runtime descriptor。Theme / Document / Extension 因而共享安装、启停、更新、卸载、开发模式、兼容性和 Plugin Center，同时保留不同的安全边界。

## Theme Platform

- App / Reader / Syntax 27 个 Semantic Token。
- Theme Registry + Light/Dark family。
- Theme Bootstrap Cache。
- Settings 动态主题选择。
- HTML export 继承当前主题。
- Slate Theme 官方声明式示例。

## Security

- Theme-only：0 JS / 0 Worker / 0 permission / 0 arbitrary style。
- Theme JSON schema/scope/token/value/size/path 双层校验。
- 开发目录 canonical path + symlink escape 防御。
- 同 family variant/scope 一致性。
- 安装更新 atomic replace。
- Safe Mode 仅暂停 Worker。

## Compatibility

v0.20 的 `main + runtime: "document" | "extension"` 继续读取；官方包和新文档统一采用 v0.21 Worker descriptor。

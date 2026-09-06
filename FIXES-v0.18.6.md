# v0.18.6 — Plugin Health & Diagnostics

## 目标

把插件异常从“全局错误字符串 + runtime error 状态”升级为稳定的会话级健康模型，同时保持 `PluginManager` 只负责 orchestration。

## 实现

- `PluginDiagnosticsRegistry`：保存每插件最多 32 条结构化记录与健康快照。
- 健康状态：`disabled / healthy / degraded / faulted`。
- 结构化来源：`runtime / command / event / panel / settings / lifecycle`。
- Runtime 可恢复异常通过 `PluginRuntimeCallbacks.onDiagnostic` 上报；fatal 通过带 reason 的 `onFatal(message, reason)` 上报。
- circuit breaker reason 单独统计熔断次数。
- Plugin Settings 卡片增加诊断折叠区、最近错误、会话统计和手动清空。
- 新增 `diagnostics-demo` 示例插件。

## 顺手修复

全局 `DiagnosticEntry.source` 原先只允许 `window | promise | app`，但应用已经实际写入 `plugins` 与 `plugin:<id>`；v0.18.6 将类型模型与真实调用统一。

# v0.18.5 — Plugin Settings Schema & Circuit Breaker

## 插件设置

- 新增独立 `settings` 权限。
- 新增 `ctx.settings.register/get/set/onChanged`。
- 设置 Schema 由 `PluginSettingsRegistry` 管理，设置表单完全由宿主渲染。
- 支持 boolean / text / number / select；所有值在 Worker RPC 与宿主 UI 两个边界重复校验。
- 设置持久化使用 `__mdv_settings_v1__:` 宿主命名空间，与普通 plugin storage 分离。
- 已保存的旧值若不再满足新版 Schema，会安全回退到默认值并写入诊断，而不是阻止插件启动。

## 错误隔离

- command / event / panel handler 单次异常继续隔离。
- 同一 Runtime 60 秒内累计 5 次 handler 异常时自动熔断。
- 熔断复用现有 fatal 生命周期：终止 Worker、清理 Contribution/Panel/Settings Schema、自动禁用插件。

## 示例

- `examples/plugins/settings-demo/`
- `examples/plugins/settings-demo.mdvplugin`

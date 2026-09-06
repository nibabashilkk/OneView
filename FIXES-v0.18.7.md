# v0.18.7 — Plugin Safe Mode / Startup Recovery / Shortcut Conflict Policy

## 1. 启动恢复 Guard

插件 registry v4 新增 `safeMode`、`startupInProgress`、`startupPluginId` 和 `recoveryCount`。宿主在自动加载第三方 Runtime 前先持久化 Guard；正常完成后清除。如果进程在 Guard 生命周期内异常中断，下一次启动会自动设置 `safeMode=true`。

安全模式只暂停 Runtime，不修改 `enabled`、`grantedPermissions` 或 `plugin-data`，所以恢复操作可逆。

## 2. Safe Mode Application Flow

`PluginManager` 新增 `setSafeMode()`，所有进入/退出动作统一走 lifecycle coordinator：进入时 unload 当前 Runtime；退出时 reconcile 已启用插件。开发插件、正式插件、Contribution、Panel、Settings Schema 都复用同一条 cleanup/load 路径。

## 3. 快捷键冲突策略

新增纯 Application Policy `shortcut-policy.ts`。内置快捷键始终保留；插件命令与内置冲突，或多个插件占用同一快捷键时，冲突快捷键不会绑定，但对应命令仍在 Cmd/Ctrl+K 中可执行。

不使用“第一个加载的插件赢”，避免启动顺序变成不可见业务规则。

## 4. UI

“设置 → 插件”增加安全模式卡片以及快捷键冲突提示。检测到上次插件启动阶段异常中断时，会提示最佳努力记录到的插件 id。

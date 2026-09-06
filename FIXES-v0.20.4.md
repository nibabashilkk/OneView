# v0.20.4 — Plugin IPC Contract

## 问题

卸载插件时可能出现：

```text
invalid args `removeData` for command `uninstall_plugin`: invalid type: map, expected a boolean
```

## 根因

插件 command 过去直接暴露多个顶层 Tauri 参数，例如 `id`、`removeData`。前后端在重构或混合构建后只要参数形状发生漂移，错误会直接落到 Tauri 顶层参数反序列化，难以定位。

## 修复

所有带参数的插件 IPC 统一为：

```text
invoke(command, { request: { ... } })
```

Rust command 只接一个专用 Request DTO；DTO 使用 camelCase 映射并拒绝未知字段。前端使用类型化 command/request map，不再直接拼 invoke 参数。

## 回归边界

- `removeData` 必须为 primitive boolean。
- 错误对象/map 会被明确拒绝。
- 未声明字段会被拒绝。
- 插件所有 mutation/storage IPC 使用同一契约，避免同类问题散落复发。

# v0.20.0 — Plugin Runtime 重构

## 为什么不是继续 hotfix

v0.19 hotfix3 去掉了 `Function(pluginSource)`，解决了严格 CSP 下的直接崩溃，但当时 Host bootstrap 与第三方源码仍由一个大型 Blob Worker source 组织。v0.20 把加载、隔离、RPC、权限、校验和生命周期重新划分为稳定组件，后续增加 Plugin API 能力不再继续堆条件分支。

## 新结构

```text
PluginManager
  -> PluginRuntimeFactory
     -> DocumentPluginRuntime | ExtensionPluginRuntime
        -> WorkerRuntimeTransport
           -> plugin-host.worker.ts (trusted/static)
              -> Sandbox Worker
                 -> plugin-sandbox-bootstrap.js
                 -> plugin main.js
```

Host API 请求单独进入 `PluginHostApiRouter -> PluginPermissionGuard -> PluginHostServices`。

## Runtime 边界

- `document`：零权限、必须贡献 `documentFormats`、只允许 render/unload 消息。
- `extension`：不允许贡献 `documentFormats`；能力必须显式 permission + Host-side guard。
- v0.19 零权限文档插件兼容推断为 Document Runtime。
- Markdown / Plain Text Core 永远不经过插件 Runtime。

## 安全

- 保持严格 CSP，不增加 `unsafe-eval`。
- Trusted Host 是 Vite 静态模块 Worker，不再动态拼装 Host 代码。
- Sandbox 禁止常见网络/嵌套 Worker/后续 importScripts/动态代码/字符串定时器入口。
- 插件 HTML 仍经过宿主 sanitizer。
- 明确 Worker/CSP 不是 OS 级安全沙箱，详见 `docs/PLUGIN_SECURITY.md`。

## 官方插件

Developer Pack、JSON/YAML/TOML/CSV/LOG/DIFF Viewer 升级至 1.1.0，最低 App 版本 0.20.0。

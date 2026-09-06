# Plugin Security Model — v0.21

## Boundary

`.mdvplugin` 有两种完全不同的信任路径：

```text
Declarative contribution (Theme)
  Rust path/schema validation -> TypeScript schema validation -> CSS variables
  no JavaScript / no Worker / no permissions

Worker contribution (Document / Extension)
  Main WebView -> trusted plugin-host.worker.ts -> disposable Sandbox Worker
                                         -> third-party main.js
```

Worker 隔离是 WebView 进程内的 capability/failure boundary，不宣称是 OS 级安全沙箱。第三方代码拿不到 Tauri `invoke`、宿主 DOM、Svelte store、ProseMirror 对象或原生 handle。

## Declarative Theme security

Theme Plugin 没有 runtime 时必须零权限，也不能贡献 document format。Rust 会检查：

- manifest theme id/family/variant/scope/path；
- Theme JSON `schemaVersion=1`；
- JSON 与 manifest 的 id/family/variant/scope 完全一致；
- token key 必须属于固定 App/Reader/Syntax schema，且只能落在声明 scope；
- required token 完整、值长度/控制字符受限、文件大小受限；
- 所有声明路径必须是插件根内相对路径；开发目录实际文件 canonicalize 后仍必须位于 root 内，防止 symlink escape；
- 同 family Light/Dark scope 一致，variant 唯一。

只有通过验证的 token 会进入 Theme Registry 与 Theme Bootstrap Cache。Cache 只保存字符串 token 快照，不保存或执行插件代码。

## Worker roles

### Document

- `runtime.role=document`；
- permissions 必须为空；
- 至少一个 `contributes.documentFormats`；
- 只暴露文档 render/unload 生命周期。

### Extension

Extension 只能使用 manifest permissions 明确声明的 Host API。每个 Host RPC 都经过 `PluginPermissionGuard` 再进入稳定 Host Service；Extension 不能贡献 document format。

## Sandbox defense in depth

应用保持严格 CSP，不加入 `unsafe-eval`。Sandbox bootstrap 会阻断常见网络、嵌套 Worker、动态代码、进一步 `importScripts`、字符串定时器等旁路。Worker 启动/渲染均有 timeout，异常进入结构化 diagnostics/circuit breaker。

## Atomic install/update

安装和更新先在 staging 解包并完成 manifest/声明文件验证，再通过目录 rename 替换正式版本。Theme Registry 不会观察到半安装状态，因此更新主题不会因为中间文件缺失而 fallback/闪烁。

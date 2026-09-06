# System Integration — v0.21.6

## Windows

### File open / Default Apps

Windows 安装器注册 oneView 到 `RegisteredApplications` / `Capabilities\FileAssociations`，让 Windows 11 的“默认应用”页面识别 oneView。应用不直接写 `UserChoice`；用户通过系统设置决定默认程序。

### Explorer context menu

通过 `SystemFileAssociations` 注册 secondary verbs，不依赖用户当前的 Markdown 默认应用：

```text
--copy-rich
--export-html
--print
```

第二实例通过 Tauri single-instance 把动作转发给已存在的主程序，再复用已有 AppCommand / Service。

### Packaging

Windows bundle 使用 Tauri + NSIS。v0.21.6 已完全移除 Explorer Preview Handler，因此不再构建或注册 COM Preview DLL，也不再需要项目自己的 CMake/Preview Handler 构建步骤。

`src-tauri/windows/hooks.nsh` 只负责右键动作与 Default Apps 元数据的安装/卸载生命周期。

CI 当前仍以 `x86_64-pc-windows-msvc` 为正式 Windows 构建目标；这是发布矩阵选择，不再是 Preview Handler 的架构限制。

## macOS

macOS 只保留主应用集成：

- 文件关联与“打开方式”入口；
- Finder 双击/拖拽/命令行文件打开；
- Finder 中显示当前文件位置；
- `.app/.dmg` 正常签名与 notarization。

`DefaultAppService` 使用 AppKit `NSWorkspace` + `UTType` 查询/设置用户明确选择的默认处理程序。安装阶段只声明 `LSHandlerRank=Alternate`，不主动抢占系统默认。

## Shared rule

系统集成只作为 Adapter：

```text
OS shell / file association
       ↓
platform adapter
       ↓
existing AppCommand / Service
```

平台层不重新实现 Markdown parser、Lossless 判断或业务命令。

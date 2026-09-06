# v0.19.0 hotfix2 — 主窗口尺寸/位置持久化

## 问题

应用窗口虽然可拖拽调整大小，但退出后没有保存窗口状态；下次启动仍使用 `tauri.conf.json` / `tauri.macos.conf.json` 中的默认 `980 × 720`。

## 根因

项目此前没有接入任何窗口状态持久化逻辑。`UserSettings` 中的 `contentWidth` 只控制 Markdown 正文宽度，与原生 App 窗口宽度无关。

## 修复

接入 Tauri 官方 `tauri-plugin-window-state`，仅持久化主窗口的：

- SIZE：宽度和高度
- POSITION：窗口位置
- MAXIMIZED：最大化状态

明确不保存：

- VISIBLE：避免上次隐藏导致下次不可见
- FULLSCREEN：避免意外恢复全屏
- DECORATIONS：窗口装饰继续由平台配置控制

插件仅追踪 `main` 窗口，未来辅助窗口不会污染主窗口状态。

## 行为

第一次运行本修复版仍会使用默认 `980 × 720`。用户调整窗口尺寸并正常退出后，下次启动恢复上次尺寸与位置。

窗口状态由 Tauri 插件写入应用配置目录的 `.window-state.json`。

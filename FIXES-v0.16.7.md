# v0.16.7 — macOS 关闭退出修复

## 根因

v0.16.6 在 `onCloseRequested` 中调用 `preventDefault()`，随后执行前端保存/确认流程并调用 Rust `app.exit(0)`。
`app.exit(0)` 退出过程中仍可能触发窗口关闭流程，而前端监听器仍存在，于是再次 `preventDefault()`；此时 `quitInProgress` 已为 true，第二次请求直接返回，最终表现为左上角红色 X 无法退出应用。

## 修复

Rust `quit_app` 现在先取得 `main` 窗口并调用 `destroy()`。Tauri 的 `destroy` 不会再次发出 `closeRequested`，因此不会重入前端拦截器。窗口销毁后再调用 `app.exit(0)` 退出应用。

前端现有的自动保存、未保存确认、工作区/设置持久化流程保持不变。

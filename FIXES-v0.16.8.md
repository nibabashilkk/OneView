# v0.16.8 — 原生关闭与退出生命周期重构

## 问题

v0.16.7 为了绕过 `closeRequested` 递归，使用了 `window.destroy()` 后再 `app.exit(0)`。它能强制结束进程，但把正常关闭变成了强制销毁，不符合 Tauri 的窗口生命周期最佳实践，也让窗口关闭与应用退出职责混在一起。

## 新实现

### 红色 X

- 无未保存文档：不调用 `preventDefault()`，直接放行原生关闭。
- 有 dirty 文档：只阻止当前这一次关闭，执行自动保存 / 放弃更改确认。
- 允许关闭后设置一次性 bypass，并调用 `window.close()`；第二个 `CloseRequested` 不再阻止。
- 主窗口真正触发 `Destroyed` 后，Rust 再退出单窗口应用。

### Cmd+Q / 菜单退出 / 系统退出

- 全部进入 Tauri `RunEvent::ExitRequested`。
- Rust `ExitCoordinator` 第一次阻止退出并向 WebView 发送 `app://exit-requested`。
- 前端执行与窗口关闭相同的 `runDocumentCloseGuard()`。
- 用户确认后 `confirm_app_exit` 授权下一次 ExitRequested；用户取消则回到 IDLE。

## 删除的旧路径

- `quit_app`
- `window.destroy()`
- 红色 X 无条件 `event.preventDefault()`

因此正常窗口关闭和应用退出都有明确、互不递归的生命周期边界。

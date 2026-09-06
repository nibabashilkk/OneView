# v0.16.9 — macOS 红色关闭按钮根因修复

## 根因

Tauri 2 的 JavaScript `Window.onCloseRequested()` 不是一个纯观察型监听器。只要存在 JS close listener，Rust window manager 会先 `prevent_close()`；随后 JS helper 执行回调，如果回调没有 `preventDefault()`，helper 会调用 `destroy()`。

v0.16.8 又在这个 helper 上叠加了自己的 close bypass、`window.close()`、`WindowEvent::Destroyed` 和 app-level `ExitCoordinator`，使“红色 X = 退出整个单窗口应用”的路径过于复杂。

## 新实现

```text
red X
  → Rust WindowEvent::CloseRequested
  → prevent_close()
  → app://exit-requested
  → runDocumentCloseGuard()
  → persistSessionBeforeExit()
  → confirm_app_exit
  → AUTHORIZED
  → AppHandle::exit(0)
```

前端不再监听 Tauri `onCloseRequested`，因此没有 JS helper 的自动 `destroy()`，也不再需要二次 `window.close()` 或 bypass flag。

## 取消退出

用户拒绝丢弃未保存内容时调用 `cancel_app_exit`，状态从 WAITING_FOR_FRONTEND 回到 IDLE，窗口保持不变。

## 兜底

如果窗口在 frontend guard 安装之前就被销毁，`WindowEvent::Destroyed` 仍会结束这个单窗口应用。

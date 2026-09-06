# v0.18.2 — Stable Editor API + Plugin Event Bus

这一版不把 ProseMirror / Svelte Store 暴露给第三方插件，而是在既有 Ports & Adapters 插件底座上增加两个稳定能力边界。

## Editor Port

新增 `EditorSessionRegistry`。WYSIWYG 编辑器挂载时只注册一个稳定 controller：

- `getDocument()`
- `getSelection()`
- `replaceSelection(text)`
- `insertText(text)`

Plugin Host 只依赖这个 Port；第三方插件看不到 `EditorView`、Transaction、Node、DOM selection。

权限：

- `editor.read`
- `editor.write`

## Event Adapter

新增 `PluginEventBridge`，把宿主 workspace/editor/session 变化翻译成稳定事件：

- `workspace.fileOpened`
- `workspace.fileClosed`
- `workspace.activeFileChanged`
- `editor.changed`
- `editor.selectionChanged`

插件必须声明 `events`，并通过 `ctx.events.on(name, handler)` 显式订阅。Runtime 只把已订阅事件发给对应 Worker。

`editor.changed` 不广播完整 source；`selectionChanged` 40ms 合并并只发 `empty/textLength`，减少快速输入/移动光标时的消息压力。

## Safety

- 编辑器读取上限：完整 source 2,000,000 字符；选区 512,000 字符。
- 单次编辑器写入上限：512,000 字符。
- Event handler 异常只记录到 Diagnostics，不杀死整个插件。
- 非法事件名/未声明 `events` 的订阅在 Runtime capability gate 处拒绝。

## Example

新增 `examples/plugins/editor-tools`，验证 Editor API、Event API、命令贡献和 disposer 清理。

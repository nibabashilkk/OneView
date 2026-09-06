# Editor Tools plugin

v0.18.2 Plugin API 示例，验证以下能力：

- `ctx.editor.getDocument()`
- `ctx.editor.getSelection()`
- `ctx.editor.replaceSelection()`
- `ctx.events.on(...)`
- 插件卸载时 disposer 清理

开发时可在“设置 → 插件 → 插件开发”直接加载当前目录。

打包：

```bash
cd examples/plugins/editor-tools
zip -r ../editor-tools.mdvplugin manifest.json main.js README.md
```

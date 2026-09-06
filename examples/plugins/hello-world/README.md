# Hello World plugin

这是 v0.18.0 Plugin API 的最小示例。

打包时必须让 `manifest.json` 位于 ZIP 根目录：

```bash
cd examples/plugins/hello-world
zip -r ../hello-world.mdvplugin manifest.json main.js
```

然后在 oneView：设置 → 插件 → 从本地安装，选择生成的 `.mdvplugin`。


## 开发目录模式

在 oneView v0.18.1+ 中，可以直接在“设置 → 插件 → 插件开发”选择当前 `hello-world/` 目录。修改 `main.js` 后点插件卡片的“重新加载”，不需要重新打包。

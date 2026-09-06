# LOG Viewer

日志行号与 ERROR/WARN/INFO/DEBUG/TRACE 语义分层。

这是 oneView v0.21+ 的官方 Document Plugin。零权限运行，解析与渲染逻辑进入独立 Sandbox Worker，不进入 Markdown Core 或 Extension Runtime。

支持格式：
- LOG: .log

安装：设置 → 插件 → 从本地安装 → 选择对应 `.mdvplugin`。安装后默认关闭，手动启用即可。

源码目录：`official-plugins/log-viewer`

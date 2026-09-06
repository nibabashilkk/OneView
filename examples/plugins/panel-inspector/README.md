# Panel Inspector

用于验证 v0.18.4 的插件 Panel API：

- `ctx.ui.registerPanel()` 注册沙箱侧边面板；
- 插件 Worker 与面板 iframe 通过受控消息桥通信；
- 面板 iframe 使用 CSP + `sandbox="allow-scripts"`，不能访问宿主 DOM、Tauri、网络或文件系统；
- `ctx.events` 驱动面板内容刷新。

安装后打开命令面板，运行“Panel Inspector：打开文档检查器”。

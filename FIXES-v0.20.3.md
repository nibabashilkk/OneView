# v0.20.3 Finder 冷启动文件打开修复

## 问题

macOS 将 Markdown Viewer 设为 `.md` 打开方式后，如果应用未运行，从 Finder 双击 Markdown 会先启动到首页；再次双击同一文件后才会正常打开。

## 根因

macOS 文件关联通过 Tauri `RunEvent::Opened` 交付 URL。冷启动时该事件可能早于 WebView 的 JavaScript 监听器。旧实现虽然有 Rust startup queue，但队列在 `setup` 中才注册，同时前端事件监听器会直接消费 queue，导致冷启动与 Workspace restore 存在生命周期竞争。

## 修复

1. `StartupFileQueue` 与 `StartupSystemActionQueue` 改为 `Builder.manage(...)`，在 setup / WebView 之前创建。
2. Rust 始终遵循 `enqueue -> emit wake-up event`，queue 是唯一事实来源。
3. 前端新增 `ExternalOpenCoordinator`，在设置、插件和 Workspace 恢复完成前只记录 wake-up，不消费文件。
4. bootstrap 完成后统一 drain Rust queue；运行期 Finder 双击和 single-instance 也复用同一 drain。
5. drain 串行化，新的系统打开请求不会与正在进行的文件加载并发。

## 预期行为

- App 未运行：Finder 双击 `.md` -> 启动后直接打开该文档。
- App 已运行：Finder 双击另一个 `.md` -> 窗口获得焦点并打开/切换到该文档。
- 启动恢复旧 Workspace + 同时双击新文件：先恢复 Workspace，再把外部文件作为最后激活 Tab 打开。

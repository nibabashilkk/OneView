## v0.21.11

- GitHub Actions 的 macOS 发布暂时固定使用 ad-hoc signing，不再读取或导入 Apple Developer 证书。
- 移除 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID` 的发布环境映射。
- 删除临时 keychain / `security import` 证书导入步骤，避免无有效 `.p12` 时在 bundle 阶段失败。
- 当前 macOS DMG 适合测试和手动分发；正式商业发行前再接入 Developer ID + notarization。
- 产品版本统一升级至 `0.21.11`。

# Changelog

## v0.21.10

- 新增正式源码许可证：`PolyForm-Noncommercial-1.0.0`，明确 oneView 当前为 source-available / 非商业授权，而不是 MIT/Apache 等宽松开源许可。
- `package.json` 与所有内部 Rust crate 写入 SPDX license metadata，避免发布与构建元数据对授权状态表述不一致。
- README 新增“许可证与商业使用”章节，明确个人/非商业用途、商业授权边界、品牌权利和第三方依赖许可。
- 新增 `CONTRIBUTING.md` 贡献者授权条款，为未来商业版、双许可证和再许可保留必要权利，同时不转移贡献者自身版权。
- 产品版本统一升级至 `0.21.10`。

## v0.21.9

- 产品品牌正式改为 **oneView**；窗口、菜单、关于页、默认应用系统集成与 GitHub Release 名称统一更新。
- 新增正式 Soft UI App Icon，并生成 Tauri 所需 32/128/256/1024 PNG、Windows ICO 与 macOS ICNS。
- 首页使用真实 oneView 图标替代旧 `M` 占位标识；关于页同步展示正式图标。
- 产品描述从 Markdown-first 收敛为“轻量多格式文件查看器”，Markdown 继续作为内置核心格式，其他开发文件由插件扩展。
- 保留既有 bundle identifier、`markdownViewer` Plugin API 与官方插件 ID，避免品牌改名造成用户数据和插件兼容性破坏。

## v0.21.8

- 发布体系从 CNB 切换为 GitHub Actions，不再需要 Windows/macOS 自托管 Runner。
- 新增正式 `release.yml`：Tag push 自动并行构建 Windows x64 NSIS、macOS Universal DMG、Linux AppImage/deb，并发布到 GitHub Release。
- 新增 `ci.yml`：普通 push / PR 自动运行 Svelte/TypeScript、Vite build 与 Rust Core 检查。
- macOS 无证书时使用 ad-hoc signing；正式 Apple 签名/公证保持可选 Secrets。
- 发布完成后自动生成并上传 `SHA256SUMS.txt`。
- 删除 CNB 配置、OpenAPI 上传脚本和专用文档，避免维护两套发布系统。

## v0.21.7

- 新增 CNB 多平台自动发布：Tag push 自动创建 Release，并并行构建 Windows x64、macOS Universal 与 Linux x64。
- Windows/macOS 使用根组织自托管 Runner；Linux 使用 CNB 官方 amd64 Runner。
- Windows/macOS Release 附件通过 Node 脚本直接调用 CNB OpenAPI 上传，不要求自托管机器安装 Docker。
- 新增 Tag/版本一致性校验、Release Notes 生成、跨平台产物标准化命名与 SHA256 生成。
- 新增 `docs/CNB_RELEASE.md`，记录 Runner 标签、依赖和发布流程。

## v0.21.6

- 完全移除 Windows Explorer Preview Handler；产品不再提供 Explorer Preview Pane 集成。
- 删除 `platform/windows-preview/`、`crates/preview-core/`、`tools/preview-renderer/` 与 `docs/SYSTEM_PREVIEW.md`。
- Windows Tauri bundle 删除 Preview DLL 的 `beforeBundleCommand` 与 resource 注入，不再运行项目级 CMake。
- NSIS hooks 删除 COM CLSID、PreviewHandlers 和 `shellex` 注册/卸载，只保留 Explorer 右键动作与 Default Apps。
- Cargo workspace 删除 preview-only crates；CI 当前仍构建 x86_64，但不再存在 Preview Handler 的架构锁定。

## v0.21.5

- macOS `Open With` 增加 JSON / YAML / TOML / CSV / LOG / DIFF/PATCH 候选关联。
- 开发文本格式统一使用 `LSHandlerRank=Alternate` 语义，不在安装时抢默认应用。
- macOS 设置页可查看并主动设置这些格式的默认应用；Windows 继续只管理 Markdown。
- Document Plugin 未启用时继续使用 Plain Text fallback，因此系统候选关联与插件运行时能力解耦。
- `src-tauri/Cargo.toml` 应用版本重新与 Tauri/package 版本统一。

## v0.21.4

- 移除独立 Reader Profile / `readerTheme` 设置；GitHub / Paper / Minimal / Sepia 不再作为第二套视觉系统存在。
- Theme Platform 成为 Reader 视觉的唯一来源：正文、标题、链接、引用、代码块、选区和 Syntax 全部消费当前 Theme 的 Reader / Syntax Semantic Token。
- “阅读”设置只保留排版偏好：字体、字号、行高、正文宽度和代码字号；老 v4 settings 中的 `readerTheme` 字段升级后安全忽略。
- Settings 的“应用主题”改为“主题”，主题卡同时预览 App surface 与 Reader surface，明确一套主题覆盖 App / Reader / Syntax。

## v0.21.3

- Settings / Plugin Center 改用自适应桌面 UI 字号阶梯，正常窗口下不再出现 7.5–10px 的主要说明文字。
- 新增 `--ui-font-micro/caption/control/body/section/title`，通过 `clamp() + vmin` 在可读性下限和桌面上限之间平滑变化。
- macOS / Windows UI 字体改为系统字体优先：San Francisco / PingFang SC 与 Segoe UI Variable Text。
- 插件展开后的设置、诊断、快捷键冲突和状态信息同步使用同一字号体系；小窗口通过压缩间距而不是缩小到不可读字号。

## v0.21.2

- 修复滚动条出现/消失时内容区域宽度变化造成的“窗口忽大忽小”视觉抖动。
- Reader、编辑器、Settings、Plugin Center、Workspace 与通用 `overflow-auto` 容器统一使用稳定 scrollbar gutter。
- 保持滚动条按需显示，不通过永久显示滚动条来换取稳定布局。

## v0.21.1

- 首页重构为任务型工作台，主操作、最近项目 / 文件和快捷工具分层展示。
- TopBar 新增命令面板、插件中心直接入口。
- Workspace 侧栏重构项目头、模式切换、文件过滤、跨文件搜索与空状态。
- Settings 新增关键词搜索、分类描述、应用 / 阅读主题缩略预览和“已使用”状态。
- Plugin Center 新增搜索、分类计数、友好插件类型 / 状态展示，并降低安全模型与开发信息的视觉优先级。
- 提升设置、插件中心、侧栏和首页的字号、间距、热区与响应式布局。

## v0.21.0

- Plugin Platform 改为 contribution-first：Theme / Document / Extension 共用生命周期与 Plugin Center。
- 新 manifest 使用可选 `runtime: { kind: "worker", role, main }`；兼容 v0.20 字符串 runtime。
- 新增纯声明式 Theme Plugin，0 JS / 0 Worker / 0 permission。
- App / Reader / Syntax 27 个 Semantic Token 接入应用 CSS、WYSIWYG/Reader 与导出。
- Settings 动态读取 Theme Registry；Plugin Center 新增全部 / 文档 / 主题 / 扩展筛选。
- Safe Mode 只暂停 Worker，主题贡献继续工作。
- Theme Bootstrap Cache 接入首帧；主题安装/升级继续使用 atomic replace。
- Rust 新增主题 JSON/schema/scope/token/path/size 校验与开发目录 symlink 越界防御；同 family Light/Dark 要求相同 scope 且 variant 唯一。
- 官方 Document Plugins 升级到 v1.2.0 descriptor；新增官方 Slate Theme。

## v0.20.9

- 设置与插件中心改为常驻 DOM 的 Persistent Modal Layer，关闭不再销毁全屏合成层。
- 移除这两个一级面板的全屏 backdrop blur，规避 WKWebView 关闭浮层时的 compositor flash。
- 遮罩改为 background-color 过渡；窗口动画限制在局部 opacity / transform。
- 关闭状态通过 inert / aria-hidden / pointer-events 禁止交互。

## v0.20.8

- 修复主页面动画造成的闪白/闪黑：Markdown、WYSIWYG、首页不再从透明度 0 入场。
- Home / 文档 / 编辑模式共用持久化 content stage，切换时不再暴露 WebView backing surface。
- 冷启动增加渲染门：设置、插件、Workspace 与原生打开请求恢复完成前不渲染首页。
- 新增首帧主题预加载，避免深色模式先绘制浅色背景。
- 大弹层/菜单仍保留克制的透明度动画；主内容只使用 1–2px transform settle。


## v0.20.7

- 新增统一 Motion System，集中管理窗口、面板、弹层、菜单、侧栏、Tab、Toast 和内容切换动画。
- 设置 / 插件中心等模态窗口采用轻微 translate + scale + opacity，打开和关闭都保留过渡。
- Workspace / Outline / Plugin Drawer 增加横向进入退出与可见宽度收放，减少主布局跳变。
- 新建/关闭 Tab、打开搜索、更多菜单、右键菜单和状态栏增加短时过渡。
- 首次 App 内容挂载增加轻量淡入；支持 `prefers-reduced-motion`。

## v0.20.6

- 重做 macOS 标题栏侧栏切换按钮，对齐参考应用的尺寸、留白和图标几何。
- 侧栏控制位由 28×28 调整为 36×40，SVG 提升至 24px（可见外框约 18×18px），并重新对齐首个 Tab。



## v0.20.5

- 设置中心重构为现代化分类面板：通用 / 阅读 / 编辑 / 系统，减少长说明和重复信息。
- 插件系统从设置中完全拆出，新增独立“插件中心”一级面板。
- 顶部更多菜单、命令面板和原生菜单统一提供“插件中心”入口。
- 插件中心使用更宽的独立管理界面，集中展示安装、启停、安全模式、权限、快捷键、设置与诊断。
- 设置与插件中心支持点击遮罩和 Escape 关闭。

## v0.20.4

- 修复插件卸载 IPC 参数错误：`removeData` 不再作为松散的顶层 command 参数传递。
- 插件 IPC 统一使用单一 `request` DTO，Rust 通过 `serde(rename_all = "camelCase", deny_unknown_fields)` 明确反序列化边界。
- 安装、开发目录链接、卸载、启停、安全模式、快捷键覆盖、Bundle 读取和插件 Storage 命令全部迁移到相同契约。
- 前端新增类型化 `plugin-ipc.ts`，每个 command 的 request 形状在 TypeScript 编译期校验。
- Rust 新增 IPC DTO 回归测试，覆盖 `removeData` boolean、错误 map 类型以及未知字段拒绝。

## v0.20.3

- 修复 macOS 从 Finder 双击 Markdown 冷启动时只进入首页、需要第二次双击才打开文件的问题。
- `StartupFileQueue / StartupSystemActionQueue` 提前到 `Builder.manage(...)`，确保 WebView / setup 尚未完成时收到的 `RunEvent::Opened` 也会被持久排队。
- 新增 `ExternalOpenCoordinator`：系统 `Opened` / single-instance 事件只作为唤醒信号，文件路径统一从 Rust 队列消费；Workspace 恢复完成前绝不打开外部文件。
- 冷启动和运行期双击统一为同一个串行 drain，避免事件丢失、重复消费以及与 Workspace 恢复并发。
- macOS 收到 `RunEvent::Opened` 后统一恢复、显示并聚焦主窗口。

## v0.20.2

- 顶部标题栏正式区分 `home` / `document` 两种模式，不再让首页复用文档工具栏。
- 首页隐藏侧栏切换、文档标签、`+` 打开文件、搜索以及插件工具按钮；打开文档或工作区后才显示。
- 首页右侧仅保留一个全局“更多”入口，菜单只包含“设置 / 切换明暗主题”。
- “打开文件 / 打开文件夹”在首页只由主 CTA 和最近记录承载，避免顶部重复入口。

## v0.20.1

- 默认主窗口初始化宽度从 `980` 调整为 `860`，高度保持 `720`。
- macOS 平台覆盖配置同步使用 `860`，避免平台配置重新覆盖通用默认宽度。
- 窗口状态持久化逻辑保持不变：已有窗口状态优先恢复，本次默认值只用于首次启动或无历史状态场景。

## v0.20.0

- Plugin Runtime 重构为 static Host Worker + disposable Sandbox Worker。
- 插件分为 `runtime=document` 与 `runtime=extension`，Document Runtime 强制零权限。
- PluginManager 使用 `DocumentPluginRuntime | ExtensionPluginRuntime` 类型分流。
- Host API RPC、Permission Guard、Transport、Validation 从单体 Worker Runtime 中拆分。
- CSP 继续不启用 `unsafe-eval`；补充动态代码与网络旁路防御。
- 官方 Document Plugins / Developer Pack 升级至 1.1.0。
- 新增 `docs/PLUGIN_SECURITY.md` 与 Runtime manifest Rust 回归测试。

## v0.19.0 hotfix3

- 修复 macOS/Tauri 严格 CSP 下插件 Worker 启动失败：不再使用 `Function(pluginSource)()` 动态执行 `.mdvplugin` 主脚本。
- 插件源码现在作为同一个 Blob Worker 的普通脚本源码追加执行，继续保留 Dedicated Worker、网络 API 禁用和宿主 RPC 隔离，不需要开启 `unsafe-eval`。
- 改进 Worker 错误诊断，运行时错误会携带 stack / filename / line / column；语法错误仍由宿主 Worker `error` 事件捕获。
- 增加 fatal 去重，避免同一个 Worker 异常被重复上报。

## v0.19.0 hotfix2

- 修复主窗口宽度/高度、位置和最大化状态无法在重启后恢复的问题。
- 使用 Tauri 官方 window-state 插件，只持久化 main 窗口的 SIZE / POSITION / MAXIMIZED。

## v0.19.0

- Repositioned the app as Markdown-first: Markdown remains the only built-in rich document format.
- Removed `structured-core` from the desktop dependency graph and moved JSON/YAML/TOML/CSV/LOG/DIFF rendering into optional official plugins.
- Added declarative `manifest.contributes.documentFormats` and a Worker RPC for plugin-owned document rendering.
- Added host-side allowlist sanitization for plugin renderer HTML before it reaches the viewer DOM.
- Workspace scanning/search now receives active plugin format specs dynamically instead of hard-coding developer extensions in Rust.
- Reduced macOS/Windows default file associations to Markdown only; optional plugins do not silently change OS defaults.
- File-open discovery and Workspace no longer hard-code developer extensions; only active plugin contributions add them. Plugin renderer failures still fall back to safe plaintext for an already-routed document.
- Added six standalone official format plugins plus a combined `Developer Pack`, generated by `scripts/build-official-plugins.py`.

## v0.18.8

- Added host-owned plugin shortcut overrides with persistent custom/disabled states in registry schema v5.
- Added `PluginShortcutRegistry` so runtime command declarations stay immutable while the host derives effective shortcuts.
- Added a shortcut recorder UI in Plugin Settings with per-command custom binding, disable and restore-default actions.
- Custom assignments are validated before persistence; built-in shortcuts and already-used plugin shortcuts cannot be silently stolen.
- Fixed shortcut identity canonicalization so explicit `Ctrl+...` is no longer collapsed into `Mod+...` during conflict detection.
- Shortcut overrides survive plugin reload/update and are removed when the plugin is uninstalled.

## v0.18.7

- Added persistent plugin safe mode that pauses third-party runtimes without changing enable flags, permission grants or plugin data.
- Added a persisted startup guard: an incomplete automatic plugin-start phase forces safe mode on the next launch and records the best-effort interrupted plugin id.
- Added host-controlled recovery actions in Plugin Settings; leaving safe mode reconciles enabled plugins through the normal lifecycle coordinator.
- Added deterministic shortcut conflict policy. Built-in shortcuts always win; plugin-vs-plugin collisions disable all colliding shortcuts rather than depending on runtime load order.
- Plugin Settings now surfaces shortcut conflicts and their owners while keeping the underlying commands available from the Command Palette.
- Upgraded the plugin registry schema to v4 with backward-compatible defaults for safe-mode/recovery fields.
- Added `examples/plugins/shortcut-conflict-demo.mdvplugin` for deterministic shortcut-policy verification.

## v0.18.6

- Added session-scoped `PluginDiagnosticsRegistry` with bounded structured entries and per-plugin health snapshots.
- Plugin settings now surface healthy/degraded/faulted state, recent/session error counts, circuit-breaker trips and the latest structured incidents.
- Runtime command/event/panel failures report typed diagnostics while preserving the existing isolation and 60-second circuit-breaker policy.
- Fault transitions are de-duplicated when Worker `onFatal` and startup rejection represent the same incident.
- Invalid persisted plugin-setting values now also appear as structured settings diagnostics.
- Fixed global diagnostics source typing for `plugins` and `plugin:<id>` producers.
- Added `examples/plugins/diagnostics-demo.mdvplugin`.

## v0.18.5

- Added schema-driven plugin settings with a dedicated `settings` permission.
- Added `ctx.settings.register/get/set/onChanged` and host-rendered boolean/text/number/select controls.
- Added `PluginSettingsRegistry` plus shared host-side setting value validation and namespaced persistence.
- Host settings changes are delivered back to the owning Worker without exposing Svelte stores or DOM.
- Invalid persisted setting values fall back to schema defaults instead of breaking plugin startup.
- Added runtime circuit breaker: 5 command/event/panel handler failures within 60 seconds automatically terminate and disable the plugin.
- Added installable `examples/plugins/settings-demo.mdvplugin`.

## v0.18.4

- 新增 `ctx.ui.registerPanel()` 沙箱侧边面板 API。
- 面板 HTML 只运行在 `sandbox=allow-scripts` 的独立 iframe 中，不进入宿主 DOM。
- 面板注入严格 CSP：禁用网络、对象、子 frame、表单提交与外部资源。
- 新增 Worker ↔ Panel 双向消息桥，面板只通过 `markdownViewerPanel` 与所属插件 Worker 通信。
- 新增 `PluginPanelMessageBus`，把瞬时面板消息从 Svelte store / PluginManager 状态中分离。
- 新增 `ui.panel` 独立权限、面板数量与 HTML/CSS 大小限制。
- 插件面板默认以右侧浮层打开，不挤压正文；多个面板使用紧凑标签切换。
- 命令面板自动加入“打开面板”命令。
- 新增 `examples/plugins/panel-inspector` 示例。

# 0.18.3

- Plugin Contribution Registry：状态栏、右键菜单、顶部工具入口与插件快捷键。
- `ui.contribute` 权限与受控声明式可见条件。

## v0.18.2

- Added stable Editor API v1 capabilities without exposing ProseMirror: `editor.getDocument`, `editor.getSelection`, `editor.replaceSelection`, and `editor.insertText`.
- Added permission-gated Event API with typed `workspace.*` and `editor.*` events.
- Added `EditorSessionRegistry` as the host-side editor Port so plugins depend on stable text operations rather than `EditorView` or DOM internals.
- Added a Svelte/editor event adapter that translates workspace/editor state changes into plugin event DTOs; editor selection events are coalesced to avoid high-frequency Worker traffic.
- Added per-runtime event subscription tracking, handler error isolation, and read/write size guards for editor RPC.
- Added `docs/PLUGIN_API_V1.d.ts` event/editor typings and an `examples/plugins/editor-tools` reference plugin.

## v0.18.1

- Added unpacked development-plugin linking without copying source files.
- Added manual development-plugin reload and source badges/path display.
- Added explicit `PluginSource` to the plugin domain model.
- Upgraded plugin registry to persist development links and granted permissions.
- Permission changes now disable plugins until the user explicitly re-authorizes them, preventing silent privilege expansion on update/reload.
- Removing a development plugin only removes the reference; source files are never deleted.

## v0.18.0

- Added the first real third-party plugin foundation instead of source-level editor hooks only.
- Plugin packages use `.mdvplugin` (ZIP) with root `manifest.json`; Rust validates IDs, versions, declared files, permissions, package size and ZIP paths before installation.
- Added persistent install / uninstall / enable / disable state and namespaced per-plugin storage.
- Third-party logic runs in a dedicated Web Worker, not inside the main Svelte/WebView context. Host capabilities are accessed only through postMessage RPC with permission checks.
- Plugin API v1 exposes commands, current-file metadata, notices, clipboard write and scoped storage; network, shell, arbitrary filesystem, DOM, ProseMirror and raw Tauri access are intentionally unavailable.
- Plugin commands participate in the existing Command Palette through a host-side contribution registry.
- Settings now includes a Plugin Manager with local install, permission review, runtime status, enable/disable and uninstall controls.
- Added `docs/PLUGIN_DEVELOPMENT.md` and an installable Hello World example plugin.

## v0.17.9

- WYSIWYG fenced code blocks now have real-time token syntax highlighting.
- Added code-language labels and one-click copy buttons.
- Shared the Highlight.js registry between preview and editor modes.
- Added editor-safe performance guard for very large code blocks.

## v0.17.8

- 修复 `structured-core` JSON semantic hints 单元测试中的 Rust raw string 分隔符错误。
- 颜色示例包含 `#ff8800` 时，`r#"..."#` 会被内部的 `"#` 提前终止；改为 `r##"..."##`。
- 该修复只影响编译/测试，不改变 JSON Explorer 的运行时展示逻辑。

## v0.17.7

- 重新设计 JSON Tree：更清晰的对象/数组层级、数量徽标、索引样式和缩进导线。
- JSON 默认展开两层，提供展开全部 / 收起全部操作。
- JSON 搜索会自动展开折叠分支，避免隐藏节点漏搜。
- URL / ISO 日期 / Hex 颜色增加轻量类型提示与颜色预览。
- 结构化查看器使用独立宽度与间距，不再受 Markdown Reader 版心限制。

## v0.17.6

- 修复 macOS Overlay 标题栏无法拖动窗口：显式开放 Tauri `startDragging` / `toggleMaximize` 权限。
- 顶栏空白区域、标签间隙和操作区间隙都可拖动；按钮、标签和菜单保持正常点击。
- 双击可拖动区域沿用 macOS 标题栏习惯切换最大化。

## v0.17.6

- 修复 JSON / YAML / TOML / CSV 因内容解析失败而整份文件无法打开的问题。
- 结构化格式现在采用“先打开、再诊断”：有效内容继续使用 Tree/Table Viewer，解析失败则保留原文并显示精确解析错误。
- 原文回退仍经过 HTML 转义，并保留语法高亮，不会把文件内容注入 WebView。


## v0.17.4

- 修复顶部“更多”菜单透明：更正 `.chrome-popover` 选择器误写，并改为稳定的不透明 surface 背景。
- `titlebar-more-popover` 显式使用实色背景与 opacity 1，避免 macOS titleBar Overlay / WKWebView 下正文透出。

## v0.17.3

- 将文档标签页合并到顶部标题栏，macOS 使用 overlay title bar，视觉结构更接近浏览器 / Obsidian 的顶部标签。
- 移除独立第二行 TabBar，释放正文纵向空间。
- 顶部操作精简：侧栏、标签、打开新文件、查找、更多。
- 最近打开、导出、显示位置、命令面板、设置和主题切换收敛到统一更多菜单。
- 删除旧 `TabBar.svelte`、`ExportMenu.svelte`、`RecentMenu.svelte` 死代码。

## v0.17.2

- 将主窗口默认尺寸从 `1120 × 760` 调整为 `980 × 720`。
- 保留现有最小窗口限制、可缩放行为和文档优先布局。

## v0.17.1

- Removed the user-facing Markdown source mode and raw source editor.
- Removed source-mode commands and keyboard shortcuts.
- Unsupported lossless structures now remain preview-only instead of falling back to source editing.
- WYSIWYG save guard now protects the original file without changing editor modes.

## v0.17.0

- Markdown 安全文档默认进入所见即所得，可视结果与编辑合并。
- 移除顶栏“阅读 / 编辑 / 源码”三段切换，改为单一源码辅助入口。
- 不支持无损 WYSIWYG 的 Markdown 保留安全预览 / 源码兜底。
- 单文档隐藏 TabBar，缩短 TopBar/StatusBar，收窄 Outline/Workspace 面板。
- Reader/WYSIWYG 去卡片化，统一连续正文画布。
- WYSIWYG 增加滚动恢复、阅读进度、活动标题跟踪与标题 DOM id，同步修复目录跳转。
- WYSIWYG 直接处理 Ctrl/Cmd+S，源码模式保留为高级入口。

## v0.16.9

- 修复 v0.16.8 在 macOS 上红色 X 仍可能无法结束应用的问题。
- 移除前端 `onCloseRequested` 监听器及其二次 `window.close()` 流程；Tauri 的 JS close helper 本身会在存在 listener 时先阻止 native close，并在 handler 放行后执行 `destroy()`，不再把它与应用退出状态机叠加。
- 主窗口红色 X 改由 Rust `WindowEvent::CloseRequested` + `CloseRequestApi::prevent_close()` 原生接管。
- 红色 X、Cmd+Q、菜单 Quit 共用一次 `app://exit-requested` 文档保护，确认后由 `confirm_app_exit` 授权 `AppHandle::exit(0)`。
- `Destroyed` 仅作为启动早期/意外销毁兜底。

## v0.16.8

- 重构窗口关闭与应用退出生命周期，撤销 v0.16.7 的 `window.destroy() + app.exit()` 强制退出路径。
- 红色关闭按钮在无 dirty 文档时不拦截；存在未保存内容时才 `preventDefault()`，异步保存/确认后通过正常 `window.close()` 再次进入并放行原生关闭。
- 新增 Rust `ExitCoordinator`，`Cmd+Q`、应用菜单退出、命令面板退出和系统退出统一通过 `RunEvent::ExitRequested`。
- 退出保护使用 IDLE / WAITING / AUTHORIZED / TERMINATING 状态机，避免递归 ExitRequested、重复确认框和“点 X 没反应”。
- 主窗口真正 `Destroyed` 后再触发应用退出，保持 Markdown Viewer 单窗口工具“关窗口即退出”的产品行为。

## v0.16.7

- 修复 macOS 左上角红色关闭按钮被自身 `closeRequested` 拦截器二次拦截、导致应用无法退出的问题。
- 退出流程仍先由前端处理自动保存/未保存确认；确认退出后，Rust 原生层先 `destroy()` 主窗口（不会再次触发 closeRequested），再 `app.exit(0)`。
- `Cmd+Q` 与红色关闭按钮继续复用同一套安全退出流程。

## v0.16.6

- 新增跨平台 `DefaultAppService`。
- macOS 使用 AppKit `NSWorkspace` / UniformTypeIdentifiers 查询与设置默认打开应用。
- Windows 使用 `AssocQueryStringW` 只读查询当前关联，并通过系统 `ms-settings:defaultapps` 让用户完成默认应用选择。
- NSIS 增加 `RegisteredApplications` / `Capabilities` 注册，Windows 11 可直达 Markdown Viewer 默认应用页。
- 增加 Markdown 上下文提示与 30 天“以后再说”策略。
- 设置页增加 Markdown、JSON、YAML、TOML、CSV、LOG、DIFF/PATCH 默认打开方式管理。
- Tauri 文件关联使用 `rank: Alternate`；Markdown 为 `Editor`。

## v0.16.5

- 移除 macOS Quick Look Preview Extension，不再构建或嵌入 `MarkdownQuickLook.appex`。
- 删除 `platform/macos-quicklook/` Xcode 工程、Swift bridge、构建/验证脚本与相关 entitlements。
- macOS Tauri bundle 不再执行 Quick Look `beforeBundleCommand`，普通 `.app/.dmg` 打包不再依赖 Xcode 扩展编译步骤。
- 保留主程序文件关联、双击打开、拖拽打开以及 Windows Explorer Preview Handler；`preview-core` 继续供 Windows 预览与 CLI 使用。
- 更新发布、系统集成与架构文档，避免继续把 Quick Look 作为当前能力。

## v0.16.4

## v0.16.4

- macOS 红色关闭按钮现在退出整个单窗口应用，而不是只关闭窗口后继续驻留 Dock。
- 红色关闭按钮与 Cmd+Q 统一走未保存文档保护；自动保存失败时仍会给出丢弃确认。
- 退出前工作区/设置持久化失败不会再让关闭动作失效。
- macOS“退出 Markdown Viewer”菜单改为受控应用命令，避免绕过未保存文档检查。


- 修复 macOS Quick Look 在 Xcode 26.x 下的 Swift 编译失败：`QLPreviewProvider` 的 `providePreview` 是协议实现，不再错误使用 `override`。
- Quick Look 深色判断改用 `NSAppearance.currentDrawing()`，避免依赖宿主应用的 `NSApp` 单例。
- 清理 `preview-core` 对 `pulldown_cmark::Event` 的不可达通配分支，去除 release 构建 warning。
- 保持 Quick Look 双架构（arm64/x86_64）构建与现有 Tauri bundle 集成不变。

## v0.16.2

- 修复进入 WYSIWYG 后因 `afterUpdate` + Markdown 序列化规范化形成的 ProseMirror/Svelte 重建循环，解决点击“编辑”后主线程卡死。
- WYSIWYG 改为 ProseMirror 挂载期间作为编辑真源，只对真正的外部 source 变化做一次同步；父组件回显不再重建 EditorState。
- 选区浮层状态写入改为幂等，减少无意义的 Svelte 更新。
- 最近打开与导出菜单统一为受控 Popover：点击外部、Esc、窗口失焦、执行菜单项都会收起。
- 打印/PDF 在弹层 DOM 移除后再调用系统打印，避免打印面板返回后弹层残留。
- 顶栏图标加入自定义延迟 Tooltip，macOS WKWebView 下不再依赖不稳定的原生 `title` 提示。

## v0.16.2

### macOS interaction fix

- 保持 v0.16 视觉不变，修复/规避 macOS WKWebView 下窗口控件可能出现的 hit-test 不响应问题。
- 所有 Svelte DOM 事件切回兼容性更稳的 `on:event` 绑定方式，避免事件属性/运行时版本组合造成交互失效。
- 常驻 TopBar / StatusBar 移除持续 backdrop-filter 合成层，弹出菜单仍保留模糊效果。
- 显式恢复应用壳、按钮、输入框、目录、正文的 pointer hit-testing，并为 macOS 打开 `acceptFirstMouse`。
- `IMKCFRunLoopWakeUpReliable` 属于 macOS InputMethodKit 日志，不作为应用点击故障判断依据。

## v0.16.0

### Modern desktop UI

- 重构顶栏为三段式桌面 chrome，模式切换居中，高频动作改为紧凑线性图标。
- 重做 Tab、大纲、阅读画布、状态栏和空状态，建立一致的现代视觉层级。
- 引入统一 Design Token：surface、border、muted、accent、shadow、hover/active，同时覆盖深色主题。
- Workspace、源码编辑器和 WYSIWYG 跟随同一视觉语言，不改变现有业务与数据路径。
- 阅读画布增加弱边框、圆角和轻阴影；打印时自动移除 chrome 与卡片装饰。

## v0.15.2

- 修复开发环境启动时 updater 插件读取 `plugins.updater: null` 导致的 panic。
- 基础 Tauri 配置显式提供最小 updater 配置（空 endpoints/pubkey）；真正检查更新时仍由 Rust 从 `MDV_UPDATE_ENDPOINT` / `MDV_UPDATE_PUBKEY` 注入运行时配置。
- 保持开发环境无更新源时正常启动，检查更新时返回“未配置更新源”而不是让应用启动失败。



## v0.15.1

- 修复 Rust 编译：Serde `Serialize` 实现不再被项目 `Result<T>` 类型别名遮蔽。
- 修复 Tauri Updater 运行时 endpoint 类型，显式解析为 `Url`。
- 修复启动参数去重集合被推断为 `Vec<str>` 的问题。
- 修复资源解析中 `request.raw` 借用后 move 的所有权冲突。
- 清理 macOS/Linux `restart()` 后不可达代码和未使用的 `Manager` import。

## v0.15.0

### Developer formats

- Add read-only `TomlFormat` with a collapsible tree viewer.
- Add read-only `LogFormat` with line numbers and common ERROR/WARN/INFO/DEBUG/TRACE level detection.
- Add read-only `DiffFormat` for `.diff/.patch` with file/hunk/add/delete styling and summary counts.
- Extend file picker, startup arguments, workspace scanning and file associations to TOML / LOG / DIFF.

### Workspace UX

- Add collapsible workspace directories.
- Add local file-tree filtering without additional filesystem calls.
- Group cross-file search results by file.
- Return one line of surrounding context before/after each match.
- Show search telemetry: elapsed time, files scanned, decoded-text cache hits, skipped large files and truncation state.

### Workspace index cache

- Add Rust `WorkspaceIndexCache` managed by Tauri.
- Cache decoded text after first search.
- Reuse cached text for unchanged files using `size + mtime` during manual rescans.
- Invalidate cached content automatically when a searched file's metadata changes.

### Performance discipline

- Add `tools/document-benchmark` and `npm run bench:core` for 100KB / 1MB / 10MB Markdown core render measurements.
- Add `docs/PERFORMANCE.md` with cold-start, memory, large-document and workspace-search release gates.
- Do not publish synthetic benchmark claims when the current environment cannot run Rust release builds.

## v0.14.0

### Workspace / Project Hub
- 新增文件夹 Workspace：Rust 负责受限目录扫描、README 自动发现和文件树生成。
- 默认忽略 `.git`、`node_modules`、`target`、`dist`、`build`、虚拟环境等目录，并跳过 symlink。
- 新增工作区全局搜索，限制候选文件数、单文件大小和返回结果数量。
- Workspace snapshot schema 升级到 v2，新增 `projectRoot` 与最近项目列表。
- 新增 `Ctrl/Cmd+Shift+O` 打开工作区、`Ctrl/Cmd+Shift+F` 工作区搜索，并接入原生菜单/Command Registry。
- 新增 `fixtures/workspace-demo` 用于 README 自动发现、全局搜索和多格式验证。

### Multi-format DocumentFormat
- 新增 `structured-core` crate。
- `JsonFormat` / `YamlFormat` 输出可折叠结构树；`CsvFormat` 输出表格 Viewer。
- `RenderedDocument` 新增 `editable` 能力标记；Markdown 可编辑，JSON/YAML/CSV 明确只读。
- `DocumentService` 统一注册 Markdown / JSON / YAML / CSV；保存命令拒绝只读格式。
- 文件对话框、启动参数、拖拽与 Tauri file association 扩展到 JSON/YAML/CSV。

### UI / Safety
- 新增 WorkspacePanel：文件、全局搜索、目录三个侧栏模式。
- 空状态新增最近项目与“打开文件夹”。
- 结构化 Viewer 继续复用 Tab、Watcher、当前文档搜索、复制/导出和 Workspace 恢复。
- 文件夹路径只作为 root 传给 Rust 专用 command；WebView 不直接递归读取整个工作区。

## v0.13.0

### Windows Explorer Rich Preview
- `preview-core` 新增 RTF renderer 和 C ABI `mdv_preview_render_rtf`。
- Preview Handler 使用 RichEdit 4.1 + `EM_STREAMIN/SF_RTF` 显示富 Markdown，不在 Low-IL `Prevhost.exe` 内引入 WebView2。
- RTF 预览覆盖标题、强调、代码、引用、列表、Task、基础表格、链接及安全数学文本降级。
- `IStream` 使用循环读取并保留 32 MB 上限；继续使用默认 Prevhost Low Integrity。
- `TranslateAccelerator` 可委托 `IPreviewHandlerFrame`。

### Windows Installer / Shell Actions
- 新增 `src-tauri/tauri.windows.conf.json` 与 `platform/windows-preview/prepare-bundle.ps1`，bundle 前构建 Preview DLL 并作为资源进入安装包。
- 新增 NSIS `windows/hooks.nsh`，安装后按当前用户自动注册 Preview Handler，卸载自动清理。
- Windows v0.13 bundle 锁定 x64 + NSIS；非 x64 `prepare-bundle.ps1` 主动失败，避免发布架构不匹配的 Shell DLL。
- Preview Handler 关联改用 `SystemFileAssociations`，不依赖/不抢占 Markdown 默认 ProgID。
- 新增 Explorer 级联右键：阅读、WYSIWYG、源码、复制富文本、导出 HTML、打印/PDF。
- 新增 Shell Action Queue，右键动作进入 Tauri single-instance 后复用现有应用命令。

### macOS Quick Look Product Target
- 新增正式 `MarkdownQuickLook.xcodeproj`、shared scheme、entitlements 与 App Extension build settings。
- Quick Look target 链接 universal Rust `preview-core` staticlib，并将 `.appex` 本身按 `arm64 + x86_64` 构建。
- 新增 `build-extension.sh` / `verify-extension.sh`。
- 新增 `src-tauri/tauri.macos.conf.json`，bundle 前构建 `.appex` 并准备嵌入 `Contents/PlugIns`。
- Quick Look 相对图片继续通过 `cid:` attachments 安全内嵌。

### Preview Tooling
- `preview-renderer` 新增 `--rtf` 和 `--text` 模式，便于不启动 Explorer/Finder 验证 shared preview-core。
- 新增 `docs/SYSTEM_INTEGRATION.md`，明确 OS integration 只做 Adapter，不复制 Parser / Lossless / Export 业务。

## v0.12.0

### Lossless Compatibility Engine
- `RenderedDocument` 新增 `CompatibilityReport`，由 Rust `markdown-core` 生成。
- 新增 Safe / Guarded / Source Only 三档 round-trip 等级。
- Guarded 检测包括 Setext heading、tilde/long fence、引用式链接、GFM 表格源码排版、非默认列表 marker、缩进代码、autolink、entity、转义标点、硬换行和分割线风格等。
- Source Only 当前覆盖 Front Matter、脚注和 Raw HTML；WYSIWYG 会保护性拒绝。
- 状态栏新增兼容性 Badge 与详细报告面板，可查看规则、次数和行号。

### System Preview Foundation
- 抽出 `text-core`，统一桌面程序和系统预览的编码识别/写回。
- 新增 `preview-core`，复用 `markdown-core` 输出无网络、无 JS 的自包含安全 HTML，并提供 C ABI staticlib 接口。
- 新增 `preview-renderer` CLI 用于独立验证 preview-core。
- 新增 macOS Quick Look data-based Preview Extension 接入源码骨架，使用系统 Markdown UTI `net.daringfireball.markdown`。
- 新增 Windows Explorer Preview Handler 的 COM/IStream/Prevhost Low-IL 接入骨架和注册模板；v0.12 明确不伪装完成未经过 Windows 真机验证的 HWND renderer。

## v0.11.0

### Typora-style Editing
- WYSIWYG 移除固定大工具栏，改为正文优先的干净编辑界面。
- 新增 Slash Command：输入 `/` 可插入标题、引用、列表、任务、代码块、分割线、图片、表格、Mermaid 和 KaTeX。
- 新增选区浮动工具条：粗体、斜体、删除线、行内代码和链接就地处理。
- 新增 `syntaxRevealPlugin`，光标进入标题/引用/代码块/强调内容时用 Decoration 临时显示 Markdown 语法，不污染 AST 和源文件。
- 新增表格右键菜单：增删行列、左/中/右对齐和删除表格。
- 图片 NodeView 增加左右拖拽缩放把手；宽度仅保留在当前编辑会话，不写入非标准 Markdown。

### Auto Save
- 默认开启无感自动保存，停止输入约 900ms 后写回原 Markdown。
- 每个 Document 单独防抖且单次只允许一个 save in-flight。
- 保存过程中继续输入时，只更新 `savedSource`，不会用旧保存结果覆盖新的 Draft。
- 关闭 Tab/退出应用时若开启自动保存会先尝试 flush，失败后才询问是否丢弃。
- 设置中心新增“无感自动保存”开关，用户设置版本升级到 v3。

## v0.10.0

### WYSIWYG Advanced
- GFM 表格正式进入 ProseMirror Schema，支持可视化单元格编辑、增删行列和列对齐。
- 接入 `prosemirror-tables` 的 table editing 插件，保持表格结构完整和单元格选区行为。
- 新增 Mermaid 原子 NodeView：默认渲染 SVG，双击原地编辑源码，保存仍为标准 fenced Mermaid。
- 新增 KaTeX 行内/块级公式 NodeView：默认显示排版结果，双击编辑 `$...$` / `$$...$$` 源码。
- 新增图片 NodeView，本地相对图片在编辑模式通过 Tauri asset protocol 正确显示。

### 图片导入
- 工具栏可选图插入，支持剪贴板粘贴图片与系统拖入图片。
- 桌面版将图片复制到当前 Markdown 旁的 `assets/`，Markdown 只记录 `./assets/...` 相对路径。
- Rust 端限制 25MB，校验 PNG/JPEG/GIF/WebP/BMP/AVIF/SVG 等格式签名/扩展，清洗文件名并自动避重。
- 拖入图片时不再误触发“打开 Markdown 文件”逻辑。

### Round-trip 安全
- WYSIWYG 兼容门槛移除 GFM Table 与块级数学公式；Front Matter、脚注、Raw HTML 仍强制源码模式。
- 表格只开放 Markdown 可以表达的行列与对齐能力，不暴露 rowspan/colspan 等无法无损写回的特性。
- 新增 `fixtures/wysiwyg-demo.md` 高级 round-trip 测试内容。

## v0.9.0

### WYSIWYG Core
- 新增 ProseMirror 所见即所得编辑模式，保留阅读 / 编辑 / Markdown 源码三态。
- 支持段落、H1~H6、粗体、斜体、删除线、链接、引用、无序/有序列表、任务列表、行内代码、代码块、分割线。
- 支持撤销/重做、列表缩进、常用 Markdown 输入规则。
- 新增 `Ctrl/Cmd+S` 保存、`Ctrl/Cmd+E` 阅读↔编辑、`Ctrl/Cmd+Shift+E` 源码。
- Tab、窗口标题和状态栏显示未保存状态。

### Round-trip / 数据安全
- `RenderedDocument` 返回原始 Markdown source；保存由 Rust 写回原文件。
- 保留原编码以及 LF / CRLF / CR 行尾风格。
- UTF-8 BOM / UTF-16 LE/BE / 已识别 legacy 编码支持写回。
- 外部编辑器修改文件时，若当前有脏草稿则不自动覆盖。
- 关闭脏 Tab 或退出应用前确认，避免静默丢失。
- v0.9 对尚未结构化支持的 GFM 表格、脚注、块级公式、Front Matter、Raw HTML 阻止进入 WYSIWYG，避免保存时破坏源码。
- 新增 `fixtures/wysiwyg-demo.md` round-trip 测试文件。

## v0.8.0

- 增加原生 File/Edit/View/Tabs/Help 菜单，菜单、快捷键、命令面板统一走 AppCommand。
- 窗口标题与当前 Markdown 文件联动。
- 增加 About 与 Diagnostics 面板。
- 增加运行时 Tauri Updater 配置、检查、下载/安装进度与 Release-only 更新策略。
- 增加 Rust panic 持久化和前端 error/unhandledrejection 诊断。
- 增加 Windows/macOS 应用图标与 bundle 元数据。
- Windows 使用 WebView2 embedBootstrapper，兼顾小体积与缺失 Runtime 的安装体验。
- 增加 release Tauri config 和 GitHub Actions 发布模板。

## v0.7.0

### 命令层
- 新增 `AppCommand` / Command Registry。
- 新增命令面板，`Ctrl/Cmd + K` 或 `Ctrl/Cmd + Shift + P` 打开。
- 文件、查看、导航、复制、导出、设置等常用动作统一注册。
- 快捷键触发与命令面板复用同一命令实现，减少 UI 内重复业务逻辑。

### 右键菜单与复制
- Markdown 正文新增自定义右键菜单。
- 选中文字支持复制纯文本、复制富文本、复制 HTML、直接查找选中文字。
- 链接菜单区分本地 Markdown 与外部 URL，继续遵守既有安全导航规则。
- 新增全文纯文本 / 富文本 / HTML / 文件路径复制命令。
- 富文本复制尽量把图片转为 data URL，并为常用结构添加可携带的内联样式。
- 新增复制成功轻提示。

### Clipboard 安全
- 接入 `@tauri-apps/plugin-clipboard-manager` / `tauri-plugin-clipboard-manager`。
- 仅开启 `clipboard-manager:allow-write-text` 和 `clipboard-manager:allow-write-html`。
- 不开放任何剪贴板读取权限。

### 文档统计
- `RenderedDocument` 新增 `wordCount`、`characterCount`、`estimatedReadMinutes`。
- Markdown Core 根据 Parser 的可见文本事件统计，不依赖前端 DOM。
- StatusBar 新增字词数和预计阅读时间。

## v0.6.0
- 设置中心、阅读主题、字体/字号/宽度/行高、HTML 导出与 PDF/打印。

## v0.5.0
- 大文档视口优化、分批富渲染、目录滚动联动、阅读进度、图片状态、Tab 快捷键与显示位置。

## v0.4.0
- 本地相对资源、最近文件、Workspace 恢复和每 Tab 滚动位置。

## v0.3.0
- Mermaid、KaTeX、代码高亮、文档搜索与稳定 Heading ID。

## v0.2.0
- 单实例、文件监听、启动文件队列和编码识别。

## v0.1.0
- Tauri + Svelte + Tailwind 基础骨架与 Markdown Core。

### v0.12 completion

- Removed the duplicate client-side WYSIWYG compatibility regex; Rust `markdown-core` is now authoritative for open/edit/save/preview.
- Added `analyze_markdown` Tauri command and a second lossless guard immediately before WYSIWYG disk writes.
- Added Source Only detection for heading attributes (`{#id .class}`).
- macOS Quick Look now embeds safe relative images using `QLPreviewReplyAttachment` / `cid:` URLs.
- Windows Preview Handler now has a working Low-IL-friendly RichEdit baseline fed by shared Rust plain-text extraction instead of a placeholder HWND.
- Added macOS universal staticlib and Windows x64 build helper scripts.

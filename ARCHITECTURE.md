# oneView Architecture — v0.21.10




## v0.21.5 macOS Document Handler Boundary

macOS 的 Finder “打开方式”候选由 bundle 的静态 `Info.plist` / LaunchServices 声明决定，运行时插件不能安全地修改已签名 App 的 document types。因此 v0.21.5 把职责拆成两层：

```text
macOS bundle (static, tauri.macos.conf.json)
  -> Markdown + JSON/YAML/TOML/CSV/LOG/DIFF/PATCH
  -> role=Viewer/Editor, rank=Alternate
  -> only advertises “this app can open the file”

Plugin Registry (runtime)
  -> active Document Plugin? structured renderer
  -> otherwise Plain Text fallback
```

这意味着系统可以把 oneView 列为 JSON 等格式的候选应用，但安装应用或安装插件都不会静默改变默认应用。Windows 保留原有 Markdown-only 注册。

## v0.21.4 Single Theme Authority

Reader 不再拥有独立 `readerTheme` / Profile 分支。当前 Theme family 是唯一视觉来源：

```text
Theme family (Light / Dark)
  ├─ app.*    → TopBar / Sidebar / Modal / Status / Workspace
  ├─ reader.* → Markdown Reader / WYSIWYG / export surface
  └─ syntax.* → Highlight.js / code tokens

User reading preferences
  └─ font family / font size / line height / content width / code font size
     （只影响排版，不覆盖 Theme visual tokens）
```

Settings schema v5 删除了 `readerTheme`。旧 v4 JSON 中该字段由 Serde/前端 normalize 安全忽略，其他用户偏好继续保留。Reader DOM 也不再挂 `data-reader-theme`，因此 CSS 不存在第二套 GitHub / Paper / Minimal / Sepia 分支。


## v0.21.0 Contribution-first Plugin Platform

```text
PluginManager
  ├─ Contribution Registry
  │   ├─ documentFormats ──> Format Registry / Workspace eligibility
  │   └─ themes ───────────> Theme Registry ──> Semantic Tokens
  │                                  ├─ App
  │                                  ├─ Reader
  │                                  └─ Syntax
  └─ optional Worker Runtime
      ├─ role=document  ──> zero-permission renderer sandbox
      └─ role=extension ──> permission-guarded Host RPC
```

`contributes` 不依赖 Worker 生命周期。纯 Theme Plugin 安装和启用后只读取经过 Rust/TypeScript 双重验证的 JSON token；不会创建 JavaScript realm。Safe Mode 因此只停止 Worker Runtime，Theme Registry 仍然维持活动主题。

Theme family 同时包含 Light/Dark 时必须声明完全相同的 scope，并且每个 variant 只能出现一次。应用只把声明 scope 内的 token 写入 `--theme-*` CSS variables。首帧只读取已验证后的 Theme Bootstrap Cache，不执行插件代码。

插件安装/升级继续使用 staging directory + rename 的 atomic replace。开发目录所有声明文件在读取前 canonicalize，并要求 canonical path 仍位于插件 root 内，从而阻止 symlink escape。

## v0.20.8 Flicker-free Rendering Boundary

主内容与浮层动画分离：主文档、编辑器、首页保持全程不透明，只允许 1–2px 的 settle 位移；弹窗、菜单、遮罩仍可使用透明度动画。Home / document / editor mode 共用持久 `app-content-stage`，避免 keyed child 重建时暴露 WKWebView backing surface。冷启动通过 `appReady` 渲染门等待设置、插件、Workspace 与 external-open 队列恢复完成。

## v0.20.7 Motion Boundary

动画不再分散在各组件中写硬编码 keyframes，而由 `src/lib/motion.ts` 提供统一 transition primitives：

```text
Motion primitives
  ├─ backdropMotion
  ├─ modalMotion / paletteMotion / popoverMotion
  ├─ sidePanelMotion
  ├─ contentMotion / tabMotion
  └─ toastMotion
```

组件只选择符合语义的 Motion primitive；时长、位移、easing 与 reduced-motion 逻辑集中维护。CSS 只负责长期状态的 hover / active transition 和首次 shell 淡入，不承担业务开关状态。`prefers-reduced-motion` 在 JS transition 与 CSS 两层同时生效。


## v0.20.5 Settings / Plugin Center Boundary

```text
Application Shell
   ├─ SettingsPanel       → app preferences only
   │    ├─ General
   │    ├─ Reading
   │    ├─ Editor
   │    └─ System
   │
   └─ PluginCenterPanel   → extension lifecycle only
        ├─ install / enable / uninstall
        ├─ safe mode / development link
        ├─ permissions / shortcuts
        └─ plugin settings / diagnostics
```

设置与插件管理不再互相嵌套。`SettingsPanel` 不依赖 `PluginManager`；插件中心通过独立一级命令 `plugins.open` 进入。这样设置页的复杂度不会随插件系统继续增长，插件管理也可以独立扩展市场、更新和权限审查等能力。

## v0.20.4 Plugin IPC Contract

插件持久化/管理命令不再把业务字段直接暴露为多个 Tauri 顶层参数，而是统一使用单一 `request` DTO：

```text
TauriPluginRepository
        │ typed PluginCommandRequestMap
        ▼
invoke(command, { request })
        │
        ▼
#[tauri::command]
fn command(request: XxxRequest, State<PluginService>)
        │ serde camelCase + deny_unknown_fields
        ▼
PluginService
```

这样 Tauri 顶层 IPC 永远只有稳定的 `request` 键；`id/removeData/commandId/...` 的字段命名与类型由前端类型映射和 Rust Serde DTO 双向约束。新增字段时只修改对应 Request，而不是在多个裸参数、invoke 调用和命名转换之间同步。

## v0.20.0 Static Host + Sandbox Runtime

```text
Main WebView / PluginManager
        │ typed runtime port
        ▼
WorkerRuntimeTransport
        │ new Worker(new URL(...), { type: "module" })
        ▼
plugin-host.worker.ts                 trusted / Vite-built
        │ validates runtime direction
        │ creates disposable Blob sandbox
        ▼
plugin-sandbox-bootstrap.js           trusted bootstrap asset
        +
third-party main.js                   untrusted extension code
        │
        ├─ runtime=document → render-document only
        └─ runtime=extension → capability RPC → PluginHostApiRouter
                                             → PluginPermissionGuard
                                             → stable Host Services
```

`PluginManager` 不依赖 Worker 细节，只持有 `DocumentPluginRuntime | ExtensionPluginRuntime`。Document Runtime 类型上只有 `start / stop / renderDocument`；Extension Runtime 类型上只有 `start / stop / invokeCommand / emitEvent / panel / settings`，不再用一个万能接口承载所有能力。

主程序的静态 Host Worker 与第三方源码分离：第三方源码只进入一次性 Sandbox Worker。CSP 不开放 `unsafe-eval`；Sandbox bootstrap 封锁常见网络、动态代码和嵌套执行入口。安全模型详见 `docs/PLUGIN_SECURITY.md`。

## v0.19.0 Markdown Core + Optional Document Plugins

```text
                         ┌─ Markdown Core (Rust + ProseMirror) ─ editable
File decode / metadata ──┤
                         └─ Plain Text Fallback ─────────────── readonly
                                      │
                                      ▼
                              Plugin Format Router
                                      │ manifest contributes.documentFormats
                                      ▼
                         Dedicated Plugin Worker renderer
                                      │ RenderResult { html, outline, stats }
                                      ▼
                           Host allowlist HTML sanitizer
                                      │
                                      ▼
                               MarkdownView surface
```

核心不再知道 JSON/YAML/TOML/CSV/LOG/DIFF 如何解析。Rust Workspace 只接收“当前启用插件贡献的扩展名表”，负责有界扫描和文本索引；格式语义由插件 Worker 负责。插件禁用后，Workspace 在下一次刷新时自然收缩支持范围。

系统文件关联也遵循同一产品边界：安装器只注册 Markdown。插件可以让应用内部识别额外格式，但不会静默修改 OS 默认应用。

安全边界：插件 renderer 只有当前文档的稳定 DTO，不能访问 DOM、Tauri invoke、任意文件系统或网络；renderer 返回的 markup 在进入 DOM 前再次经过宿主 tag/attribute/protocol allowlist。

## v0.17.3 Title Tabs / Window Chrome

窗口 chrome 收敛为单行 `TopBar.svelte`：macOS 通过 Tauri `TitleBarStyle::Overlay` 让 WebView 内容进入原生标题栏，左侧为系统 traffic lights，随后依次是侧栏开关、文档标签、新建文件入口、可拖拽空白区和少量全局操作。原来的第二行 `TabBar` 被移除。低频动作集中到 `MoreMenu.svelte`，避免常驻工具按钮侵占正文。

## 设计目标

oneView 继续按“轻量 Viewer 平台”设计，而不是把功能堆进一个 Svelte 页面。

```text
Presentation       Svelte 5 + Tailwind CSS 4
Command Layer      AppCommand / Command Palette / Context Menu
Application        open / close / restore / export / copy / settings
Core Domain        Markdown / RenderedDocument / Stats / Plaintext Fallback
Plugin Host        Manifest Contributions / Worker Runtime / HTML Sanitizer
Optional Formats   JSON / YAML / CSV / TOML / LOG / DIFF / future formats
Infrastructure     FS / Watcher / Encoding / Workspace / Settings / Clipboard / Updater / Diagnostics
Platform           Tauri 2 / WebView2 / WKWebView
```



## v0.17.2 Window Defaults

主窗口首次创建默认使用 `980 × 720`。这只是产品级默认尺寸，不把窗口固定死；现有 resizable / minimum-size 策略保持不变。


## v0.17.1 Pure WYSIWYG Surface

The user-facing source editor has been removed. Markdown documents now have only two presentation states: `wysiwyg` for lossless-compatible documents and `read` for safe preview-only documents. Raw-source parsing remains an internal implementation detail, not a UI mode. Legacy `--source` startup actions are accepted only for backwards compatibility and are routed to the visual editor when possible.

## v0.17.0 Visual Editing as Primary Surface

The normal Markdown path is now `Markdown source -> ProseMirror visual document -> Markdown serializer`, with the rendered visual document acting as the editing surface. `read` remains an internal compatibility/read-only state rather than a user-facing editing step. Raw source is a secondary escape hatch.

Key invariants:

1. `EditorDraft.source` remains the canonical pending Markdown text.
2. ProseMirror is authoritative only while the visual editor is mounted; parent echoes do not rebuild `EditorState`.
3. `CompatibilityReport.canWysiwyg` gates entry to the visual editor; unsupported syntax falls back to safe rendered preview/source mode.
4. Visual editor viewport state uses the same `ViewportTracker` contract as `MarkdownView`, so scroll position, progress and outline state survive the unified experience.
5. UI mode selection is presentation-only: normal users see visual editing plus an optional source toggle, not a three-mode workflow.


## v0.16.9 Native Close / Exit Lifecycle

关闭按钮与应用退出在 Rust 原生事件边界统一协调：

```text
macOS red X
  → Rust WindowEvent::CloseRequested
  → ExitCoordinator.prevent_close()
  → app://exit-requested
  → Svelte document guard (autosave / discard confirm)
  → confirm_app_exit
  → AUTHORIZED
  → AppHandle::exit(0)
  → native termination

Cmd+Q / menu Quit / command Quit
  → AppHandle::exit / ExitRequested
  → same ExitCoordinator + frontend guard
```

前端不再注册 `getCurrentWindow().onCloseRequested()`。这样不会触发 Tauri JS helper 自带的“先阻止原生 close，再在回调后 destroy window”语义；`src-tauri/src/exit_lifecycle.rs` 成为唯一原生退出协调器，Svelte 只负责文档数据保护。


## v0.16 Presentation / Design Token Layer

应用 chrome 统一由 `src/styles/app.css` 中的 Design Token 驱动。TopBar / TabBar / Outline / StatusBar / Workspace / Editor 只表达结构和状态，不再各自硬编码一套视觉语言。该 v0.16 分层后来在 v0.21 Theme Platform 中统一为 App / Reader / Syntax Semantic Token；v0.21.4 起 Reader 不再有独立 Profile。


## v0.15 Developer Hub / Indexed Workspace（历史：v0.19 已插件化）

```text
Folder Picker
     ↓ root path only
WorkspaceIndexCache (Rust)
  ├─ bounded tree scan
  ├─ README discovery
  ├─ file metadata index
  ├─ decoded-text cache
  └─ bounded cross-file search + context
          ↓
WorkspaceProject / WorkspaceSearchResponse
          ↓
Svelte WorkspacePanel
  ├─ collapsible tree
  ├─ local tree filter
  └─ grouped search results

DocumentService / Format Registry
  ├─ MarkdownFormat  -> editable
  ├─ JsonFormat      -> readonly tree
  ├─ YamlFormat      -> readonly tree
  ├─ CsvFormat       -> readonly table
  ├─ TomlFormat      -> readonly tree
  ├─ LogFormat       -> readonly level-aware lines
  └─ DiffFormat      -> readonly unified diff
```

索引缓存只保存当前进程内的数据。手动 Refresh 会重新扫描目录，但通过 `size + mtime` 复用未变化文件的 decoded text。这样先获得重复搜索的收益，同时避免 v0.15 就引入持久索引失效、迁移和隐私清理问题。

性能从本版开始有独立 harness：`tools/document-benchmark` 固定生成 100KB / 1MB / 10MB Markdown，测量 Rust core parse/render；桌面冷启动、WebView DOM、内存和 Workspace 大仓库指标在 `docs/PERFORMANCE.md` 作为发布门禁记录。

## v0.14 Workspace / Multi-format Architecture（历史）

```text
Folder Picker
     ↓ root path only
Rust Workspace Service
  ├─ bounded tree scan
  ├─ ignored-directory policy
  ├─ README discovery
  └─ bounded cross-file search
          ↓
WorkspaceProject / SearchResult DTO
          ↓
Svelte WorkspacePanel

DocumentService
  └─ Format Registry
      ├─ MarkdownFormat  -> editable
      ├─ JsonFormat      -> readonly tree
      ├─ YamlFormat      -> readonly tree
      └─ CsvFormat       -> readonly table
```

关键边界：

1. WebView 只负责选择目录，不在前端递归读取仓库。
2. Rust 扫描忽略 symlink 和常见构建/依赖目录，并设置深度、文件数和文件大小上限。
3. `RenderedDocument.editable` 是格式能力的一部分；结构化 Viewer 不复用 Markdown WYSIWYG 保存链。
4. Workspace 与单文件 Tab 生命周期解耦：项目可以存在但暂时没有打开文档。
5. Workspace snapshot schema 升级到 v2，并增加 `projectRoot` / `recentProjects`，磁盘文件名继续兼容 `workspace-v1.json`。

## Command Registry

v0.7 新增统一命令层：

```text
                 ┌─ TopBar
AppCommand ──────┼─ Global shortcuts
                 └─ CommandPalette
```

命令包含：

```ts
export type AppCommand = {
  id: string;
  title: string;
  group: CommandGroup;
  shortcut?: string;
  enabled?: boolean;
  run: () => void | Promise<void>;
};
```

业务动作只实现一次。UI 只决定“如何发现和触发命令”。动态 Tab 数字快捷键仍由 Workspace 导航层处理，因为它们是运行时索引而不是稳定产品命令。

## Context Menu

`MarkdownView` 只负责提取上下文：

```text
MouseEvent
  ↓
DOM Range / Anchor
  ↓
ViewerContextMenuRequest
  ↓
App
  ↓
ContextMenuItem[]
  ↓
ContextMenu
```

请求里仅传：坐标、选中文字/HTML、链接元信息。真正的复制、打开、查找仍由 Application/Service 层执行。

## Clipboard

```text
Rendered DOM / Selection Range
       ↓
cleanRuntimeMarkup
       ↓
图片尽量 fetch → data URL
       ↓
portable inline styles
       ↓
Tauri clipboard-manager
       ├─ writeText
       └─ writeHtml(html, fallbackText)
```

Capability 只允许写纯文本和 HTML，不开放剪贴板读取。

## Document Stats

统计在 `markdown-core` 完成：

```text
Markdown Parser Events
   ↓
visible text
   ↓
CJK chars + latin/alphanumeric word groups
   ↓
wordCount / characterCount / estimatedReadMinutes
```

因此 StatusBar 不需要重新扫描 DOM，未来其他 Format 也可以返回自己的统计数据。

## 两类持久状态

### Workspace (`workspace-v1.json`)
- 打开的 Tab 及顺序
- 当前激活文件
- 每个 Tab 的滚动位置
- 目录侧栏状态
- 最近文件

### User Settings (`settings-v1.json`)
- 应用明暗模式
- 当前 Theme family（独立持久化在 Theme Registry selection）
- 正文字体
- 字号 / 行高 / 正文宽度
- 代码字号
- 无感自动保存开关

命令面板和右键菜单属于瞬时 UI 状态，不持久化。

## 安全边界

- Markdown Raw HTML 默认转义。
- 本地图片按实际引用动态加入 asset scope。
- 外部 HTTP/HTTPS/mailto/tel 链接交给系统应用。
- `javascript:` / `file:` 等未知 scheme 不导航。
- Clipboard 只开放 write-text/write-html。
- 右键菜单不会直接执行 `href`，仍走统一链接判断。

## 下一步

v0.15 建议继续围绕 Developer Document Hub：TOML / LOG / Diff Viewer、Workspace 文件树折叠与过滤、搜索结果分组/上下文、README/文档索引缓存，以及首轮真实性能基准。


## v0.8 Productization Layer

```text
Native Menu ─┐
Keyboard ─────┼─> AppCommand Registry ─> Application actions
Command UI ───┘

Rust Release Info ─> About / Diagnostics
Rust Panic Hook ───> last-crash.txt ─> Diagnostics
Window/Promise Error ────────────────> Diagnostics

Release build env
  ├─ MDV_UPDATE_ENDPOINT
  ├─ MDV_UPDATE_PUBKEY
  └─ TAURI_SIGNING_PRIVATE_KEY
           ↓
      Tauri Updater
```

Updater endpoints and public keys are injected at compile time for release builds instead of hard-coded into development source. Updater artifacts are enabled only by `src-tauri/tauri.release.conf.json`.


## v0.9 Editor Architecture

```text
Rust DocumentService
  ├─ read / decode / watch
  ├─ source + encoding + lineEnding
  └─ save_document
          ↑
          │ Markdown string
          ↓
Editor Session Store
  ├─ savedSource
  ├─ draft source
  ├─ dirty
  └─ mode(read / wysiwyg / source)
          ↓
ProseMirror
  ├─ Schema
  ├─ MarkdownParser
  ├─ EditorState / Transaction
  ├─ InputRules / History / Keymap
  ├─ TaskList Decoration Plugin
  └─ MarkdownSerializer
```

关键原则：

1. **编辑热路径不走 Tauri IPC**：按键只更新 ProseMirror Transaction。
2. **保存才进入 Rust**：Rust 负责文件、编码、行尾和 watcher。
3. **HTML 不是编辑真源**：WYSIWYG DOM 只是 ProseMirror View，真实状态是 EditorState。
4. **每个 Tab 独立 Draft**：切 Tab 不丢草稿。
5. **外部修改不覆盖 Dirty Draft**。
6. **不支持的 Markdown 结构宁可阻止进入 WYSIWYG，也不静默破坏 round-trip**。

### v0.10 WYSIWYG 扩展

可编辑：paragraph / heading / strong / em / strike / link / blockquote / bullet-list / ordered-list / task-list / inline-code / code-block / hr / GFM table / image / Mermaid / inline math / display math。

```text
Editor Schema
  ├─ CommonMark nodes
  ├─ prosemirror-tables table nodes
  ├─ mermaid_block (atom)
  ├─ math_block (atom)
  └─ math_inline (atom)

NodeViews
  ├─ ImageNodeView -> resolve local asset -> Tauri asset protocol
  ├─ MermaidNodeView -> render SVG / double-click source editor
  └─ MathNodeView -> KaTeX / double-click source editor

Image import
  Clipboard File / OS path
        ↓
  editor-asset-service.ts
        ↓ IPC
  Rust editor_assets
        ↓
  validate / sanitize / collision-safe copy
        ↓
  ./assets/name.ext
        ↓
  Markdown relative path
```

仍只允许源码模式：footnote / front matter / raw HTML。表格 UI 只开放标准 Markdown 能 round-trip 的行列和对齐能力，不暴露 rowspan/colspan 等私有富文本能力。


## v0.11 Interaction Layer

```text
EditorView
  ├─ syntaxRevealPlugin()      Markdown syntax decorations, never serialized
  ├─ Slash Command            contextual block/insert actions
  ├─ Selection Toolbar        inline mark actions
  ├─ Table Context Menu       GFM-safe table operations
  └─ ImageNodeView resize     session-only visual width

Editor change
  ↓
EditorDraft dirty
  ↓ 900ms debounce
AutoSave coordinator
  ↓ one in-flight save per document
Rust save_document
  ↓
markPersisted(savedSource)
```

自动保存按 Document ID 串行化。若一次保存进行中又发生编辑，旧保存完成后只推进 `savedSource`，当前 `source` 保持最新，并自动排队下一次保存，避免异步保存结果反向覆盖用户新输入。

图片宽度是有意设计的 session-only UI 状态：标准 Markdown 没有宽度语义，所以 `widthPct` 只存在 ProseMirror 节点运行时属性，MarkdownSerializer 忽略它。



## System Integration — v0.21.6

系统集成保持 Adapter 原则，但不再包含任何系统预览扩展。Windows Explorer Preview Handler 与共享 `preview-core` 已删除；macOS Quick Look 也早已移除。

```text
Windows Explorer / macOS Finder
          ↓
file association / shell action
          ↓
Tauri single-instance / DefaultAppService
          ↓
existing AppCommand / DocumentService / ExportService
```

### Windows

NSIS 只注册：

- Markdown 默认应用 capability；
- Explorer `SystemFileAssociations` 右键动作；
- 主程序文件打开入口。

不再安装 COM DLL、不注册 PreviewHandlers、不运行 CMake。

### macOS

主应用通过 bundle file associations + `NSWorkspace` 提供“打开方式”和默认应用能力，不包含 nested `.appex`。

### Release boundary

Windows 仍需要在 Windows 环境验证 NSIS、文件关联和右键动作；当前 CI 发布 x86_64。macOS 验证主 App 签名/notarization。

## v0.16.6 Default App Service

默认应用能力不放在 Svelte 页面里直接操作系统，而是分三层：

```text
UI (Prompt / Settings)
        ↓
frontend default-app store/service
        ↓ invoke
Rust default_apps module
   ├─ macOS: NSWorkspace + UTType
   └─ Windows: AssocQueryStringW + ms-settings
```

安装器只声明“可处理这些类型”，不在安装时抢占默认应用。macOS 的一键设置通过系统 API 完成；Windows 始终把最终选择交给系统设置。


## v0.17.4 Popover Surface

Compact titlebar popovers use an opaque chrome surface and do not depend on backdrop-filter, avoiding compositing transparency under macOS overlay title bars.

## v0.17.8 Structured JSON presentation（历史）

在 v0.17.8 中 JSON 曾由 `structured-core` 在 Rust 层解析并生成语义树。**该路径已在 v0.19 删除**：JSON 现在由可选官方插件的 Dedicated Worker 解析，结果再经过宿主 allowlist sanitizer 后进入 Viewer。此段仅保留为架构演进记录。


## v0.17.9 Editable syntax highlighting

Editable fenced code blocks use `codeHighlightPlugin` to translate Highlight.js token output into ProseMirror inline decorations. The editor never mutates the editable code DOM with `innerHTML`; this keeps selection mapping, history, IME input and document serialization under ProseMirror control. `CodeBlockNodeView` owns only presentation chrome (language label/copy action) and exposes a normal `contentDOM` for editing.


## v0.18.0 Plugin Architecture

插件系统采用 **Ports & Adapters / Hexagonal Architecture**，避免把 Tauri、Svelte 或 ProseMirror 直接变成第三方 API。

```text
PluginSettingsSection / Command Palette
              │
              ▼
         PluginManager             ← Application / Facade
        /      |       \
       /       |        \
Repository   Runtime    Contributions
  Port        Port        (Commands)
   │           │
   ▼           ▼
TauriPlugin  WorkerPluginRuntime
Repository       │
   │             │ postMessage RPC
   ▼             ▼
Rust Plugin   third-party main.js
Service
```

### Pattern responsibilities

- **Repository**：`PluginRepository` 隔离安装包、注册表、storage 等持久化细节；应用层不直接 `invoke()`。
- **Facade / Application Service**：`PluginManager` 只负责安装、启停、runtime reconciliation 与 command contribution 编排。
- **Command Pattern**：插件只贡献 command DTO；真正执行仍由自己的 Worker handler 完成，宿主命令面板只依赖统一 `AppCommand`。
- **Capability / Permission Gate**：manifest 声明权限，Worker 每次 RPC 都由宿主重新检查，不能靠插件自觉。
- **Actor-like Runtime**：每个插件一个 Dedicated Worker，以消息传递交互；插件不能持有主应用内部对象。
- **Namespaced Repository**：插件 storage 由宿主按 plugin id 分区，插件不知道真实磁盘路径。

### Trust boundary

```text
.mdvplugin ZIP
   ↓ Rust validation + safe extraction
Installed files (disabled by default)
   ↓ explicit user enable + permission review
Dedicated Worker
   ↓ typed messages only
Plugin Host
   ↓ permission gate
Stable application services
```

Worker 在插件代码运行前禁用常见网络/跨上下文入口，并且本身没有 DOM、`window`、Svelte Store、ProseMirror `EditorView` 或 Tauri globals。主 WebView CSP 仅额外允许 `blob:` Worker，不给第三方脚本增加主页面执行权限。

### Failure policy

- 插件 `onLoad` 5 秒未 ready：终止 Worker。
- 启动失败：记录到 Diagnostics，并在启动恢复阶段自动禁用，避免每次启动反复失败。
- Runtime fatal：移除该插件贡献的命令并尝试持久化为 disabled。
- 普通 command handler 抛错：只记录该命令错误，不自动杀掉整个插件。
- 应用关闭 / 禁用 / 卸载：先发 `onUnload`，短暂 grace period 后强制 terminate Worker。

后续 Editor、EventBus、Panel、快捷键等能力都应通过新的稳定 Port / Contribution 扩展，而不是把内部 `EditorView`、Svelte store 或 Tauri command 名直接暴露给插件。

- `PluginRuntimeFactory` / `PluginRuntime`：运行时 Port，应用层不依赖 Dedicated Worker 的具体实现。

## v0.18.1 Development Plugin Adapter

开发目录不是第二套插件运行时。Domain 只增加 `PluginSource`，Repository 负责把“正式安装目录”和“开发引用目录”解析成同一个 `PluginBundle`；`PluginManager` 与 `PluginRuntime` 完全不关心 bundle 来自哪里。

权限使用 requested/granted 分离模型：manifest 是 requested capabilities，registry 的 `grantedPermissions` 是用户上一次显式确认的 capability snapshot。只有 `requested ⊆ granted` 时已启用插件才能自动恢复运行。



## v0.18.2 Editor Port + Event Adapter

Editor/Event API 继续遵守 Ports & Adapters，不把 ProseMirror 或 Svelte 状态直接暴露成插件 ABI。

```text
WysiwygEditor (ProseMirror Adapter)
        │ attach stable controller
        ▼
EditorSessionRegistry                 ← Host Editor Port
        │                               \
        │ PluginHostServices             \ selection observer
        ▼                                 ▼
WorkerPluginRuntime  ◀────────── PluginEventBridge
        │ RPC / event                     ▲
        ▼                                 │
third-party Worker                 workspace/editor stores
```

- **EditorSessionRegistry / Facade**：只提供 `getDocument`、`getSelection`、`replaceSelection`、`insertText`；内部位置、Node、Transaction、DOM 都不出边界。
- **Adapter**：`WysiwygEditor` 把 ProseMirror transaction 适配到 `EditorSessionRegistry`，所以未来更换编辑器实现时 Plugin API 不需要跟着变化。
- **Observer**：`PluginEventBridge` 订阅宿主 workspace/editor/session 状态，翻译成稳定的 `PluginEvent` DTO，再由 `PluginManager.publishEvent()` 广播给 active runtimes。
- **Subscription filtering**：Worker 只有调用 `ctx.events.on()` 后才会接收对应事件；Runtime 记录订阅集合，不向未订阅插件发送无关消息。
- **Capability Gate**：事件订阅要求 `events`，读取正文/选区要求 `editor.read`，修改编辑器要求 `editor.write`。
- **Backpressure-lite**：selectionChanged 只发 `empty/textLength`，40ms 合并；`editor.changed` 只发统计/dirty，不广播完整 source。正文需要插件主动读取。

这层设计的目的不是把 ProseMirror 包一层同名 API，而是建立可长期兼容的“文本编辑能力契约”。


## v0.18.3 Contribution boundary

`PluginContributionRegistry` owns command/UI registrations independently of runtime lifecycle orchestration. Plugins submit declarative contributions over Worker RPC; Svelte surfaces render normalized DTOs only. No plugin DOM or host component references cross the boundary.


## v0.18.4 Sandboxed Panel Adapter

复杂插件 UI 使用两级隔离：插件逻辑继续运行在 Dedicated Worker，插件视图运行在 sandbox iframe。二者都不能访问主应用 DOM/Tauri，只通过 Host 中转的消息通道通信。

`PluginPanelMessageBus` 是纯应用层瞬时 broker；它不保存业务状态，也不依赖 Svelte。`PluginContributionRegistry` 只保存面板声明 DTO；`PluginPanelDrawer` 只是 iframe Adapter。这样未来把 iframe 换成独立 WebView 时，Plugin API 与 Manager 生命周期无需重写。


## v0.18.5 Schema-driven Plugin Settings

插件设置不作为任意 UI 注入，而是单独的 Application Port：

```text
Plugin Worker
  -> settings.register(schema)
  -> WorkerPluginRuntime validation
  -> PluginSettingsRegistry
  -> PluginManager.state.settingsSchemas
  -> PluginSettingForm (host-owned Svelte UI)

PluginSettingForm
  -> PluginManager.setPluginSetting
  -> PluginRepository namespaced storage
  -> WorkerPluginRuntime.emitSettingChanged
  -> ctx.settings.onChanged
```

`PluginSettingsRegistry` 只拥有 schema 生命周期；`plugin-settings.ts` 只拥有稳定值校验和宿主保留 storage namespace；`PluginManager` 负责 orchestration。这样以后设置 UI 从 Svelte 表单换成独立页面，或持久化从 JSON 换成其他实现，都不会改变插件 ABI。

Runtime 另外加入 soft-error circuit breaker：命令、事件、Panel handler 错误先隔离并记录，60 秒内达到 5 次才升级为 fatal，随后沿现有 `onFatal -> disable` 生命周期熔断。


## v0.18.6 Plugin Diagnostics / Health Model

运行时可观察性继续遵守单一职责：`PluginManager` 不保存错误窗口、统计或历史实现细节，而只在生命周期边界调用 `PluginDiagnosticsRegistry`。

```text
WorkerPluginRuntime
  -> typed recoverable diagnostic
  -> PluginManager callback
  -> PluginDiagnosticsRegistry
       |- bounded incident history
       |- recent error window
       |- health snapshot
       `- circuit-breaker trip count
  -> PluginManagerState DTO
  -> host-owned diagnostics UI
```

关键约束：

- 插件不能写自己的“健康状态”；状态完全由宿主根据 Runtime 生命周期和结构化异常计算。
- Diagnostics Registry 是会话级 Application Service，不进入插件 ABI，不与插件 storage 混存。
- 单插件历史有上限，消息长度有上限；诊断事件不包含文档正文，避免日志本身成为敏感数据/内存通道。
- `healthy -> degraded -> faulted` 与 `disabled` 分开：可恢复错误只降级；达到 Runtime 熔断条件或 fatal 才进入 faulted。
- 成功启动新的 Runtime 会清空“最近 60 秒”窗口但保留会话历史；手动清空诊断不会改变 Runtime 生命周期。
- Worker 启动时同一 fatal 可能同时表现为 callback 与 Promise rejection，Registry 负责按短窗口去重，而不是让 Manager 到处写特例。


## v0.18.7 Startup Recovery + Shortcut Policy

插件启动恢复仍遵守 Ports & Adapters：持久化 Guard 由 Rust `PluginService` / registry adapter 实现，`PluginManager` 只编排“开始启动会话 → 逐插件标记 → 完成会话”。第三方 Worker 看不到任何恢复状态，也不能关闭安全模式。

```text
application launch
  -> PluginRepository.beginStartupSession()
  -> registry.startupInProgress = true
  -> PluginManager.refresh()
  -> before each auto-load: markStartupPlugin(id)
  -> Worker runtime start
  -> markStartupPlugin(null)
  -> completeStartupSession()

next launch, if startupInProgress was still true
  -> registry.safeMode = true
  -> skip all automatic third-party runtime starts
  -> keep enabled/granted/data untouched
```

这不是“某插件启动失败就永远安全模式”：普通可捕获的 `runtime.start()` 失败仍走现有错误隔离并自动禁用该插件；只有进程/窗口在启动 Guard 尚未清除时异常中断，才触发跨启动恢复。

快捷键也单独抽为 `shortcut-policy.ts`：

- Plugin Runtime 只负责校验/规范化插件声明；
- `PluginContributionRegistry` 仍保存原始 Command Contribution；
- `shortcut-policy` 根据宿主保留快捷键 + 当前所有插件命令生成纯 DTO 冲突表；
- App 执行层只给“没有冲突”的插件命令挂快捷键；
- 命令本身不删除，所以 Command Palette 始终可用。

这样快捷键仲裁不是 `PluginManager`、Svelte UI 或 Worker 中的隐藏副作用，未来增加用户自定义快捷键时只需要替换 Policy/Binding 层。


## v0.18.8 Host-owned Shortcut Binding Layer

插件 Runtime 只声明 `defaultShortcut`，用户选择由独立的 `PluginShortcutRegistry` 覆盖：

```text
Worker command declaration
  -> PluginContributionRegistry (immutable default)
  -> PluginShortcutRegistry (host override)
  -> effective command DTO
  -> ShortcutPolicy conflict check
  -> App command dispatcher / Command Palette
```

持久化边界仍在 `PluginRepository` / Rust `PluginService`，registry v5 使用稳定 command id（`plugin.id:local-command`）保存 `custom | disabled` 状态。`PluginManager` 只编排写入与重新计算，不拥有快捷键语法或冲突规则。这样插件更新默认快捷键、Runtime 重载、未来增加全局快捷键设置页时都不需要修改插件 ABI。

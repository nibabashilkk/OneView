<div align="center">
  <img src="assets/branding/oneview-icon-1024.png" width="120" alt="oneView App Icon" />

# oneView

**一个小而快的跨平台多格式文件查看器。**

不用为了看一个 README 启动 IDE，也不用为了看 JSON、YAML、CSV 或日志文件打开一套重型工具。  
oneView 希望把这些高频的“打开 → 看一眼 → 找内容 → 关掉”操作，收进一个轻量、统一的桌面应用里。

**Small app. Many formats.**

Windows · macOS · Linux
</div>

---

## oneView 是什么？

oneView 是一个面向日常文档与开发文件的 **轻量级多格式 Viewer**。

它不是 IDE，也不试图把所有编辑、调试、终端、Git、AI 功能全部塞进一个应用。oneView 更关注一件事情：

> **让文件尽可能快地打开，并用适合该格式的方式把内容清楚地呈现出来。**

当前 Markdown 是内置核心能力；JSON、YAML、TOML、CSV、LOG、DIFF/PATCH 等格式通过官方 Document Plugin 提供。新的文件格式可以继续通过 `.mdvplugin` 扩展，而不必不断膨胀主程序。

### 为什么做 oneView？

日常工作里经常只是想快速确认一个文件：

```text
README.md
package.json
config.yaml
Cargo.toml
users.csv
server.log
changes.diff
```

这些文件当然都可以用 VS Code、Typora、Sublime Text 或其他专业工具打开，但“只是看一下”时，完整编辑器往往提供了远超当前任务所需的能力。

oneView 的取舍是：

- **轻量优先**：基于 Tauri 2 + Rust，使用系统 WebView，不内置一整套浏览器运行时。
- **启动路径短**：主程序只保留高频核心能力，额外格式交给插件。
- **阅读优先**：打开后直接进入适合该格式的展示，而不是先面对复杂工作台。
- **本地优先**：文件处理以本地为中心；Document Plugin 不需要网络权限。
- **可扩展，但不臃肿**：格式、主题和扩展能力共用统一插件平台。

> oneView 的目标不是宣称“世界上所有文件都能打开”，而是让常用格式可以持续扩展，同时保持主程序克制。

---

## 当前支持

### 内置核心

| 格式 | 能力 |
| --- | --- |
| Markdown | 富文本渲染、目录、搜索、代码高亮、Mermaid、KaTeX、所见即所得编辑、无损兼容性保护、HTML 导出、打印 / PDF |
| Plain Text | 当没有合适的结构化 Viewer 时安全回退为纯文本查看 |

### 官方 Document Plugins

| 插件 | 扩展名 | 主要展示方式 |
| --- | --- | --- |
| JSON Viewer | `.json` | JSON Tree、折叠、搜索、类型/数量提示 |
| YAML Viewer | `.yaml` `.yml` | 结构化开发文档查看 |
| TOML Viewer | `.toml` | 结构化配置查看 |
| CSV Viewer | `.csv` | 表格化查看 |
| LOG Viewer | `.log` | 面向日志内容的阅读布局 |
| DIFF Viewer | `.diff` `.patch` | 增删差异查看 |
| Developer Pack | 上述全部 | 一次安装常用开发文件格式 |

插件未安装、未启用或解析失败时，oneView 会优先保护可访问性：**回退到 Plain Text，而不是让文件彻底打不开。**

---

## 主要功能

### ⚡ 小而快

oneView 从架构上就把“小安装包”和“快速打开”当成约束，而不是发布前再做一次体积优化。

- Tauri 2 + Rust 桌面壳
- 系统 WebView
- Markdown Core 与其他格式解析器解耦
- 非核心格式按需安装
- Windows 不携带额外 Explorer Preview Handler / COM DLL
- 插件 Runtime 与主界面隔离

实际安装包大小以每个 Release 的构建产物为准；README 不使用未经发布构建验证的体积数字做宣传。

### 📄 一个应用，看多种文件

文件查看不应该意味着“所有格式都用同一个纯文本编辑器打开”。

oneView 通过 Document Plugin 为不同格式提供不同阅读体验，同时保持统一的标签页、搜索、主题、快捷键和窗口交互。

### ✍️ Markdown 不只是预览

Markdown 是 oneView 当前唯一内置的富文档 Core：

- 所见即所得编辑
- 自动保存
- 文件变更监听
- 文档目录
- 文档内搜索
- Mermaid 图表
- KaTeX 数学公式
- 代码语法高亮
- 表格
- HTML 导出
- 打印 / PDF
- 无损 round-trip 保护

对于无法安全无损编辑的高级 Markdown 结构，oneView 会进入安全预览，而不是冒险覆盖原文件。

### 🧩 插件化格式支持

oneView 的插件不是简单往主页面注入 JavaScript。

统一 Plugin Platform 支持三类贡献：

```text
Plugin Platform
├─ Document Plugin   → 新文件格式 Viewer
├─ Theme Plugin      → App / Reader / Syntax 完整视觉主题
└─ Extension Plugin  → 命令、编辑器能力、事件、设置、Panel 等
```

其中：

- Document Plugin 必须零权限，并运行在隔离 Worker 中；
- Theme Plugin 是声明式 JSON，**0 JS / 0 Worker / 0 permissions**；
- Extension Plugin 的能力必须通过 manifest 显式申请；
- Safe Mode 可以暂停第三方 Worker Runtime，同时保留声明式主题。

详见：[`docs/PLUGIN_SECURITY.md`](docs/PLUGIN_SECURITY.md) 与 [`docs/PLUGIN_DEVELOPMENT.md`](docs/PLUGIN_DEVELOPMENT.md)。

### 🎨 一套主题控制整个应用

主题不是只换 Markdown 配色。

Theme Plugin 同时控制：

```text
app.*      → 顶栏 / 侧栏 / 设置 / 插件中心
reader.*   → Markdown 正文
syntax.*   → 代码语法高亮
```

阅读设置只保留字体、字号、行高、正文宽度等个人排版偏好，不再维护一套与主题互相覆盖的“阅读样式”。

### 🗂 Workspace 与多标签

- 打开单文件或整个文件夹
- 多标签页
- 文件树
- Workspace 搜索
- Markdown 目录
- 最近文件 / 最近工作区
- 外部文件修改检测
- 拖拽打开

---

## 和其他软件有什么区别？

下面是**产品定位对比，不是性能跑分**。不同工具解决的问题不同，oneView 并不试图替代所有编辑器。

| | **oneView** | **mdview** | **Typora** | **VS Code** | **Sublime Text** | **macOS Quick Look** |
| --- | --- | --- | --- | --- | --- | --- |
| 核心定位 | 轻量多格式文件查看器 | 极轻量 Markdown Viewer / Editor | Markdown 编辑器与阅读器 | 完整代码编辑 / 开发工作台 | 通用文本 / 代码编辑器 | 系统级快速预览 |
| Markdown 富渲染 | ✅ 内置核心 | ✅ 核心 | ✅ 核心 | ✅ 内置预览 | 以文本/Markup 编辑为主 | 取决于系统支持 |
| Markdown 所见即所得 | ✅ | ✅ Pro | ✅ | 不是核心模式 | ❌ | ❌ |
| JSON / YAML / TOML / CSV / LOG / DIFF | ✅ 官方插件，按格式展示 | ❌ 主要面向 Markdown | 不是核心定位 | ✅ 主要作为代码/文本编辑 | ✅ 主要作为文本编辑 | 取决于系统预览能力 |
| 可继续增加文件 Viewer | ✅ Document Plugin | 非主要方向 | 非主要方向 | ✅ Extension | ✅ Package | 系统/扩展能力决定 |
| 完整开发能力 | ❌ 刻意不做 IDE | ❌ | ❌ | ✅ Terminal / Debug / Git / AI 等 | △ 强文本编辑 + 插件 | ❌ |
| 阅读优先界面 | ✅ | ✅ | 编辑与阅读并重 | 开发工作台优先 | 编辑器优先 | ✅ |
| 小安装包作为设计目标 | ✅ | ✅（官网主打 2 MB） | 不是首要定位 | 不是首要定位 | 强调高性能编辑 | 系统自带 |
| Windows / macOS / Linux | ✅ | Windows / macOS / Android | ✅ | ✅ | ✅ | macOS only |

### oneView vs mdview

两者都强调“不要为了看一个 Markdown 文件启动重型编辑器”，但方向已经不同：

- **mdview** 专注 Markdown，并把极小安装包作为核心卖点；
- **oneView** 把 Markdown 作为一个高质量内置 Core，同时把产品边界扩展到 JSON、YAML、TOML、CSV、LOG、DIFF/PATCH 等多格式文件查看，并通过插件继续扩展。

如果你的需求只有 Markdown 阅读，专用 Markdown Viewer 会非常直接；如果你希望一个轻量应用承担更多日常文件查看任务，oneView 的方向更合适。

### oneView vs Typora

Typora 的核心体验是 Markdown 写作：实时所见即所得、排版和写作体验都围绕 Markdown 展开。

oneView 的核心则是 **“打开不同类型的文件并快速看懂”**。Markdown 编辑是能力之一，而不是整个产品边界。

### oneView vs VS Code

VS Code 是完整开发工作台，包含代码理解、调试、测试、Git、终端、扩展以及 AI 开发能力。

这些能力非常强，但 oneView 刻意不复制它们。只是查看 `package.json`、一份日志或 README 时，oneView 希望提供更短、更安静的路径。

### oneView vs Sublime Text

Sublime Text 是高性能的通用文本编辑器，擅长代码、Markup 和文本编辑，并拥有成熟的 Package 扩展能力。

oneView 更强调“格式感知的查看”：CSV 应该像表格、JSON 应该能展开树、DIFF 应该突出增删，而不是所有文件最终都落到同一种文本编辑器界面。

### oneView vs macOS Quick Look

Quick Look 的优势是系统级、无需真正打开 App，就能按空格快速预览大量文件类型。

oneView 更像 Quick Look 与轻量桌面应用之间的中间层：有独立窗口、多标签、Workspace、搜索、插件和可编辑 Markdown，同时仍然坚持查看优先。

> 参考：
> - [mdview](https://www.mdview.top/)
> - [Typora](https://typora.io/)
> - [Visual Studio Code](https://code.visualstudio.com/)
> - [Sublime Text](https://www.sublimetext.com/)
> - [Apple Quick Look](https://support.apple.com/guide/mac-help/view-and-edit-files-with-quick-look-mh14119/mac)

---

## 为什么不是“再做一个万能编辑器”？

因为“能做更多”并不总等于“用起来更快”。

oneView 希望长期坚持这几个边界：

1. **Viewer first** —— 查看优先，编辑只在真正有价值的格式上提供。
2. **Core stays small** —— 新格式优先通过 Document Plugin 增加，不轻易塞回主程序。
3. **Local first** —— 查看本地文件不应该默认依赖云服务。
4. **Graceful fallback** —— 没有专用 Viewer，也至少应该能安全看到文本内容。
5. **No format lock-in** —— 产品名和架构都不再绑定 Markdown。

---

## 技术架构

```text
oneView
├─ Tauri 2 / Rust
│  ├─ 文件系统 / Workspace
│  ├─ 设置与持久化
│  ├─ 文件监听
│  ├─ 系统文件关联
│  └─ Plugin 安装与安全校验
│
├─ Svelte 5 / TypeScript
│  ├─ App Shell
│  ├─ Reader / Editor
│  ├─ Workspace
│  ├─ Settings
│  └─ Plugin Center
│
├─ Markdown Core
│  ├─ markdown-it
│  ├─ ProseMirror
│  ├─ Mermaid
│  ├─ KaTeX
│  └─ highlight.js
│
└─ Plugin Platform
   ├─ Document Plugins
   ├─ Theme Plugins
   └─ Extension Plugins
```

更多设计细节见 [`ARCHITECTURE.md`](ARCHITECTURE.md)。

---

## 开发运行

### 环境

- Node.js 22+
- Rust stable
- Tauri 2 所需平台依赖

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 前端检查

```bash
npm run check
npm run build
```

### 正式打包

```bash
npm run tauri build
```

---

## 多平台发布

项目已经配置 GitHub Actions：

```text
.github/workflows/
├─ ci.yml
└─ release.yml
```

推送版本 Tag：

```bash
git tag v0.21.10
git push origin v0.21.10
```

Release Workflow 会使用 GitHub 官方 Runner 构建：

- Windows x64 → NSIS Installer
- macOS → Universal DMG（Apple Silicon + Intel）
- Linux x64 → AppImage / deb

完整说明见 [`docs/GITHUB_RELEASE.md`](docs/GITHUB_RELEASE.md)。

---

## 系统集成

### macOS

Finder “打开方式”可以把 oneView 作为以下格式的候选应用：

```text
Markdown
JSON
YAML
TOML
CSV
LOG
DIFF / PATCH
```

这些关联使用 `Alternate` rank，不会在安装时主动抢占用户已有默认应用。

### Windows

当前正式系统关联保持克制：默认只注册 Markdown，并提供 oneView 的 Explorer 右键操作。Windows Explorer Preview Handler 已移除，以保持安装与维护链路简单。

---

## 官方插件

源码位于 [`official-plugins/`](official-plugins/)：

```text
json-viewer
yaml-viewer
toml-viewer
csv-viewer
log-viewer
diff-viewer
developer-pack
slate-theme
```

构建后的 `.mdvplugin` 位于：

```text
official-plugins/dist/
```

---

## 许可证与商业使用

oneView 采用 **PolyForm Noncommercial License 1.0.0** 的源码可见授权模式。

这意味着：

- 个人学习、研究、实验和其他非商业用途，可在许可证允许的范围内使用、修改和分发源码；
- **商业使用不包含在当前仓库许可证中**，包括付费产品、商业服务、换皮销售、商业捆绑分发或其他以商业利益为目的的使用；
- 如需商业使用，需要获得 oneView 项目所有者单独授予的商业许可证；
- oneView 名称、Logo 与品牌视觉不随源码许可证授权复用；
- 第三方依赖继续遵循各自原始许可证。

完整说明见 [`LICENSE`](LICENSE)。贡献代码前请同时阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

> 这是一种 **source-available（源码可见）** 模式，不是 MIT / Apache-2.0 这类允许自由商业使用的宽松开源授权。这样可以公开代码、接受社区贡献，同时为后续商业版和双许可证保留空间。

---

## 项目状态

当前版本：**v0.21.10**

oneView 仍处于快速迭代阶段。现阶段重点是：

- 保持小而快的主程序
- 完善多格式 Viewer
- 稳定 Plugin Platform
- 提升大文件体验
- 保持 Windows / macOS / Linux 一致性

后续格式会优先通过插件增加，而不是为了“格式数量”牺牲核心体积与启动速度。

完整版本记录请看 [`CHANGELOG.md`](CHANGELOG.md)。

---

## 适合谁？

如果你经常遇到下面这些场景，oneView 就是为这类工作流设计的：

- “我只想快速看一下这个 README。”
- “这个 JSON 太长了，我想展开看结构。”
- “CSV 不值得专门启动 Excel。”
- “我只是想确认一下 YAML / TOML 配置。”
- “这份日志到底哪里报错了？”
- “这个 patch 改了什么？”
- “我不想每看一个小文件都启动完整 IDE。”

**一个应用，少一点等待，多看几种文件。**

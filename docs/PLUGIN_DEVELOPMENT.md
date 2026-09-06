# oneView Plugin API v1 — v0.21

> v0.21 将插件改为 **Contribution-first**。`contributes` 描述插件提供什么；只有确实需要执行代码时才声明 Worker runtime。Plugin API 仍为 v1。

## 包结构

`.mdvplugin` 本质是 ZIP，根目录必须有 `manifest.json`。声明式插件可以完全没有 JavaScript。

### Theme Plugin：0 JS / 0 Worker

```json
{
  "id": "com.example.slate-theme",
  "name": "Slate Theme",
  "version": "1.0.0",
  "apiVersion": 1,
  "minAppVersion": "0.21.0",
  "permissions": [],
  "contributes": {
    "themes": [
      {
        "id": "slate.light",
        "family": "slate",
        "label": "Slate",
        "variant": "light",
        "scope": ["app", "reader", "syntax"],
        "path": "themes/slate-light.json"
      }
    ]
  }
}
```

Theme JSON 使用 `schemaVersion: 1`，并重复声明 `id/family/variant/scope`，宿主会与 manifest 做一致性校验。token 只能来自 App / Reader / Syntax Semantic Token schema。Theme Plugin 不能声明 permissions，也不允许用 `documentFormats`。

### Document Plugin：可选 Worker descriptor

```json
{
  "id": "com.example.json-viewer",
  "name": "JSON Viewer",
  "version": "1.0.0",
  "apiVersion": 1,
  "minAppVersion": "0.21.0",
  "runtime": { "kind": "worker", "role": "document", "main": "main.js" },
  "permissions": [],
  "contributes": {
    "documentFormats": [
      { "id": "json", "label": "JSON", "extensions": ["json"] }
    ]
  }
}
```

Document Worker 必须零权限；`onLoad(ctx)` 得到空、冻结的 context。renderer 返回的 HTML 仍由宿主 sanitizer 清洗。

### Extension Plugin

```json
{
  "id": "com.example.tools",
  "name": "Tools",
  "version": "1.0.0",
  "apiVersion": 1,
  "minAppVersion": "0.21.0",
  "runtime": { "kind": "worker", "role": "extension", "main": "main.js" },
  "permissions": ["commands", "ui.notice"],
  "contributes": {}
}
```

Extension Worker 只能调用 manifest 明确申请并经 Host-side guard 再次检查的 capability；它不能贡献 `documentFormats`。

## v0.20 compatibility

以下旧写法继续支持：

```json
{ "main": "main.js", "runtime": "document" }
```

没有 `runtime` 但存在 `main` 的旧插件也保留 v0.19/v0.20 推断逻辑。新插件应统一使用 v0.21 descriptor。

## Theme scope 与 token

- `app`：应用 chrome、surface、border、text、accent、hover、shadow。
- `reader`：正文 background/text/heading/link/border/code/selection/blockquote。
- `syntax`：comment/keyword/string/number/function/type/variable。
- v0.21.4 起 Reader 没有独立 Profile；正文视觉只消费当前 Theme 的 `reader.*` / `syntax.*` token。字体、字号、行高与正文宽度属于用户排版偏好，不由颜色主题强制覆盖。
- 同一 family 的 Light / Dark 必须拥有完全相同的 scope；同一 family 不允许重复 Light 或重复 Dark。
- Theme JSON 单文件上限由宿主限制；token 值必须为非空短字符串，不能包含控制字符。

## 安全模式

Safe Mode 只停止 Worker runtime。Theme 等纯声明 contribution 继续工作，因为它们不执行插件代码。

## 开发模式

开发目录中的 manifest/main/style/icon/theme 文件都必须是插件根目录内的相对路径。Rust 会 canonicalize 最终文件并再次确认它仍位于插件根目录，因此 symlink 不能用来读取目录外文件。

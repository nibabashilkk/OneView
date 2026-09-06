import type { RenderedDocument } from "./contracts";

export const sampleDocument: RenderedDocument = {
  id: "sample",
  path: "README.md",
  fileName: "README.md",
  format: "markdown",
  editable: true,
  encoding: "UTF-8",
  lineEnding: "LF",
  source: `# oneView\n\n浏览器预览模式示例。\n`,
  modifiedAtMs: Date.now(),
  sizeBytes: 2140,
  lineCount: 68,
  wordCount: 286,
  characterCount: 842,
  estimatedReadMinutes: 1,
  compatibility: { level: "safe", canWysiwyg: true, semanticSafe: true, sourceStyleStable: true, issues: [] },
  outline: [
    { id: "markdown-viewer", level: 1, title: "oneView" },
    { id: "rich-markdown", level: 2, title: "富 Markdown" },
    { id: "architecture", level: 2, title: "架构" },
    { id: "code", level: 2, title: "代码示例" },
  ],
  html: `
    <h1 id="markdown-viewer">oneView</h1>
    <p>一个面向 AI 文档和本地 Markdown 文件的轻量桌面阅读器。按 <code>Ctrl/Cmd + F</code> 可以在当前文档内搜索。</p>
    <blockquote><p>浏览器模式使用这份示例；Tauri 桌面模式可以直接打开、拖入或双击本地 Markdown。</p></blockquote>
    <h2 id="rich-markdown">富 Markdown</h2>
    <p>公式示例：<span class="math-inline" data-math="inline">E = mc^2</span></p>
    <div class="math-display" data-math="display">\\int_0^1 x^2 \\, dx = \\frac{1}{3}</div>
    <pre><code class="language-mermaid">flowchart LR\n  A[打开 Markdown] --> B[Rust 解析]\n  B --> C[安全 HTML]\n  C --> D[Svelte 增强渲染]</code></pre>
    <h2 id="architecture">架构</h2>
    <table><thead><tr><th>层</th><th>职责</th></tr></thead><tbody>
      <tr><td>Svelte</td><td>UI、搜索、Mermaid/KaTeX、代码高亮</td></tr>
      <tr><td>Tauri</td><td>桌面桥接、单实例、文件事件</td></tr>
      <tr><td>app-core</td><td>文档模型与格式协议</td></tr>
      <tr><td>markdown-core</td><td>Markdown 解析、安全转换、目录</td></tr>
    </tbody></table>
    <h2 id="code">代码示例</h2>
    <pre><code class="language-rust">pub trait DocumentFormat {\n    fn id(&self) -> &'static str;\n    fn render(&self, input: &DocumentInput) -> Result&lt;RenderedDocument, CoreError&gt;;\n}</code></pre>
  `,
};

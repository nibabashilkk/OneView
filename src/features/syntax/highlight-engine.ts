import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

export type HighlightRange = {
  from: number;
  to: number;
  classes: string;
};

const languageAliases: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  c: "cpp",
  cc: "cpp",
  "c++": "cpp",
  h: "cpp",
  hpp: "cpp",
  cs: "csharp",
  "c#": "csharp",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  md: "markdown",
  py: "python",
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  html: "xml",
  svg: "xml",
  vue: "xml",
  svelte: "xml",
  yml: "yaml",
};

let registered = false;

export function ensureHighlightLanguages() {
  if (registered) return;
  registered = true;

  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("csharp", csharp);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("go", go);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("markdown", markdown);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("sql", sql);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("yaml", yaml);

  for (const [alias, languageName] of Object.entries(languageAliases)) {
    hljs.registerAliases([alias], { languageName });
  }
}

export function resolveHighlightLanguage(raw: string): string | null {
  ensureHighlightLanguages();
  const first = raw.trim().split(/\s+/)[0]?.toLocaleLowerCase() ?? "";
  if (!first || first === "text" || first === "txt" || first === "plain" || first === "plaintext") return null;
  const normalized = languageAliases[first] ?? first;
  return hljs.getLanguage(normalized) ? normalized : null;
}

export function displayLanguage(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  if (!first) return "TEXT";
  const normalized = languageAliases[first.toLocaleLowerCase()] ?? first.toLocaleLowerCase();
  const labels: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    csharp: "C#",
    cpp: "C++",
    markdown: "Markdown",
    python: "Python",
    rust: "Rust",
    bash: "Bash",
    yaml: "YAML",
    json: "JSON",
    css: "CSS",
    xml: first.toLocaleLowerCase() === "html" ? "HTML" : "XML",
    sql: "SQL",
    java: "Java",
    go: "Go",
  };
  return labels[normalized] ?? first.toLocaleUpperCase();
}

export function highlightRanges(source: string, rawLanguage: string): HighlightRange[] {
  const language = resolveHighlightLanguage(rawLanguage);
  if (!language || !source) return [];

  // Re-highlighting very large blocks on every editor keystroke can stall the WebView.
  // Keep the editor responsive and leave those blocks as plain monospace text.
  if (source.length > 40_000) return [];

  const result = hljs.highlight(source, { language, ignoreIllegals: true });
  const template = document.createElement("template");
  template.innerHTML = result.value;

  const ranges: HighlightRange[] = [];
  let offset = 0;

  const visit = (node: Node, inheritedClasses: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const start = offset;
      offset += text.length;
      if (text.length && inheritedClasses.length) {
        ranges.push({ from: start, to: offset, classes: inheritedClasses.join(" ") });
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach((child) => visit(child, inheritedClasses));
      return;
    }

    const own = [...node.classList].filter((name) => name.startsWith("hljs-"));
    const classes = own.length ? [...inheritedClasses, ...own] : inheritedClasses;
    node.childNodes.forEach((child) => visit(child, classes));
  };

  template.content.childNodes.forEach((child) => visit(child, []));
  return ranges;
}

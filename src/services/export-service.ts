import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { ResolvedTheme } from "../stores/theme";
import type { UserSettings } from "../lib/contracts";
import { isTauri } from "../lib/runtime";
import { themeRegistry } from "../features/themes";

export async function exportHtml(
  fileName: string,
  article: HTMLElement,
  settings: UserSettings,
  resolvedTheme: ResolvedTheme,
): Promise<string | null> {
  const html = await buildStandaloneHtml(fileName, article, settings, resolvedTheme);
  const defaultName = `${withoutExtension(fileName)}.html`;
  if (!isTauri()) {
    downloadText(defaultName, html, "text/html;charset=utf-8");
    return defaultName;
  }

  const path = await save({
    title: "导出 HTML",
    defaultPath: defaultName,
    filters: [{ name: "HTML", extensions: ["html", "htm"] }],
  });
  if (!path) return null;
  await invoke("write_export_file", { path, contents: html });
  return path;
}

export function printPdf(): void {
  // WebView2/WKWebView 使用当前页面的打印管线；用户可在系统/浏览器打印面板选择“保存为 PDF”。
  window.print();
}

async function buildStandaloneHtml(
  title: string,
  article: HTMLElement,
  settings: UserSettings,
  resolvedTheme: ResolvedTheme,
): Promise<string> {
  const clone = article.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("mark.search-hit").forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent ?? "")));
  clone.querySelectorAll("[data-local-path],[data-local-markdown],[data-local-exists],[data-local-fragment]").forEach((node) => {
    [...node.attributes].filter((attr) => attr.name.startsWith("data-local-")).forEach((attr) => node.removeAttribute(attr.name));
  });
  clone.classList.remove("large-document");
  await inlineImages(clone);

  const font = settings.fontFamily === "serif"
    ? 'ui-serif, Georgia, "Times New Roman", "Songti SC", "SimSun", serif'
    : settings.fontFamily === "mono"
      ? '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  const palette = exportedPalette(resolvedTheme);
  const syntax = themeRegistry.activeTokens(resolvedTheme);
  const katex = clone.querySelector(".katex")
    ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.5/dist/katex.min.css">'
    : "";
  const css = `
    :root{color-scheme:${resolvedTheme};}*{box-sizing:border-box}body{margin:0;background:${palette.page};color:${palette.text};font-family:${font}}
    .markdown-body{max-width:${settings.contentWidth}px;margin:0 auto;padding:48px 42px 80px;font-size:${settings.fontSize}px;line-height:${settings.lineHeight};overflow-wrap:break-word}
    .markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4{line-height:1.3;color:${palette.heading}}.markdown-body h1{font-size:2em;letter-spacing:-.03em}.markdown-body h2{margin-top:2.2em;padding-bottom:.4em;border-bottom:1px solid ${palette.border};font-size:1.45em}.markdown-body h3{margin-top:1.8em;font-size:1.15em}
    .markdown-body a{color:${palette.link};text-decoration:none}.markdown-body a:hover{text-decoration:underline}.markdown-body blockquote{margin:1em 0;border-left:3px solid ${palette.border};padding:.25em 1em;color:${palette.muted}}
    .markdown-body code{border-radius:.3em;background:${palette.soft};padding:.12em .35em;font-family:"SFMono-Regular",Consolas,monospace;font-size:.88em}.markdown-body pre{overflow:auto;border:1px solid ${palette.border};border-radius:.65em;background:${palette.soft};padding:1em;line-height:1.6}.markdown-body pre code{background:transparent;padding:0;font-size:${settings.codeFontSize}px}
    .markdown-body table{width:100%;border-collapse:collapse}.markdown-body th,.markdown-body td{border:1px solid ${palette.border};padding:.55em .7em;text-align:left}.markdown-body th{background:${palette.soft}}.markdown-body img{max-width:100%;height:auto;border-radius:.5em}.markdown-body hr{border:0;border-top:1px solid ${palette.border}}
    .hljs-comment,.hljs-quote{color:${syntax["syntax.comment"]};font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section{color:${syntax["syntax.keyword"]}}.hljs-string,.hljs-regexp,.hljs-symbol{color:${syntax["syntax.string"]}}.hljs-number,.hljs-meta,.hljs-built_in{color:${syntax["syntax.number"]}}.hljs-title,.hljs-title.class_,.hljs-title.function_{color:${syntax["syntax.function"]}}
    .mermaid-block{margin:1.25em 0;overflow:auto;border:1px solid ${palette.border};border-radius:.75em;background:${palette.soft};padding:1em;text-align:center}.mermaid-block svg{max-width:100%;height:auto}.math-display{margin:1.25em 0;overflow:auto;text-align:center}
    @media print{body{background:#fff;color:#111}.markdown-body{max-width:none;padding:0 8mm}.markdown-body a{color:inherit;text-decoration:none}pre,blockquote,table,img,.mermaid-block{break-inside:avoid}}
  `;
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${katex}<style>${css}</style></head><body><article class="markdown-body">${clone.innerHTML}</article></body></html>`;
}

async function inlineImages(root: HTMLElement) {
  const images = [...root.querySelectorAll<HTMLImageElement>("img")];
  for (const image of images) {
    const src = image.src;
    if (!src || src.startsWith("data:")) continue;
    try {
      const response = await fetch(src);
      if (!response.ok) continue;
      const blob = await response.blob();
      image.src = await blobToDataUrl(blob);
      image.removeAttribute("srcset");
    } catch {
      // 外部资源不可取时保留原地址，导出本身仍然可用。
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function exportedPalette(resolvedTheme: ResolvedTheme) {
  const tokens = themeRegistry.activeTokens(resolvedTheme);
  return {
    page: tokens["reader.background"] ?? (resolvedTheme === "dark" ? "#09090b" : "#ffffff"),
    text: tokens["reader.text"] ?? (resolvedTheme === "dark" ? "#e4e4e7" : "#27272a"),
    heading: tokens["reader.heading"] ?? (resolvedTheme === "dark" ? "#f4f4f5" : "#18181b"),
    muted: tokens["reader.muted"] ?? (resolvedTheme === "dark" ? "#a1a1aa" : "#71717a"),
    border: tokens["reader.border"] ?? (resolvedTheme === "dark" ? "#27272a" : "#e4e4e7"),
    soft: tokens["reader.soft"] ?? (resolvedTheme === "dark" ? "#18181b" : "#f4f4f5"),
    link: tokens["reader.link"] ?? (resolvedTheme === "dark" ? "#60a5fa" : "#2563eb"),
  };
}

function downloadText(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function withoutExtension(fileName: string) {
  return fileName.replace(/\.(md|markdown|mdown|mkd|txt|text|json|ya?ml|csv|toml|log|diff|patch)$/i, "") || "document";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[char] ?? char);
}

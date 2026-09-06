import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "../lib/runtime";

export async function copyPlainText(text: string): Promise<void> {
  if (isTauri()) {
    await writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

export async function copyRichHtml(html: string, altText: string): Promise<void> {
  const portableHtml = await inlineImages(html);
  if (isTauri()) {
    await writeHtml(portableHtml, altText);
    return;
  }

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([portableHtml], { type: "text/html" }),
        "text/plain": new Blob([altText], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(altText);
}

export async function copyHtmlSource(html: string): Promise<void> {
  await copyPlainText(html);
}

export function cleanHtmlFragment(html: string): { html: string; text: string } {
  const host = document.createElement("div");
  host.innerHTML = html;
  cleanRuntimeMarkup(host);
  return {
    html: host.innerHTML,
    text: normalizePlainText(host.innerText || host.textContent || ""),
  };
}

export function cleanArticle(article: HTMLElement): { html: string; text: string } {
  const clone = article.cloneNode(true) as HTMLElement;
  cleanRuntimeMarkup(clone);
  return {
    html: clone.innerHTML,
    text: normalizePlainText(clone.innerText || clone.textContent || ""),
  };
}

function cleanRuntimeMarkup(root: HTMLElement) {
  root.querySelectorAll("mark.search-hit").forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });
  root.querySelectorAll("[data-local-path],[data-local-markdown],[data-local-exists],[data-local-fragment]").forEach((node) => {
    [...node.attributes]
      .filter((attr) => attr.name.startsWith("data-local-"))
      .forEach((attr) => node.removeAttribute(attr.name));
  });
  root.querySelectorAll("[data-image-state]").forEach((node) => node.removeAttribute("data-image-state"));
  root.classList.remove("large-document");
}

async function inlineImages(html: string): Promise<string> {
  const host = document.createElement("div");
  host.innerHTML = html;
  const images = [...host.querySelectorAll<HTMLImageElement>("img")];
  for (const image of images) {
    const src = image.src;
    if (!src || src.startsWith("data:")) continue;
    try {
      const response = await fetch(src);
      if (!response.ok) continue;
      image.src = await blobToDataUrl(await response.blob());
      image.removeAttribute("srcset");
    } catch {
      // 远程或不可访问图片保留原地址，不影响其余富文本复制。
    }
  }
  applyPortableStyles(host);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#27272a">${host.innerHTML}</div>`;
}

function applyPortableStyles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((node) => {
    node.style.fontWeight = "700";
    node.style.lineHeight = "1.3";
    node.style.margin = "1.2em 0 .6em";
  });
  root.querySelectorAll<HTMLElement>("p,ul,ol,blockquote,pre,table").forEach((node) => {
    node.style.margin = ".8em 0";
  });
  root.querySelectorAll<HTMLElement>("blockquote").forEach((node) => {
    node.style.borderLeft = "3px solid #d4d4d8";
    node.style.paddingLeft = "1em";
    node.style.color = "#71717a";
  });
  root.querySelectorAll<HTMLElement>("pre").forEach((node) => {
    node.style.whiteSpace = "pre-wrap";
    node.style.background = "#f4f4f5";
    node.style.border = "1px solid #e4e4e7";
    node.style.borderRadius = "8px";
    node.style.padding = "12px";
  });
  root.querySelectorAll<HTMLElement>("code").forEach((node) => {
    node.style.fontFamily = "Consolas,Menlo,monospace";
  });
  root.querySelectorAll<HTMLTableElement>("table").forEach((node) => {
    node.style.borderCollapse = "collapse";
    node.style.width = "100%";
  });
  root.querySelectorAll<HTMLElement>("th,td").forEach((node) => {
    node.style.border = "1px solid #d4d4d8";
    node.style.padding = "6px 9px";
  });
  root.querySelectorAll<HTMLImageElement>("img").forEach((node) => {
    node.style.maxWidth = "100%";
    node.style.height = "auto";
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function normalizePlainText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

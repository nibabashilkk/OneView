import type { RenderedDocument } from "../../../lib/contracts";
import type { ActivePluginDocumentFormat, PluginDocumentRenderResult } from "../domain/plugin";

const ALLOWED_TAGS = new Set([
  "DIV", "SPAN", "DETAILS", "SUMMARY", "BUTTON", "PRE", "CODE",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "COLGROUP", "COL",
  "P", "UL", "OL", "LI", "STRONG", "EM", "B", "I", "S", "SMALL", "BR", "HR", "A",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "class", "title", "open", "type", "role", "aria-hidden", "aria-label", "aria-expanded",
  "data-plugin-action", "data-depth", "colspan", "rowspan", "scope", "href",
]);

const ALLOWED_CLASS_PREFIXES = [
  "plugin-", "structured-", "json-", "tree-", "csv-", "log-", "diff-", "language-",
] as const;

/**
 * Plugin document renderers execute in a Worker, but their returned markup eventually reaches
 * the app DOM. Keep that capability narrow: no scripts, styles, event attributes, images,
 * embeds, forms, arbitrary data-* or javascript/file URLs.
 */
export function sanitizePluginDocumentHtml(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<div id="mdv-plugin-root">${html}</div>`, "text/html");
  const root = document.getElementById("mdv-plugin-root");
  if (!root) return "";

  const elements = [...root.querySelectorAll("*")];
  for (const element of elements) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (!ALLOWED_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "class") {
        const classes = attribute.value
          .split(/\s+/)
          .filter((token) => token && ALLOWED_CLASS_PREFIXES.some((prefix) => token.startsWith(prefix)))
          .slice(0, 24);
        if (classes.length > 0) element.setAttribute("class", classes.join(" "));
        else element.removeAttribute("class");
      }
      if (name === "href") {
        const href = attribute.value.trim();
        if (!/^(https?:|mailto:|tel:|#)/i.test(href)) element.removeAttribute(attribute.name);
      }
    }
    if (element.tagName === "BUTTON") element.setAttribute("type", "button");
  }
  return root.innerHTML;
}

export function applyPluginDocumentRender(
  base: RenderedDocument,
  format: ActivePluginDocumentFormat,
  result: PluginDocumentRenderResult,
): RenderedDocument {
  return {
    ...base,
    format: format.id,
    editable: false,
    html: `<div class="plugin-document" data-plugin-id="${escapeAttribute(format.pluginId)}" data-plugin-format="${escapeAttribute(format.id)}">${sanitizePluginDocumentHtml(result.html)}</div>`,
    outline: result.outline ?? [],
    compatibility: {
      level: "sourceOnly",
      canWysiwyg: false,
      semanticSafe: true,
      sourceStyleStable: true,
      issues: [],
    },
    lineCount: result.lineCount ?? base.lineCount,
    wordCount: result.wordCount ?? base.wordCount,
    characterCount: result.characterCount ?? base.characterCount,
    estimatedReadMinutes: result.estimatedReadMinutes ?? base.estimatedReadMinutes,
  };
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

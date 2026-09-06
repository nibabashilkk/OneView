import MarkdownIt from "markdown-it";
import { Schema, type MarkSpec, type Node as ProseMirrorNode } from "prosemirror-model";
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
  schema as baseMarkdownSchema,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import { tableNodes } from "prosemirror-tables";

const strike: MarkSpec = {
  parseDOM: [
    { tag: "s" },
    { tag: "del" },
    { tag: "strike" },
    { style: "text-decoration=line-through" },
  ],
  toDOM() {
    return ["s", 0];
  },
};

const specialNodes = {
  mermaid_block: {
    group: "block",
    atom: true,
    selectable: true,
    attrs: { source: { default: "graph TD\n  A --> B" } },
    parseDOM: [{ tag: "div[data-mermaid-source]", getAttrs: (dom: HTMLElement) => ({ source: dom.dataset.mermaidSource ?? "" }) }],
    toDOM(node: ProseMirrorNode) {
      return ["div", { "data-mermaid-source": node.attrs.source, class: "pm-mermaid-node" }, "Mermaid"];
    },
  },
  math_block: {
    group: "block",
    atom: true,
    selectable: true,
    attrs: { source: { default: "" } },
    parseDOM: [{ tag: "div[data-math-block]", getAttrs: (dom: HTMLElement) => ({ source: dom.dataset.mathBlock ?? "" }) }],
    toDOM(node: ProseMirrorNode) {
      return ["div", { "data-math-block": node.attrs.source, class: "pm-math-block" }, node.attrs.source];
    },
  },
  math_inline: {
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    attrs: { source: { default: "" } },
    parseDOM: [{ tag: "span[data-math-inline]", getAttrs: (dom: HTMLElement) => ({ source: dom.dataset.mathInline ?? "" }) }],
    toDOM(node: ProseMirrorNode) {
      return ["span", { "data-math-inline": node.attrs.source, class: "pm-math-inline" }, node.attrs.source];
    },
  },
};

const tableSpecs = tableNodes({
  tableGroup: "block",
  // GFM 表格单元格只允许内联内容，避免 UI 暗示支持 Markdown 无法 round-trip 的复杂块结构。
  cellContent: "inline*",
  cellAttributes: {
    align: {
      default: null,
      getFromDOM: (dom: Node) => { const el = dom as HTMLElement; return el.getAttribute("data-align") || el.style.textAlign || null; },
      setDOMAttr: (value: string | null, attrs: Record<string, unknown>) => {
        if (value) {
          attrs["data-align"] = value;
          attrs.style = `text-align:${value}`;
        }
      },
    },
  },
});

const baseImageSpec = baseMarkdownSchema.spec.nodes.get("image")!;
const baseNodes = baseMarkdownSchema.spec.nodes
  .update("heading", {
    ...baseMarkdownSchema.spec.nodes.get("heading")!,
    content: "inline*",
  })
  .update("image", {
    ...baseImageSpec,
    attrs: {
      ...(baseImageSpec.attrs ?? {}),
      // 仅用于当前编辑会话的可视宽度，不序列化到标准 Markdown。
      widthPct: { default: null },
    },
  });

export const editorSchema = new Schema({
  nodes: baseNodes
    .append(tableSpecs)
    .append(specialNodes),
  marks: baseMarkdownSchema.spec.marks.addBefore("link", "strike", strike),
});

const markdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
}).enable(["table", "strikethrough"]);

installSpecialMarkdownRules(markdownIt);

export const editorMarkdownParser = new MarkdownParser(editorSchema, markdownIt, {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: {
    block: "bullet_list",
    getAttrs: (token: any) => ({ bullet: token.markup?.charCodeAt(0) || 42 }),
  },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (token: any) => ({ order: Number(token.attrGet("start") || 1) }),
  },
  heading: {
    block: "heading",
    getAttrs: (token: any) => ({ level: Number(token.tag.slice(1)) }),
  },
  code_block: { block: "code_block", noCloseToken: true },
  fence: {
    block: "code_block",
    getAttrs: (token: any) => ({ params: token.info || "" }),
    noCloseToken: true,
  },
  mermaid_fence: {
    node: "mermaid_block",
    getAttrs: (token: any) => ({ source: token.content.replace(/\n$/, "") }),
  },
  math_block: {
    node: "math_block",
    getAttrs: (token: any) => ({ source: token.content }),
  },
  math_inline: {
    node: "math_inline",
    getAttrs: (token: any) => ({ source: token.content }),
  },
  table: { block: "table" },
  tr: { block: "table_row" },
  th: {
    block: "table_header",
    getAttrs: (token: any) => ({ align: token.attrGet("style")?.match(/text-align\s*:\s*(left|center|right)/i)?.[1]?.toLowerCase() ?? null }),
  },
  td: {
    block: "table_cell",
    getAttrs: (token: any) => ({ align: token.attrGet("style")?.match(/text-align\s*:\s*(left|center|right)/i)?.[1]?.toLowerCase() ?? null }),
  },
  hr: { node: "horizontal_rule" },
  image: {
    node: "image",
    getAttrs: (token: any) => ({
      src: token.attrGet("src"),
      title: token.attrGet("title") || null,
      alt: token.children?.[0]?.content || token.content || null,
      widthPct: null,
    }),
  },
  hardbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
  link: {
    mark: "link",
    getAttrs: (token: any) => ({ href: token.attrGet("href"), title: token.attrGet("title") || null }),
  },
  code_inline: { mark: "code", noCloseToken: true },
  s: { mark: "strike" },
});

const serializerNodes = {
  ...defaultMarkdownSerializer.nodes,
  table: serializeTable,
  mermaid_block(state: MarkdownSerializerState, node: ProseMirrorNode) {
    state.write("```mermaid\n");
    state.text(String(node.attrs.source ?? ""), false);
    state.write("\n```");
    state.closeBlock(node);
  },
  math_block(state: MarkdownSerializerState, node: ProseMirrorNode) {
    state.write("$$\n");
    state.text(String(node.attrs.source ?? ""), false);
    state.write("\n$$");
    state.closeBlock(node);
  },
  math_inline(state: MarkdownSerializerState, node: ProseMirrorNode) {
    state.write(`$${String(node.attrs.source ?? "").replace(/\$/g, "\\$")}$`);
  },
};

export const editorMarkdownSerializer = new MarkdownSerializer(
  serializerNodes,
  {
    ...defaultMarkdownSerializer.marks,
    strike: {
      open: "~~",
      close: "~~",
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
);

export function serializeEditorDoc(doc: ProseMirrorNode): string {
  return editorMarkdownSerializer
    .serialize(doc)
    .replace(/^(\s*(?:[-+*]|\d+\.)\s+)\\?\[([ xX])\\?\](?=\s)/gm, "$1[$2]");
}

function serializeTable(state: MarkdownSerializerState, node: ProseMirrorNode) {
  const rows: string[][] = [];
  const aligns: Array<"left" | "center" | "right" | null> = [];

  node.forEach((row, _offset, rowIndex) => {
    const cells: string[] = [];
    row.forEach((cell, _cellOffset, cellIndex) => {
      cells.push(serializeTableCell(cell));
      if (!aligns[cellIndex]) aligns[cellIndex] = normalizeAlign(cell.attrs.align);
    });
    rows.push(cells);
  });

  if (!rows.length) return;
  const width = Math.max(1, ...rows.map((row) => row.length));
  const header = padRow(rows[0], width);
  state.write(`| ${header.join(" | ")} |\n`);
  state.write(`| ${Array.from({ length: width }, (_, index) => alignmentMarker(aligns[index] ?? null)).join(" | ")} |`);
  for (const row of rows.slice(1)) {
    state.write(`\n| ${padRow(row, width).join(" | ")} |`);
  }
  state.closeBlock(node);
}

function serializeTableCell(cell: ProseMirrorNode): string {
  let result = "";
  cell.forEach((child) => {
    if (child.isText) {
      result += serializeMarkedText(child);
    } else if (child.type.name === "image") {
      const alt = String(child.attrs.alt ?? "").replace(/\|/g, "\\|");
      const src = String(child.attrs.src ?? "").replace(/[()]/g, "\\$&");
      result += `![${alt}](${src})`;
    } else if (child.type.name === "hard_break") {
      result += " ";
    } else if (child.type.name === "math_inline") {
      result += `$${String(child.attrs.source ?? "").replace(/\$/g, "\\$")}$`;
    } else if (!child.isLeaf) {
      result += child.textContent;
    }
  });
  return result.replace(/\r?\n/g, " ").trim();
}

function serializeMarkedText(node: ProseMirrorNode): string {
  const code = node.marks.some((mark) => mark.type.name === "code");
  let value = String(node.text ?? "").replace(/\r?\n/g, " ");
  value = code
    ? value.replace(/`/g, "\\`").replace(/\|/g, "\\|")
    : value.replace(/([\\|`*_\[\]<>])/g, "\\$1");
  for (const mark of node.marks) {
    switch (mark.type.name) {
      case "code": value = `\`${value}\``; break;
      case "strong": value = `**${value}**`; break;
      case "em": value = `*${value}*`; break;
      case "strike": value = `~~${value}~~`; break;
      case "link": value = `[${value}](${String(mark.attrs.href ?? "").replace(/[()]/g, "\\$&")})`; break;
    }
  }
  return value;
}

function padRow(row: string[], width: number) {
  return [...row, ...Array(Math.max(0, width - row.length)).fill("")];
}

function normalizeAlign(value: unknown): "left" | "center" | "right" | null {
  return value === "left" || value === "center" || value === "right" ? value : null;
}

function alignmentMarker(align: "left" | "center" | "right" | null) {
  if (align === "left") return ":---";
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return "---";
}

function installSpecialMarkdownRules(md: MarkdownIt) {
  // markdown-it 会额外生成 thead/tbody 包装 token。ProseMirror 表格模型不需要它们。
  md.core.ruler.after("block", "wysiwyg-special-fences", (state: any) => {
    for (const token of state.tokens) {
      if (token.type === "fence" && String(token.info ?? "").trim().split(/\s+/)[0]?.toLowerCase() === "mermaid") {
        token.type = "mermaid_fence";
      }
    }
    state.tokens = state.tokens.filter((token: any) => !["thead_open", "thead_close", "tbody_open", "tbody_close"].includes(token.type));
  });

  md.inline.ruler.after("escape", "math_inline", (state: any, silent: boolean) => {
    const start = state.pos;
    if (state.src[start] !== "$" || state.src[start + 1] === "$") return false;
    if (start > 0 && state.src[start - 1] === "\\") return false;
    let end = start + 1;
    while (end < state.posMax) {
      if (state.src[end] === "$" && state.src[end - 1] !== "\\") break;
      if (state.src[end] === "\n") return false;
      end += 1;
    }
    if (end >= state.posMax || end === start + 1) return false;
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(start + 1, end);
    }
    state.pos = end + 1;
    return true;
  });

  md.block.ruler.before("fence", "math_block", (state: any, startLine: number, endLine: number, silent: boolean) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const first = state.src.slice(start, max).trim();
    if (!first.startsWith("$$")) return false;

    if (first.length > 4 && first.endsWith("$$")) {
      if (!silent) {
        const token = state.push("math_block", "math", 0);
        token.block = true;
        token.map = [startLine, startLine + 1];
        token.content = first.slice(2, -2).trim();
      }
      state.line = startLine + 1;
      return true;
    }

    let next = startLine + 1;
    const content: string[] = [first.slice(2).trimStart()].filter(Boolean);
    while (next < endLine) {
      const lineStart = state.bMarks[next] + state.tShift[next];
      const lineEnd = state.eMarks[next];
      const line = state.src.slice(lineStart, lineEnd);
      if (line.trim().endsWith("$$")) {
        const before = line.replace(/\$\$\s*$/, "");
        if (before) content.push(before);
        if (!silent) {
          const token = state.push("math_block", "math", 0);
          token.block = true;
          token.map = [startLine, next + 1];
          token.content = content.join("\n").trim();
        }
        state.line = next + 1;
        return true;
      }
      content.push(line);
      next += 1;
    }
    return false;
  }, { alt: ["paragraph", "reference", "blockquote", "list"] });
}

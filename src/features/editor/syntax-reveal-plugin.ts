import { Plugin, PluginKey, TextSelection, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";

const key = new PluginKey("markdown-syntax-reveal");

export function syntaxRevealPlugin() {
  return new Plugin({
    key,
    props: {
      decorations(state) {
        return buildDecorations(state);
      },
    },
  });
}

function buildDecorations(state: EditorState) {
  const selection = state.selection;
  if (!(selection instanceof TextSelection)) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  const $from = selection.$from;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "heading") {
      decorations.push(widget($from.start(depth), `${"#".repeat(Number(node.attrs.level || 1))} `, "block"));
      break;
    }
    if (node.type.name === "code_block") {
      const info = String(node.attrs.params ?? "").trim();
      decorations.push(widget($from.start(depth), `\`\`\`${info ? info : ""}\n`, "block"));
      decorations.push(widget($from.end(depth), "\n```", "block"));
      break;
    }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "blockquote") {
      decorations.push(widget($from.start(), "> ", "block muted"));
      break;
    }
  }

  if (selection.empty && $from.parent.inlineContent) {
    const marks = $from.marks().filter((mark) => ["strong", "em", "strike", "code", "link"].includes(mark.type.name));
    for (const mark of marks) {
      const range = markRangeAtCursor($from.parent, $from.start(), $from.parentOffset, mark);
      if (!range) continue;
      const [open, close] = delimiters(mark);
      if (open) decorations.push(widget(range.from, open, "inline"));
      if (close) decorations.push(widget(range.to, close, "inline"));
    }
  }

  return DecorationSet.create(state.doc, decorations);
}

function markRangeAtCursor(parent: ProseMirrorNode, parentStart: number, offset: number, mark: Mark) {
  const children: Array<{ from: number; to: number; has: boolean }> = [];
  parent.forEach((child, childOffset) => {
    children.push({
      from: parentStart + childOffset,
      to: parentStart + childOffset + child.nodeSize,
      has: Boolean(mark.type.isInSet(child.marks)),
    });
  });
  let index = children.findIndex((child) => child.has && child.from <= parentStart + offset && parentStart + offset <= child.to);
  if (index < 0 && offset > 0) index = children.findIndex((child) => child.has && child.to === parentStart + offset);
  if (index < 0) return null;
  let left = index;
  let right = index;
  while (left > 0 && children[left - 1].has && children[left - 1].to === children[left].from) left -= 1;
  while (right + 1 < children.length && children[right + 1].has && children[right].to === children[right + 1].from) right += 1;
  return { from: children[left].from, to: children[right].to };
}

function delimiters(mark: Mark): [string, string] {
  switch (mark.type.name) {
    case "strong": return ["**", "**"];
    case "em": return ["*", "*"];
    case "strike": return ["~~", "~~"];
    case "code": return ["`", "`"];
    case "link": return ["[", `](${String(mark.attrs.href ?? "")})`];
    default: return ["", ""];
  }
}

function widget(pos: number, text: string, kind: string) {
  return Decoration.widget(pos, () => {
    const span = document.createElement("span");
    span.className = `pm-md-syntax pm-md-syntax-${kind.replace(/\s+/g, "-")}`;
    span.textContent = text;
    span.contentEditable = "false";
    return span;
  }, { side: -1, key: `syntax:${pos}:${kind}:${text}` });
}

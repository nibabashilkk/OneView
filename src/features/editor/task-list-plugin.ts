import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";

const TASK_RE = /^\[([ xX])\](?=\s|$)/;

export function taskListPlugin() {
  return new Plugin({
    props: {
      decorations(state) {
        return buildTaskDecorations(state.doc);
      },
    },
  });
}

function buildTaskDecorations(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "list_item" || node.childCount === 0) return;
    const first = node.firstChild;
    if (!first || first.type.name !== "paragraph") return;
    const match = TASK_RE.exec(first.textContent);
    if (!match) return;

    const checked = match[1].toLowerCase() === "x";
    const markerFrom = pos + 2;
    const markerTo = markerFrom + 3;
    decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "pm-task-item" }));
    decorations.push(Decoration.inline(markerFrom, markerTo, { class: "pm-task-marker" }));
    decorations.push(Decoration.widget(markerFrom, (view, getPos) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.className = "pm-task-checkbox";
      input.setAttribute("aria-label", checked ? "标记任务未完成" : "标记任务已完成");
      input.addEventListener("mousedown", (event) => event.preventDefault());
      input.addEventListener("change", () => {
        const resolved = typeof getPos === "function" ? getPos() : undefined;
        const at = typeof resolved === "number" ? resolved : markerFrom;
        view.dispatch(view.state.tr.insertText(input.checked ? "[x]" : "[ ]", at, at + 3));
        view.focus();
      });
      return input;
    }, { side: -1, ignoreSelection: true }));
  });
  return DecorationSet.create(doc, decorations);
}

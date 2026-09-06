import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { highlightRanges } from "../syntax/highlight-engine";

const key = new PluginKey<DecorationSet>("code-highlight");

export function codeHighlightPlugin() {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_config, state) => buildDecorations(state.doc),
      apply(transaction, previous) {
        if (!transaction.docChanged) return previous.map(transaction.mapping, transaction.doc);
        return buildDecorations(transaction.doc);
      },
    },
    props: {
      decorations(state) {
        return key.getState(state) ?? null;
      },
    },
  });
}

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") return true;
    const source = node.textContent;
    const language = String(node.attrs.params ?? "");
    const contentStart = pos + 1;

    for (const range of highlightRanges(source, language)) {
      if (range.to <= range.from) continue;
      decorations.push(Decoration.inline(
        contentStart + range.from,
        contentStart + range.to,
        { class: range.classes },
      ));
    }
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { OutlineItem } from "../../lib/contracts";

export function outlineFromEditorDoc(doc: ProseMirrorNode): OutlineItem[] {
  const used = new Map<string, number>();
  const items: OutlineItem[] = [];
  doc.descendants((node) => {
    if (node.type.name !== "heading") return;
    const title = node.textContent.trim();
    if (!title) return;
    const base = slugify(title);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    items.push({ id: count === 0 ? base : `${base}-${count}`, level: Number(node.attrs.level || 1), title });
  });
  return items;
}

function slugify(input: string) {
  let out = "";
  let dash = false;
  for (const char of input) {
    if (/[_\p{L}\p{N}]/u.test(char)) {
      out += char.toLocaleLowerCase();
      dash = false;
    } else if (!dash && out) {
      out += "-";
      dash = true;
    }
  }
  return out.replace(/-+$/g, "") || "section";
}

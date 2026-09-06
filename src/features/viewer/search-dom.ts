import { yieldToMainThread } from "./performance";

export type SearchOptions = {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
};

const MARK_SELECTOR = "mark[data-search-hit]";

export async function highlightSearch(
  container: HTMLElement,
  options: SearchOptions,
  shouldCancel: () => boolean = () => false,
): Promise<number> {
  clearSearchHighlights(container);
  const query = options.query.trim();
  if (!query) return 0;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = options.caseSensitive ? "gu" : "giu";
  const expression = new RegExp(escaped, flags);
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".katex, .mermaid-block, [data-search-skip='true']")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let scanned = 0;
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
    scanned += 1;
    if (scanned % 600 === 0) {
      if (shouldCancel()) return 0;
      await yieldToMainThread();
    }
  }

  let total = 0;
  for (let index = 0; index < nodes.length; index += 1) {
    if (shouldCancel()) return 0;
    const textNode = nodes[index];
    const text = textNode.nodeValue ?? "";
    expression.lastIndex = 0;
    const matches: Array<{ start: number; end: number }> = [];

    for (let match = expression.exec(text); match; match = expression.exec(text)) {
      const start = match.index;
      const end = start + match[0].length;
      if (!options.wholeWord || isWholeWord(text, start, end)) {
        matches.push({ start, end });
      }
      if (match[0].length === 0) expression.lastIndex += 1;
    }

    if (matches.length > 0) {
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of matches) {
        if (match.start > cursor) fragment.append(text.slice(cursor, match.start));
        const mark = document.createElement("mark");
        mark.dataset.searchHit = String(total);
        mark.className = "search-hit";
        mark.textContent = text.slice(match.start, match.end);
        fragment.append(mark);
        total += 1;
        cursor = match.end;
      }
      if (cursor < text.length) fragment.append(text.slice(cursor));
      textNode.replaceWith(fragment);
    }

    if ((index + 1) % 300 === 0 && index + 1 < nodes.length) await yieldToMainThread();
  }

  return total;
}

export function clearSearchHighlights(container: HTMLElement) {
  const marks = [...container.querySelectorAll<HTMLElement>(MARK_SELECTOR)];
  if (marks.length === 0) return;

  const parents = new Set<Node>();
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) parents.add(parent);
    mark.replaceWith(document.createTextNode(mark.textContent ?? ""));
  });
  parents.forEach((parent) => parent.normalize());
}

export function activateSearchHit(container: HTMLElement, index: number) {
  const marks = [...container.querySelectorAll<HTMLElement>(MARK_SELECTOR)];
  marks.forEach((mark) => mark.classList.remove("is-current"));
  if (marks.length === 0) return;

  const safe = ((index % marks.length) + marks.length) % marks.length;
  const target = marks[safe];
  target.classList.add("is-current");
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
}

function isWholeWord(text: string, start: number, end: number) {
  const previous = start > 0 ? text[start - 1] : "";
  const next = end < text.length ? text[end] : "";
  return !isWordCharacter(previous) && !isWordCharacter(next);
}

function isWordCharacter(value: string) {
  return value ? /[\p{L}\p{N}_]/u.test(value) : false;
}

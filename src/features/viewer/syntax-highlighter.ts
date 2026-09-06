import { ensureHighlightLanguages, resolveHighlightLanguage } from "../syntax/highlight-engine";
import hljs from "highlight.js/lib/core";

export async function highlightCodeBlocks(container: HTMLElement) {
  ensureHighlightLanguages();

  const { forEachInBatches } = await import("./performance");
  const blocks = container.querySelectorAll<HTMLElement>("pre > code[class*='language-']");
  await forEachInBatches(blocks, (code) => {
    if (code.classList.contains("language-mermaid")) return;
    if (code.dataset.highlighted === "yes") return;

    const languageClass = [...code.classList].find((name) => name.startsWith("language-"));
    const rawLanguage = languageClass?.slice("language-".length) ?? "";
    const language = resolveHighlightLanguage(rawLanguage);
    if (!language) return;

    code.classList.add(`language-${language}`);
    hljs.highlightElement(code);
  });
}

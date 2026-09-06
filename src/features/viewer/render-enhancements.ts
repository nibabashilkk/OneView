export type ResolvedTheme = "light" | "dark";

export async function enhanceRenderedDocument(
  container: HTMLElement,
  theme: ResolvedTheme,
): Promise<void> {
  await Promise.all([
    enhanceSyntax(container),
    enhanceMath(container),
  ]);
  await enhanceMermaid(container, theme);
}

async function enhanceSyntax(container: HTMLElement) {
  if (!container.querySelector("pre > code[class*='language-']:not(.language-mermaid)")) return;
  const { highlightCodeBlocks } = await import("./syntax-highlighter");
  await highlightCodeBlocks(container);
}

async function enhanceMath(container: HTMLElement) {
  const nodes = container.querySelectorAll<HTMLElement>(".math-inline, .math-display");
  if (nodes.length === 0) return;

  const [{ default: katex }] = await Promise.all([
    import("katex"),
    import("katex/dist/katex.min.css"),
  ]);
  const macros: Record<string, string> = {};

  const { forEachInBatches } = await import("./performance");
  await forEachInBatches(nodes, (node) => {
    const source = node.dataset.mathSource ?? node.textContent ?? "";
    node.dataset.mathSource = source;

    katex.render(source, node, {
      displayMode: node.dataset.math === "display",
      throwOnError: false,
      strict: "warn",
      trust: false,
      macros,
    });
  }, 24);
}

async function enhanceMermaid(container: HTMLElement, theme: ResolvedTheme) {
  const nodes = prepareMermaidNodes(container);
  if (nodes.length === 0) return;

  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
  });

  const { yieldToMainThread } = await import("./performance");
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const source = node.dataset.mermaidSource ?? "";
    node.textContent = source;
    node.removeAttribute("data-processed");
    node.classList.remove("mermaid-error");

    try {
      await mermaid.run({ nodes: [node], suppressErrors: true });
      if (!node.querySelector("svg")) throw new Error("Mermaid 未生成 SVG");
    } catch (error) {
      node.textContent = source;
      node.classList.add("mermaid-error");
      node.title = error instanceof Error ? error.message : String(error);
    }
    if ((index + 1) % 4 === 0 && index + 1 < nodes.length) await yieldToMainThread();
  }
}

function prepareMermaidNodes(container: HTMLElement): HTMLElement[] {
  const existing = [...container.querySelectorAll<HTMLElement>(".mermaid-block[data-mermaid-source]")];
  const codeBlocks = [...container.querySelectorAll<HTMLElement>("pre > code.language-mermaid")];

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre) continue;

    const source = code.textContent ?? "";
    const block = document.createElement("div");
    block.className = "mermaid mermaid-block";
    block.dataset.mermaidSource = source;
    block.dataset.searchSkip = "true";
    pre.replaceWith(block);
    existing.push(block);
  }

  return existing;
}

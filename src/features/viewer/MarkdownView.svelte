<script lang="ts">
  import { primaryContentMotion } from "../../lib/motion";
  import { afterUpdate, onDestroy, onMount } from "svelte";
  import type { RenderedDocument, ViewerContextMenuRequest } from "../../lib/contracts";
  import { openExternalUrl, isExternalUrl } from "../../services/resource-service";
  import { resolvedTheme } from "../../stores/theme";
  import { search } from "../../stores/search";
  import { settings, readerStyle } from "../../stores/settings";
  import { enhanceDocumentResources } from "./document-resources";
  import { isLargeDocument } from "./performance";
  import { enhanceRenderedDocument } from "./render-enhancements";
  import { activateSearchHit, clearSearchHighlights, highlightSearch } from "./search-dom";
  import { ViewportTracker, type ViewerViewport } from "./viewport-tracker";

  export let document: RenderedDocument;
  export let initialScrollTop = 0;
  export let onViewportChange: (viewport: ViewerViewport) => void;
  export let onOpenDocument: (path: string, fragment: string | null) => void;
  export let onContextMenu: (request: ViewerContextMenuRequest) => void;

  let container: HTMLElement;
  let scrollHost: HTMLElement;
  let lastDocumentKey = "";
  let lastSearchKey = "";
  let lastSearchIndex = -1;
  let generation = 0;
  let searchGeneration = 0;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let viewportCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingViewport: ViewerViewport | null = null;
  let lastCommittedHeading: string | null = null;
  let viewportTracker: ViewportTracker | null = null;

  $: largeDocument = isLargeDocument(document.lineCount, document.sizeBytes);

  onMount(() => {
    requestAnimationFrame(() => {
      if (!scrollHost || !container) return;
      scrollHost.scrollTop = Math.max(0, initialScrollTop);
      viewportTracker = new ViewportTracker(scrollHost, container, queueViewportCommit);
      viewportTracker.start();
    });
  });

  onDestroy(() => {
    generation += 1;
    searchGeneration += 1;
    clearPendingSearch();
    viewportTracker?.stop();
    viewportTracker = null;
    if (viewportCommitTimer) clearTimeout(viewportCommitTimer);
    commitViewport();
  });

  afterUpdate(() => {
    if (!container) return;

    const documentKey = `${document.id}:${document.modifiedAtMs}:${$resolvedTheme}`;
    if (documentKey !== lastDocumentKey) {
      lastDocumentKey = documentKey;
      void enhanceAndSearch();
      return;
    }

    const searchKey = `${document.id}:${$search.open}:${$search.query}:${$search.caseSensitive}:${$search.wholeWord}`;
    if (searchKey !== lastSearchKey) {
      scheduleSearch();
      return;
    }

    if ($search.current !== lastSearchIndex) {
      lastSearchIndex = $search.current;
      activateSearchHit(container, $search.current);
    }
  });

  async function enhanceAndSearch() {
    const currentGeneration = ++generation;
    searchGeneration += 1;
    clearPendingSearch();
    clearSearchHighlights(container);
    container.dataset.documentId = document.id;
    container.dataset.renderReady = "false";

    await enhanceRenderedDocument(container, $resolvedTheme);
    if (currentGeneration !== generation) return;
    await enhanceDocumentResources(container, document.path);
    if (currentGeneration !== generation) return;

    // System shell actions (copy/export/print) wait for this marker so they do not
    // capture Mermaid/KaTeX/local-image placeholders before enhancement completes.
    container.dataset.renderReady = "true";
    viewportTracker?.refresh();
    lastSearchKey = "";
    await applySearch();
  }

  function scheduleSearch() {
    clearPendingSearch();
    searchTimer = setTimeout(() => void applySearch(), 70);
  }

  function clearPendingSearch() {
    if (!searchTimer) return;
    clearTimeout(searchTimer);
    searchTimer = null;
  }

  async function applySearch() {
    if (!container) return;
    clearPendingSearch();
    const currentSearchGeneration = ++searchGeneration;

    const searchKey = `${document.id}:${$search.open}:${$search.query}:${$search.caseSensitive}:${$search.wholeWord}`;
    lastSearchKey = searchKey;

    if (!$search.open || !$search.query.trim()) {
      clearSearchHighlights(container);
      lastSearchIndex = 0;
      if ($search.total !== 0) search.report(0);
      viewportTracker?.refresh();
      return;
    }

    // Search must include content hidden inside collapsed JSON branches.
    if (container.querySelector(".structured-json")) {
      container.querySelectorAll<HTMLDetailsElement>(".structured-json details.tree-container")
        .forEach((node) => { node.open = true; });
    }

    const total = await highlightSearch(
      container,
      {
        query: $search.query,
        caseSensitive: $search.caseSensitive,
        wholeWord: $search.wholeWord,
      },
      () => currentSearchGeneration !== searchGeneration,
    );
    if (currentSearchGeneration !== searchGeneration) return;

    search.report(total);
    const safeIndex = total === 0 ? 0 : Math.min($search.current, total - 1);
    lastSearchIndex = safeIndex;
    activateSearchHit(container, safeIndex);
    viewportTracker?.refresh();
  }

  function queueViewportCommit(viewport: ViewerViewport) {
    pendingViewport = viewport;
    const headingChanged = viewport.activeHeadingId !== lastCommittedHeading;
    if (headingChanged) {
      commitViewport();
      return;
    }
    if (viewportCommitTimer) return;
    viewportCommitTimer = setTimeout(() => {
      viewportCommitTimer = null;
      commitViewport();
    }, 80);
  }

  function commitViewport() {
    if (!pendingViewport) return;
    const viewport = pendingViewport;
    pendingViewport = null;
    lastCommittedHeading = viewport.activeHeadingId;
    onViewportChange(viewport);
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    const target = event.target as Element | null;
    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    const selection = selectionInsideContainer();

    onContextMenu({
      x: event.clientX,
      y: event.clientY,
      selectionText: selection.text,
      selectionHtml: selection.html,
      link: anchor && container.contains(anchor)
        ? {
            href: anchor.getAttribute("href")?.trim() ?? "",
            text: anchor.textContent?.trim() ?? "",
            localPath: anchor.dataset.localPath ?? null,
            localMarkdown: anchor.dataset.localMarkdown === "true",
            localExists: anchor.dataset.localExists === "true",
            localFragment: anchor.dataset.localFragment ?? null,
          }
        : null,
    });
  }

  function selectionInsideContainer(): { text: string; html: string } {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return { text: "", html: "" };

    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement;
    if (!ancestor || !container.contains(ancestor)) return { text: "", html: "" };

    const host = globalThis.document.createElement("div");
    host.appendChild(range.cloneContents());
    return { text: selection.toString().trim(), html: host.innerHTML };
  }

  function handleContentClick(event: MouseEvent) {
    const target = event.target as Element | null;
    const pluginAction = target?.closest("[data-plugin-action]") as HTMLButtonElement | null;
    if (pluginAction && container.contains(pluginAction)) {
      const pluginDocument = pluginAction.closest(".plugin-document");
      if (!pluginDocument) return;
      event.preventDefault();
      event.stopPropagation();
      const action = pluginAction.dataset.pluginAction;
      const nodes = Array.from(pluginDocument.querySelectorAll<HTMLDetailsElement>("details"));
      if (action === "expand-details") {
        nodes.forEach((node) => { node.open = true; });
      } else if (action === "collapse-details") {
        nodes.forEach((node, index) => { node.open = index === 0; });
      }
      viewportTracker?.refresh();
      return;
    }

    const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || !container.contains(anchor)) return;

    const raw = anchor.getAttribute("href")?.trim() ?? "";
    if (!raw) return;

    if (raw.startsWith("#")) {
      event.preventDefault();
      const id = decodeURIComponent(raw.slice(1));
      documentElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const localPath = anchor.dataset.localPath;
    if (localPath) {
      event.preventDefault();
      if (anchor.dataset.localMarkdown === "true" && anchor.dataset.localExists === "true") {
        onOpenDocument(localPath, anchor.dataset.localFragment ?? null);
      }
      return;
    }

    if (isExternalUrl(raw) || raw.startsWith("//")) {
      event.preventDefault();
      void openExternalUrl(raw.startsWith("//") ? `https:${raw}` : raw);
      return;
    }

    // 未知 scheme（例如 javascript:/file:）不允许 WebView 自己导航或执行。
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
      event.preventDefault();
    }
  }

  function documentElementById(id: string) {
    return container.querySelector<HTMLElement>(`#${cssEscape(id)}`);
  }

  function cssEscape(value: string) {
    return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
</script>

<div bind:this={scrollHost} class="viewer-scroll h-full overflow-y-auto" in:primaryContentMotion={{ y: 2, duration: 110 }}>
  <article
    bind:this={container}
    class:large-document={largeDocument}
    class:structured-document={document.format !== "markdown"}
    class="markdown-body reader-surface mx-auto px-10 py-10 lg:px-14"
    style={readerStyle($settings)}
    data-large-document={largeDocument ? "true" : undefined}
    on:click={handleContentClick}
    on:contextmenu={handleContextMenu}
  >
    {@html document.html}
  </article>
</div>

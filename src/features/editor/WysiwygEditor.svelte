<script lang="ts">
  import { primaryContentMotion } from "../../lib/motion";
  import { onDestroy, onMount } from "svelte";
  import { EditorState, TextSelection } from "prosemirror-state";
  import { EditorView } from "prosemirror-view";
  import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
  import { liftListItem, wrapInList } from "prosemirror-schema-list";
  import {
    addColumnAfter,
    addRowAfter,
    deleteColumn,
    deleteRow,
    deleteTable,
    setCellAttr,
  } from "prosemirror-tables";
  import type { OutlineItem, ViewerContextMenuRequest } from "../../lib/contracts";
  import { editorSchema, editorMarkdownParser, serializeEditorDoc } from "./editor-schema";
  import { editorPlugins } from "./editor-plugins";
  import { outlineFromEditorDoc } from "./editor-outline";
  import { createEditorNodeViews } from "./rich-node-views";
  import { importEditorImageFile, importEditorImagePath, isImagePath } from "../../services/editor-asset-service";
  import { settings, readerStyle } from "../../stores/settings";
  import { ViewportTracker, type ViewerViewport } from "../viewer/viewport-tracker";
  import { editorSession } from "./editor-session";

  export let source = "";
  export let documentId = "";
  export let documentPath = "";
  export let initialScrollTop = 0;
  export let onViewportChange: (viewport: ViewerViewport) => void = () => {};
  export let onChange: (source: string, outline: OutlineItem[]) => void;
  export let onSave: () => void | Promise<void>;
  export let onError: (message: string) => void = (message) => console.error(message);
  export let onContextMenu: (request: ViewerContextMenuRequest) => void = () => {};

  type SlashCommand = {
    id: string;
    title: string;
    hint: string;
    keywords: string;
    icon: string;
    run: () => void;
  };

  let host: HTMLDivElement;
  let scrollHost: HTMLDivElement;
  let view: EditorView | null = null;
  // ProseMirror is authoritative while WYSIWYG is mounted. These guards prevent
  // parent prop echoes and Markdown serializer normalization from rebuilding the editor forever.
  let lastSeenParentSource = source;
  let lastEmittedSource = source;
  let selectionVersion = 0;
  let imagePicker: HTMLInputElement;
  let selectionToolbar = { open: false, x: 0, y: 0 };
  let slashMenu = { open: false, x: 0, y: 0, from: 0, to: 0, query: "", selected: 0 };
  let tableMenu = { open: false, x: 0, y: 0 };
  let viewportTracker: ViewportTracker | null = null;
  let viewportCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingViewport: ViewerViewport | null = null;
  let lastCommittedHeading: string | null = null;
  let detachEditorSession: (() => void) | null = null;

  $: slashMatches = slashCommands().filter((item) => {
    const query = slashMenu.query.trim().toLocaleLowerCase();
    return !query || `${item.title} ${item.keywords}`.toLocaleLowerCase().includes(query);
  });
  $: displayedSlashMatches = slashMatches.slice(0, 9);

  onMount(() => {
    lastSeenParentSource = source;
    lastEmittedSource = source;
    const doc = safeParse(source);
    view = new EditorView(host, {
      state: EditorState.create({ doc, schema: editorSchema, plugins: editorPlugins() }),
      nodeViews: createEditorNodeViews(documentPath),
      dispatchTransaction(transaction) {
        if (!view) return;
        const next = view.state.apply(transaction);
        view.updateState(next);
        selectionVersion += 1;
        if (transaction.docChanged) {
          const nextSource = serializeEditorDoc(next.doc);
          lastEmittedSource = nextSource;
          onChange(nextSource, outlineFromEditorDoc(next.doc));
          queueMicrotask(syncHeadingIds);
        }
        if (transaction.selectionSet || transaction.docChanged) {
          queueMicrotask(() => editorSession.notifySelectionChanged(documentId));
        }
        queueMicrotask(updateTransientUi);
      },
      handlePaste(_view, event) {
        const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void importImageFiles(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void importImageFiles(files);
        return true;
      },
      handleKeyDown(_view, event) {
        const primary = event.metaKey || event.ctrlKey;
        if (primary && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void onSave();
          return true;
        }
        if (!slashMenu.open) return false;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          slashMenu = { ...slashMenu, selected: Math.min(Math.max(0, displayedSlashMatches.length - 1), slashMenu.selected + 1) };
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          slashMenu = { ...slashMenu, selected: Math.max(0, slashMenu.selected - 1) };
          return true;
        }
        if ((event.key === "Enter" || event.key === "Tab") && displayedSlashMatches.length) {
          event.preventDefault();
          acceptSlashCommand(displayedSlashMatches[Math.min(slashMenu.selected, displayedSlashMatches.length - 1)]);
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeSlashMenu();
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        contextmenu(editorView, event) {
          const target = event.target as HTMLElement | null;
          const cell = target?.closest?.("td,th") as HTMLElement | null;
          if (cell && host.contains(cell)) {
            event.preventDefault();
            try {
              const cellPos = editorView.posAtDOM(cell, 0);
              const inside = Math.min(editorView.state.doc.content.size, Math.max(1, cellPos + 1));
              editorView.dispatch(editorView.state.tr.setSelection(TextSelection.near(editorView.state.doc.resolve(inside))));
            } catch {
              // DOM 映射失败时保留当前表格选区，右键菜单仍可使用。
            }
            tableMenu = {
              open: true,
              x: Math.max(8, Math.min(window.innerWidth - 205, event.clientX)),
              y: Math.max(8, Math.min(window.innerHeight - 300, event.clientY)),
            };
            selectionToolbar = { ...selectionToolbar, open: false };
            return true;
          }

          event.preventDefault();
          selectionToolbar = { ...selectionToolbar, open: false };
          onContextMenu(buildContextMenuRequest(event, target));
          return true;
        },
      },
      attributes: {
        class: "ProseMirror markdown-wysiwyg",
        spellcheck: "true",
        autocapitalize: "sentences",
      },
    });

    detachEditorSession = editorSession.attach({
      documentId,
      getSnapshot: () => {
        if (!view) return { documentId, source: lastEmittedSource, selection: { text: "", empty: true } };
        const { from, to, empty } = view.state.selection;
        return {
          documentId,
          source: serializeEditorDoc(view.state.doc),
          selection: {
            text: empty ? "" : view.state.doc.textBetween(from, to, "\n", "\n"),
            empty,
          },
        };
      },
      getSelection: () => {
        if (!view) return { text: "", empty: true };
        const { from, to, empty } = view.state.selection;
        return {
          text: empty ? "" : view.state.doc.textBetween(from, to, "\n", "\n"),
          empty,
        };
      },
      replaceSelection: (text) => {
        if (!view) throw new Error("编辑器尚未就绪");
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
        view.focus();
      },
      insertText: (text) => {
        if (!view) throw new Error("编辑器尚未就绪");
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
        view.focus();
      },
    });
    editorSession.notifySelectionChanged(documentId);

    const handleExternalImages = (event: Event) => {
      const paths = ((event as CustomEvent<{ paths?: string[] }>).detail?.paths ?? []).filter(isImagePath);
      if (paths.length) void importImagePaths(paths);
    };
    const closeTransient = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.(".pm-table-context")) tableMenu = { ...tableMenu, open: false };
    };
    const closeOnViewportMove = () => {
      tableMenu = { ...tableMenu, open: false };
      if (view?.hasFocus()) updateTransientUi();
    };
    window.addEventListener("markdown-editor:insert-images", handleExternalImages as EventListener);
    window.addEventListener("mousedown", closeTransient, true);
    window.addEventListener("resize", closeOnViewportMove);
    document.addEventListener("scroll", closeOnViewportMove, true);
    requestAnimationFrame(() => {
      if (!scrollHost || !host) return;
      scrollHost.scrollTop = Math.max(0, initialScrollTop);
      syncHeadingIds();
      viewportTracker = new ViewportTracker(scrollHost, host, queueViewportCommit);
      viewportTracker.start();
      updateTransientUi();
    });
    return () => {
      window.removeEventListener("markdown-editor:insert-images", handleExternalImages as EventListener);
      window.removeEventListener("mousedown", closeTransient, true);
      window.removeEventListener("resize", closeOnViewportMove);
      document.removeEventListener("scroll", closeOnViewportMove, true);
    };
  });

  onDestroy(() => {
    detachEditorSession?.();
    detachEditorSession = null;
    viewportTracker?.stop();
    viewportTracker = null;
    if (viewportCommitTimer) clearTimeout(viewportCommitTimer);
    commitViewport();
    view?.destroy();
  });

  // Only reparse when the *parent* supplies genuinely new source (for example an external file refresh).
  // A local ProseMirror edit is echoed back through `source`; reparsing that echo destroys selection and,
  // because Markdown serializers normalize whitespace/markers, previously caused an infinite Svelte update loop.
  $: if (view && normalizeLineEndings(source) !== normalizeLineEndings(lastSeenParentSource)) {
    syncExternalSource(source);
  }

  function syncExternalSource(incoming: string) {
    if (!view) return;
    const normalizedIncoming = normalizeLineEndings(incoming);
    const normalizedEmitted = normalizeLineEndings(lastEmittedSource);

    // Parent echo of our own transaction: acknowledge it, never rebuild the EditorState.
    if (normalizedIncoming === normalizedEmitted) {
      lastSeenParentSource = incoming;
      return;
    }

    lastSeenParentSource = incoming;
    lastEmittedSource = incoming;
    const oldSelection = view.state.selection.from;
    const doc = safeParse(incoming);
    const next = EditorState.create({ doc, schema: editorSchema, plugins: editorPlugins() });
    const pos = Math.min(Math.max(1, oldSelection), Math.max(1, doc.content.size));
    view.updateState(next.apply(next.tr.setSelection(TextSelection.near(next.doc.resolve(pos)))));
    queueMicrotask(() => {
      editorSession.notifySelectionChanged(documentId);
      syncHeadingIds();
      updateTransientUi();
    });
  }

  function syncHeadingIds() {
    if (!host) return;
    const used = new Map<string, number>();
    host.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((heading) => {
      const title = (heading.textContent ?? "").trim();
      if (!title) return;
      const base = slugHeading(title);
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      heading.id = count === 0 ? base : `${base}-${count}`;
    });
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

  function slugHeading(input: string) {
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

  function normalizeLineEndings(value: string) {
    return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function buildContextMenuRequest(event: MouseEvent, target: HTMLElement | null): ViewerContextMenuRequest {
    const selection = window.getSelection();
    let selectionHtml = "";
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const container = document.createElement("div");
      container.appendChild(selection.getRangeAt(0).cloneContents());
      selectionHtml = container.innerHTML;
    }
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    const href = anchor?.getAttribute("href") ?? "";
    return {
      x: event.clientX,
      y: event.clientY,
      selectionText: selection?.toString() ?? "",
      selectionHtml,
      link: href ? {
        href,
        text: anchor?.textContent ?? href,
        localPath: null,
        localMarkdown: false,
        localExists: false,
        localFragment: href.startsWith("#") ? href.slice(1) : null,
      } : null,
    };
  }

  function safeParse(markdown: string) {
    try {
      return editorMarkdownParser.parse(markdown);
    } catch (error) {
      console.error("Markdown WYSIWYG parse failed", error);
      return editorSchema.node("doc", null, [editorSchema.node("paragraph", null, editorSchema.text(markdown || " "))]);
    }
  }

  function run(command: any) {
    if (!view) return;
    command(view.state, view.dispatch, view);
    view.focus();
    selectionVersion += 1;
    queueMicrotask(updateTransientUi);
  }

  function markActive(name: string) {
    selectionVersion;
    if (!view) return false;
    const mark = editorSchema.marks[name];
    const { from, $from, to, empty } = view.state.selection;
    if (empty) return Boolean(mark.isInSet(view.state.storedMarks || $from.marks()));
    return view.state.doc.rangeHasMark(from, to, mark);
  }

  function blockActive(name: string, attrs?: Record<string, unknown>) {
    selectionVersion;
    if (!view) return false;
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== name) continue;
      return !attrs || Object.entries(attrs).every(([key, value]) => node.attrs[key] === value);
    }
    return false;
  }

  function setParagraph() { run(setBlockType(editorSchema.nodes.paragraph)); }
  function setHeading(level: number) { run(setBlockType(editorSchema.nodes.heading, { level })); }
  function toggleBlockquote() { run(wrapIn(editorSchema.nodes.blockquote)); }
  function toggleBulletList() { run(wrapInList(editorSchema.nodes.bullet_list)); }
  function toggleOrderedList() { run(wrapInList(editorSchema.nodes.ordered_list)); }
  function setCodeBlock() { run(setBlockType(editorSchema.nodes.code_block)); }
  function outdentList() { run(liftListItem(editorSchema.nodes.list_item)); }

  function insertHorizontalRule() {
    if (!view) return;
    view.dispatch(view.state.tr.replaceSelectionWith(editorSchema.nodes.horizontal_rule.create()).scrollIntoView());
    view.focus();
  }

  function insertTable() {
    if (!view) return;
    const header = editorSchema.nodes.table_header;
    const cell = editorSchema.nodes.table_cell;
    const row = editorSchema.nodes.table_row;
    const rows = Array.from({ length: 3 }, (_, rowIndex) =>
      row.create(null, Array.from({ length: 3 }, () => (rowIndex === 0 ? header : cell).create())),
    );
    view.dispatch(view.state.tr.replaceSelectionWith(editorSchema.nodes.table.create(null, rows)).scrollIntoView());
    view.focus();
  }

  function insertMermaid() { insertBlockAtom("mermaid_block", { source: "graph TD\n  A[开始] --> B[完成]" }); }
  function insertMathBlock() { insertBlockAtom("math_block", { source: "E = mc^2" }); }
  function insertMathInline() {
    if (!view) return;
    view.dispatch(view.state.tr.replaceSelectionWith(editorSchema.nodes.math_inline.create({ source: "E = mc^2" })).scrollIntoView());
    view.focus();
  }
  function insertBlockAtom(type: "mermaid_block" | "math_block", attrs: Record<string, unknown>) {
    if (!view) return;
    view.dispatch(view.state.tr.replaceSelectionWith(editorSchema.nodes[type].create(attrs)).scrollIntoView());
    view.focus();
  }

  function setLink() {
    if (!view) return;
    const mark = editorSchema.marks.link;
    const { from, to, empty, $from } = view.state.selection;
    const existing = mark.isInSet(view.state.storedMarks || $from.marks());
    const href = window.prompt("链接地址", existing?.attrs.href ?? "https://");
    if (href === null) return;
    const clean = href.trim();
    if (!clean) {
      if (!empty) view.dispatch(view.state.tr.removeMark(from, to, mark));
      return;
    }
    if (empty) view.dispatch(view.state.tr.addStoredMark(mark.create({ href: clean, title: null })));
    else view.dispatch(view.state.tr.addMark(from, to, mark.create({ href: clean, title: null })));
    view.focus();
  }

  function toggleTask() {
    if (!view) return;
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== "list_item") continue;
      const start = $from.before(depth) + 2;
      const text = node.firstChild?.textContent ?? "";
      if (/^\[[ xX]\](?=\s|$)/.test(text)) view.dispatch(view.state.tr.insertText(text[1].toLowerCase() === "x" ? "[ ]" : "[x]", start, start + 3));
      else view.dispatch(view.state.tr.insertText("[ ] ", start));
      view.focus();
      return;
    }
    const wrapped = wrapInList(editorSchema.nodes.bullet_list)(view.state, view.dispatch, view);
    if (!wrapped || !view) return;
    const nextFrom = view.state.selection.$from;
    for (let depth = nextFrom.depth; depth > 0; depth -= 1) {
      if (nextFrom.node(depth).type.name !== "list_item") continue;
      const pos = nextFrom.before(depth) + 2;
      const tr = view.state.tr.insertText("[ ] ", pos);
      view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 4))));
      view.focus();
      return;
    }
  }

  async function importImageFiles(files: File[]) {
    for (const file of files) {
      try {
        const asset = await importEditorImageFile(documentPath, file);
        insertImage(asset.relativePath, stripExtension(asset.fileName));
      } catch (error) {
        onError(`粘贴图片失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async function importImagePaths(paths: string[]) {
    for (const path of paths) {
      try {
        const asset = await importEditorImagePath(documentPath, path);
        insertImage(asset.relativePath, stripExtension(asset.fileName));
      } catch (error) {
        onError(`拖入图片失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  function insertImage(src: string, alt: string) {
    if (!view) return;
    const image = editorSchema.nodes.image.create({ src, alt, title: null, widthPct: null });
    const { $from } = view.state.selection;
    if ($from.parent.inlineContent) view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView());
    else view.dispatch(view.state.tr.replaceSelectionWith(editorSchema.nodes.paragraph.create(null, image)).scrollIntoView());
    view.focus();
  }

  function stripExtension(value: string) { return value.replace(/\.[^.]+$/, ""); }
  function chooseImage() { imagePicker?.click(); }
  function onImageChosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (files.length) void importImageFiles(files);
    input.value = "";
  }

  function tableAlign() {
    selectionVersion;
    if (!view) return null;
    const { $from } = view.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name === "table_cell" || node.type.name === "table_header") return node.attrs.align ?? null;
    }
    return null;
  }

  function slashCommands(): SlashCommand[] {
    return [
      { id: "paragraph", title: "正文", hint: "普通段落", keywords: "paragraph text 正文 段落", icon: "¶", run: setParagraph },
      { id: "h1", title: "一级标题", hint: "# Heading", keywords: "h1 heading 标题", icon: "H1", run: () => setHeading(1) },
      { id: "h2", title: "二级标题", hint: "## Heading", keywords: "h2 heading 标题", icon: "H2", run: () => setHeading(2) },
      { id: "h3", title: "三级标题", hint: "### Heading", keywords: "h3 heading 标题", icon: "H3", run: () => setHeading(3) },
      { id: "quote", title: "引用", hint: "> Quote", keywords: "quote blockquote 引用", icon: "❝", run: toggleBlockquote },
      { id: "bullet", title: "无序列表", hint: "- List", keywords: "bullet list 列表", icon: "•", run: toggleBulletList },
      { id: "ordered", title: "有序列表", hint: "1. List", keywords: "ordered list 列表", icon: "1.", run: toggleOrderedList },
      { id: "task", title: "任务列表", hint: "- [ ] Todo", keywords: "task todo checkbox 任务", icon: "☑", run: toggleTask },
      { id: "code", title: "代码块", hint: "``` code", keywords: "code block 代码", icon: "</>", run: setCodeBlock },
      { id: "hr", title: "分割线", hint: "---", keywords: "divider hr line 分割线", icon: "—", run: insertHorizontalRule },
      { id: "image", title: "图片", hint: "选择或拖入图片", keywords: "image photo 图片", icon: "▧", run: chooseImage },
      { id: "table", title: "表格", hint: "插入 3×3 GFM 表格", keywords: "table grid 表格", icon: "▦", run: insertTable },
      { id: "mermaid", title: "Mermaid", hint: "流程图 / 时序图", keywords: "diagram graph mermaid 图表", icon: "◇", run: insertMermaid },
      { id: "math-inline", title: "行内公式", hint: "$E = mc²$", keywords: "math katex formula 公式", icon: "∑", run: insertMathInline },
      { id: "math-block", title: "公式块", hint: "$$ ... $$", keywords: "math katex formula 公式块", icon: "ƒ", run: insertMathBlock },
    ];
  }

  function updateTransientUi() {
    updateSelectionToolbar();
    updateSlashMenu();
  }

  function updateSelectionToolbar() {
    if (!view || !view.hasFocus()) {
      if (selectionToolbar.open) selectionToolbar = { ...selectionToolbar, open: false };
      return;
    }
    const { from, to, empty, $from, $to } = view.state.selection;
    if (empty || !$from.parent.inlineContent || !$to.parent.inlineContent) {
      if (selectionToolbar.open) selectionToolbar = { ...selectionToolbar, open: false };
      return;
    }
    try {
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const nextToolbar = {
        open: true,
        x: Math.max(12, Math.min(window.innerWidth - 12, (start.left + end.right) / 2)),
        y: Math.max(10, Math.min(start.top, end.top) - 46),
      };
      if (!selectionToolbar.open || selectionToolbar.x !== nextToolbar.x || selectionToolbar.y !== nextToolbar.y) {
        selectionToolbar = nextToolbar;
      }
    } catch {
      if (selectionToolbar.open) selectionToolbar = { ...selectionToolbar, open: false };
    }
  }

  function updateSlashMenu() {
    if (!view || !view.hasFocus() || view.composing) {
      closeSlashMenu();
      return;
    }
    const selection = view.state.selection;
    if (!selection.empty || !selection.$from.parent.inlineContent || selection.$from.parent.type.name === "code_block") {
      closeSlashMenu();
      return;
    }
    const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\ufffc");
    const match = /(?:^|\s)\/([^\s/]*)$/.exec(before);
    if (!match) {
      closeSlashMenu();
      return;
    }
    const query = match[1] ?? "";
    const from = selection.from - query.length - 1;
    try {
      const coords = view.coordsAtPos(selection.from);
      const nextSelected = slashMenu.open && slashMenu.query === query ? slashMenu.selected : 0;
      slashMenu = {
        open: true,
        from,
        to: selection.from,
        query,
        selected: Math.min(nextSelected, Math.max(0, displayedSlashMatches.length - 1)),
        x: Math.max(12, Math.min(window.innerWidth - 320, coords.left)),
        y: Math.max(12, Math.min(window.innerHeight - 360, coords.bottom + 8)),
      };
    } catch {
      closeSlashMenu();
    }
  }

  function closeSlashMenu() {
    if (slashMenu.open) slashMenu = { ...slashMenu, open: false, query: "", selected: 0 };
  }

  function acceptSlashCommand(command: SlashCommand) {
    if (!view) return;
    const from = slashMenu.from;
    const to = slashMenu.to;
    closeSlashMenu();
    const tr = view.state.tr.delete(from, to);
    const pos = Math.min(Math.max(1, from), Math.max(1, tr.doc.content.size));
    view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos))));
    view.focus();
    requestAnimationFrame(() => command.run());
  }

  function keepEditorSelection(event: MouseEvent) {
    event.preventDefault();
  }

  function closeTableMenu() { tableMenu = { ...tableMenu, open: false }; }
  function runTable(command: any) {
    run(command);
    closeTableMenu();
  }
</script>

<div class="editor-shell editor-shell-clean" style={readerStyle($settings)} in:primaryContentMotion={{ y: 2, duration: 110 }}>
  <input bind:this={imagePicker} class="hidden" type="file" accept="image/*" multiple on:change={onImageChosen} />
  <div bind:this={scrollHost} class="editor-scroll-host">
    <div bind:this={host} class="editor-document"></div>
  </div>

  {#if selectionToolbar.open}
    <div class="pm-selection-toolbar" style={`left:${selectionToolbar.x}px;top:${selectionToolbar.y}px`} role="toolbar" aria-label="选中文本格式">
      <button class:active={markActive("strong")} on:mousedown={keepEditorSelection} on:click={() => run(toggleMark(editorSchema.marks.strong))}><strong>B</strong></button>
      <button class:active={markActive("em")} on:mousedown={keepEditorSelection} on:click={() => run(toggleMark(editorSchema.marks.em))}><em>I</em></button>
      <button class:active={markActive("strike")} on:mousedown={keepEditorSelection} on:click={() => run(toggleMark(editorSchema.marks.strike))}><s>S</s></button>
      <button class:active={markActive("code")} on:mousedown={keepEditorSelection} on:click={() => run(toggleMark(editorSchema.marks.code))}>&lt;/&gt;</button>
      <span></span>
      <button on:mousedown={keepEditorSelection} on:click={setLink}>链接</button>
    </div>
  {/if}

  {#if slashMenu.open}
    <div class="pm-slash-menu" style={`left:${slashMenu.x}px;top:${slashMenu.y}px`} role="listbox" aria-label="插入内容">
      <div class="pm-slash-title">输入 / 插入</div>
      {#if displayedSlashMatches.length}
        {#each displayedSlashMatches as command, index (command.id)}
          <button
            class:active={index === slashMenu.selected}
            role="option"
            aria-selected={index === slashMenu.selected}
            on:mousedown={keepEditorSelection}
            on:click={() => acceptSlashCommand(command)}
          >
            <span class="pm-slash-icon">{command.icon}</span>
            <span class="min-w-0 flex-1">
              <strong>{command.title}</strong>
              <small>{command.hint}</small>
            </span>
          </button>
        {/each}
      {:else}
        <div class="pm-slash-empty">没有匹配的命令</div>
      {/if}
    </div>
  {/if}

  {#if tableMenu.open}
    <div class="pm-table-context" style={`left:${tableMenu.x}px;top:${tableMenu.y}px`} role="menu" aria-label="表格操作" on:mousedown={keepEditorSelection}>
      <button on:click={() => runTable(addRowAfter)}>下方插入行</button>
      <button on:click={() => runTable(deleteRow)}>删除当前行</button>
      <div class="sep"></div>
      <button on:click={() => runTable(addColumnAfter)}>右侧插入列</button>
      <button on:click={() => runTable(deleteColumn)}>删除当前列</button>
      <div class="sep"></div>
      <div class="pm-table-align-row">
        <button class:active={tableAlign() === "left"} on:click={() => runTable(setCellAttr("align", "left"))}>左对齐</button>
        <button class:active={tableAlign() === "center"} on:click={() => runTable(setCellAttr("align", "center"))}>居中</button>
        <button class:active={tableAlign() === "right"} on:click={() => runTable(setCellAttr("align", "right"))}>右对齐</button>
      </div>
      <div class="sep"></div>
      <button class="danger" on:click={() => runTable(deleteTable)}>删除表格</button>
    </div>
  {/if}
</div>

import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";
import { resolveDocumentResources, localAssetUrl } from "../../services/resource-service";
import { copyPlainText } from "../../services/clipboard-service";
import { displayLanguage } from "../syntax/highlight-engine";

export function createEditorNodeViews(documentPath: string) {
  return {
    code_block: (node: ProseMirrorNode) => new CodeBlockNodeView(node),
    image: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => new ImageNodeView(node, view, getPos, documentPath),
    mermaid_block: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => new RichSourceNodeView(node, view, getPos, "mermaid"),
    math_block: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => new RichSourceNodeView(node, view, getPos, "math-block"),
    math_inline: (node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) => new RichSourceNodeView(node, view, getPos, "math-inline"),
  };
}

class CodeBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private language: HTMLElement;
  private copyButton: HTMLButtonElement;
  private node: ProseMirrorNode;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(node: ProseMirrorNode) {
    this.node = node;
    this.dom = document.createElement("div");
    this.dom.className = "pm-code-block";

    const header = document.createElement("div");
    header.className = "pm-code-header";
    header.contentEditable = "false";

    this.language = document.createElement("span");
    this.language.className = "pm-code-language";

    this.copyButton = document.createElement("button");
    this.copyButton.type = "button";
    this.copyButton.className = "pm-code-copy";
    this.copyButton.textContent = "复制";
    this.copyButton.setAttribute("aria-label", "复制代码");
    this.copyButton.addEventListener("mousedown", (event) => event.preventDefault());
    this.copyButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.copy();
    });

    header.append(this.language, this.copyButton);

    const pre = document.createElement("pre");
    pre.className = "pm-code-pre";
    this.contentDOM = document.createElement("code");
    this.contentDOM.className = "pm-code-content";
    pre.append(this.contentDOM);
    this.dom.append(header, pre);
    this.renderMeta();
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderMeta();
    return true;
  }

  stopEvent(event: Event) {
    return Boolean((event.target as HTMLElement | null)?.closest?.(".pm-code-header"));
  }

  destroy() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  private renderMeta() {
    const raw = String(this.node.attrs.params ?? "");
    this.language.textContent = displayLanguage(raw);
    this.dom.dataset.language = raw.trim().split(/\s+/)[0]?.toLocaleLowerCase() || "text";
  }

  private async copy() {
    try {
      await copyPlainText(this.contentDOM.textContent ?? this.node.textContent);
      this.copyButton.textContent = "已复制";
      this.copyButton.classList.add("copied");
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.copyButton.textContent = "复制";
        this.copyButton.classList.remove("copied");
        this.resetTimer = null;
      }, 1400);
    } catch {
      this.copyButton.textContent = "复制失败";
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => {
        this.copyButton.textContent = "复制";
        this.resetTimer = null;
      }, 1600);
    }
  }
}

class ImageNodeView implements NodeView {
  dom: HTMLElement;
  private image: HTMLImageElement;
  private caption: HTMLElement;
  private leftHandle: HTMLButtonElement;
  private rightHandle: HTMLButtonElement;
  private node: ProseMirrorNode;
  private requestVersion = 0;

  constructor(
    node: ProseMirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private documentPath: string,
  ) {
    this.node = node;
    this.dom = document.createElement("span");
    this.dom.className = "pm-image-node";
    this.dom.contentEditable = "false";
    this.image = document.createElement("img");
    this.image.draggable = false;
    this.caption = document.createElement("span");
    this.caption.className = "pm-image-caption";
    this.leftHandle = this.resizeHandle("left");
    this.rightHandle = this.resizeHandle("right");
    this.dom.append(this.image, this.caption, this.leftHandle, this.rightHandle);
    this.dom.addEventListener("dblclick", (event) => {
      if ((event.target as HTMLElement).closest(".pm-image-resize")) return;
      this.editAlt();
    });
    void this.render();
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.applyWidth();
    void this.render();
    return true;
  }

  selectNode() { this.dom.classList.add("ProseMirror-selectednode"); }
  deselectNode() { this.dom.classList.remove("ProseMirror-selectednode"); }
  ignoreMutation() { return true; }
  stopEvent(event: Event) {
    return Boolean((event.target as HTMLElement | null)?.closest?.(".pm-image-resize"));
  }

  private resizeHandle(side: "left" | "right") {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = `pm-image-resize pm-image-resize-${side}`;
    handle.tabIndex = -1;
    handle.setAttribute("aria-label", side === "left" ? "从左侧调整图片宽度" : "从右侧调整图片宽度");
    handle.addEventListener("pointerdown", (event) => this.beginResize(event, side));
    return handle;
  }

  private beginResize(event: PointerEvent, side: "left" | "right") {
    event.preventDefault();
    event.stopPropagation();
    const editor = this.dom.closest(".markdown-wysiwyg") as HTMLElement | null;
    const maxWidth = Math.max(240, editor?.clientWidth ?? this.dom.parentElement?.clientWidth ?? 800);
    const startX = event.clientX;
    const startWidth = this.dom.getBoundingClientRect().width;
    const direction = side === "right" ? 1 : -1;
    this.dom.classList.add("resizing");

    const move = (moveEvent: PointerEvent) => {
      const px = Math.min(maxWidth, Math.max(120, startWidth + (moveEvent.clientX - startX) * direction));
      const pct = Math.round((px / maxWidth) * 1000) / 10;
      this.dom.style.width = `${pct}%`;
    };
    const end = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      this.dom.classList.remove("resizing");
      const px = this.dom.getBoundingClientRect().width;
      const pct = Math.min(100, Math.max(15, Math.round((px / maxWidth) * 1000) / 10));
      const pos = this.getPos();
      if (typeof pos === "number") {
        this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, widthPct: pct }));
      }
      upEvent.preventDefault();
      this.view.focus();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  private applyWidth() {
    const value = Number(this.node.attrs.widthPct);
    if (Number.isFinite(value) && value > 0) this.dom.style.width = `${Math.min(100, Math.max(15, value))}%`;
    else this.dom.style.removeProperty("width");
  }

  private async render() {
    const version = ++this.requestVersion;
    const raw = String(this.node.attrs.src ?? "");
    this.applyWidth();
    this.image.alt = String(this.node.attrs.alt ?? "");
    this.caption.textContent = this.image.alt || raw;
    this.dom.classList.add("loading");
    this.dom.classList.remove("error");
    this.image.onload = () => { if (version === this.requestVersion) this.dom.classList.remove("loading"); };
    this.image.onerror = () => { if (version === this.requestVersion) { this.dom.classList.remove("loading"); this.dom.classList.add("error"); } };

    if (/^(https?:|data:|blob:|asset:)/i.test(raw)) {
      this.image.src = raw;
      return;
    }
    try {
      const [resolved] = await resolveDocumentResources(this.documentPath, [{ raw, kind: "image" }]);
      if (version !== this.requestVersion) return;
      this.image.src = resolved?.exists ? localAssetUrl(resolved.path) : raw;
    } catch {
      this.image.src = raw;
    }
  }

  private editAlt() {
    const next = window.prompt("图片说明（Alt）", String(this.node.attrs.alt ?? ""));
    if (next === null) return;
    const pos = this.getPos();
    if (typeof pos !== "number") return;
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, alt: next.trim() || null }));
    this.view.focus();
  }
}

type RichKind = "mermaid" | "math-block" | "math-inline";

class RichSourceNodeView implements NodeView {
  dom: HTMLElement;
  private preview: HTMLElement;
  private sourceEditor: HTMLTextAreaElement | HTMLInputElement | null = null;
  private node: ProseMirrorNode;
  private renderVersion = 0;

  constructor(
    node: ProseMirrorNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private kind: RichKind,
  ) {
    this.node = node;
    this.dom = document.createElement(kind === "math-inline" ? "span" : "div");
    this.dom.className = `pm-rich-node pm-${kind}`;
    this.dom.contentEditable = "false";
    this.preview = document.createElement(kind === "math-inline" ? "span" : "div");
    this.preview.className = "pm-rich-preview";
    this.dom.append(this.preview);
    this.dom.title = kind === "mermaid" ? "双击编辑 Mermaid" : "双击编辑公式";
    this.dom.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.enterEdit();
    });
    void this.renderPreview();
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.sourceEditor) void this.renderPreview();
    return true;
  }

  selectNode() { this.dom.classList.add("ProseMirror-selectednode"); }
  deselectNode() { this.dom.classList.remove("ProseMirror-selectednode"); }
  ignoreMutation() { return true; }
  stopEvent(event: Event) { return Boolean(this.sourceEditor && this.dom.contains(event.target as Node)); }

  private enterEdit() {
    if (this.sourceEditor) return;
    const source = String(this.node.attrs.source ?? "");
    const editor = this.kind === "math-inline" ? document.createElement("input") : document.createElement("textarea");
    editor.className = "pm-rich-source-editor";
    editor.value = source;
    if (editor instanceof HTMLTextAreaElement) editor.rows = this.kind === "mermaid" ? Math.max(5, source.split(/\r?\n/).length + 1) : 4;
    this.sourceEditor = editor;
    this.preview.hidden = true;
    this.dom.append(editor);
    editor.focus();
    editor.select();
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.exitEdit(false);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.exitEdit(true);
      }
    });
    editor.addEventListener("blur", () => this.exitEdit(true), { once: true });
  }

  private exitEdit(commit: boolean) {
    const editor = this.sourceEditor;
    if (!editor) return;
    const value = editor.value.trim();
    this.sourceEditor = null;
    editor.remove();
    this.preview.hidden = false;
    if (commit && value !== String(this.node.attrs.source ?? "")) {
      const pos = this.getPos();
      if (typeof pos === "number") {
        this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, source: value }));
      }
    }
    void this.renderPreview();
  }

  private async renderPreview() {
    const version = ++this.renderVersion;
    const source = String(this.node.attrs.source ?? "");
    this.dom.classList.remove("render-error");
    try {
      if (this.kind === "mermaid") {
        const module = await import("mermaid");
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        });
        const id = `pm-mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, source);
        if (version !== this.renderVersion || this.sourceEditor) return;
        this.preview.innerHTML = svg;
      } else {
        const [module] = await Promise.all([import("katex"), import("katex/dist/katex.min.css")]);
        const katex = module.default;
        if (version !== this.renderVersion || this.sourceEditor) return;
        this.preview.innerHTML = "";
        katex.render(source, this.preview, {
          displayMode: this.kind === "math-block",
          throwOnError: false,
          trust: false,
          strict: "warn",
        });
      }
    } catch (error) {
      if (version !== this.renderVersion || this.sourceEditor) return;
      this.dom.classList.add("render-error");
      this.preview.textContent = source || (this.kind === "mermaid" ? "Mermaid" : "公式");
      this.preview.title = error instanceof Error ? error.message : String(error);
    }
  }
}

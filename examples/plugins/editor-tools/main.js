markdownViewer.definePlugin({
  async onLoad(ctx) {
    const disposables = [];

    disposables.push(ctx.commands.register({
      id: "uppercase-selection",
      title: "Editor Tools：选中文字转大写",
      description: "演示 editor.read / editor.write，不接触 ProseMirror EditorView",
      keywords: ["editor", "selection", "uppercase", "插件", "选区"],
      run: async () => {
        const selection = await ctx.editor.getSelection();
        if (!selection || selection.empty) {
          await ctx.ui.notice("请先在所见即所得编辑器中选择文字");
          return;
        }
        await ctx.editor.replaceSelection(selection.text.toLocaleUpperCase());
      }
    }));

    disposables.push(ctx.commands.register({
      id: "show-editor-summary",
      title: "Editor Tools：显示编辑器摘要",
      description: "读取 Markdown 源码和当前选区摘要",
      keywords: ["editor", "source", "summary", "插件"],
      run: async () => {
        const document = await ctx.editor.getDocument();
        if (!document) {
          await ctx.ui.notice("当前没有可编辑的所见即所得文档");
          return;
        }
        await ctx.ui.notice(`源码 ${document.source.length} 字符 · 选区 ${document.selection.text.length} 字符`);
      }
    }));

    disposables.push(ctx.events.on("workspace.activeFileChanged", async ({ file }) => {
      if (file) await ctx.ui.notice(`已切换到：${file.fileName}`);
    }));

    this.disposables = disposables;
  },

  async onUnload() {
    for (const dispose of this.disposables ?? []) dispose();
    this.disposables = [];
  }
});

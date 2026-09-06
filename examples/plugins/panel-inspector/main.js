let panel;

markdownViewer.definePlugin({
  async onLoad(ctx) {
    panel = ctx.ui.registerPanel({
      id: "inspector",
      title: "文档检查器",
      icon: "document",
      when: "document",
      html: `
        <div class="panel-shell">
          <div class="eyebrow">PLUGIN PANEL</div>
          <h2>文档检查器</h2>
          <div id="summary" class="summary">正在读取当前文档…</div>
          <button id="refresh" type="button">刷新</button>
        </div>
        <script>
          const summary = document.getElementById("summary");
          document.getElementById("refresh").addEventListener("click", () => {
            window.markdownViewerPanel.postMessage({ type: "refresh" });
          });
          window.markdownViewerPanel.onMessage((message) => {
            if (!message || message.type !== "summary") return;
            summary.textContent = message.text;
          });
        <\/script>
      `,
      css: `
        .panel-shell{display:grid;gap:10px}
        .eyebrow{font-size:9px;font-weight:700;letter-spacing:.12em;opacity:.45}
        h2{margin:0;font-size:16px;line-height:1.25}
        .summary{white-space:pre-wrap;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:10px;padding:10px;background:color-mix(in srgb,currentColor 4%,transparent)}
        button{justify-self:start;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:8px;background:transparent;padding:6px 10px}
        button:hover{background:color-mix(in srgb,currentColor 6%,transparent)}
      `
    });

    async function pushSummary() {
      const file = await ctx.workspace.getActiveFile();
      const doc = await ctx.editor.getDocument();
      if (!file || !doc) {
        panel.postMessage({ type: "summary", text: "当前没有可读取的文档" });
        return;
      }
      const lineCount = doc.source ? doc.source.split(/\r?\n/).length : 0;
      const selection = doc.selection.empty ? "无选区" : `已选择 ${doc.selection.text.length} 个字符`;
      panel.postMessage({
        type: "summary",
        text: `${file.fileName}\n格式：${file.format}\n行数：${lineCount}\n${selection}`
      });
    }

    panel.onMessage(async (message) => {
      if (!message) return;
      if (message.type === "ready" || message.type === "refresh") await pushSummary();
    });

    ctx.events.on("workspace.activeFileChanged", pushSummary);
    ctx.events.on("editor.selectionChanged", pushSummary);

    ctx.commands.register({
      id: "open-inspector",
      title: "Panel Inspector：打开文档检查器",
      description: "打开独立沙箱插件面板",
      keywords: ["panel", "面板", "inspector"],
      run() {
        panel.open();
      }
    });
  },

  async onUnload() {
    panel?.dispose();
    panel = null;
  }
});

markdownViewer.definePlugin({
  async onLoad(ctx) {
    ctx.commands.register({
      id: "show-file",
      title: "UI Contributions：显示当前文件",
      description: "同一个命令同时被状态栏、顶栏和右键菜单复用",
      keywords: ["ui", "contribution", "状态栏", "右键"],
      shortcut: "Mod+Shift+U",
      async run() {
        const file = await ctx.workspace.getActiveFile();
        await ctx.ui.notice(file ? `当前文件：${file.fileName}` : "当前没有打开文档");
      }
    });

    ctx.ui.contribute({ id: "status", placement: "statusbar", label: "UI Demo", command: "show-file", when: "document", side: "right", order: 90 });
    ctx.ui.contribute({ id: "toolbar", placement: "toolbar", label: "显示当前文件", tooltip: "UI Contributions 示例", icon: "code", command: "show-file", when: "document", order: 90 });
    ctx.ui.contribute({ id: "selection-menu", placement: "context-menu", label: "插件：显示当前文件", command: "show-file", when: "selection", order: 90 });
  }
});

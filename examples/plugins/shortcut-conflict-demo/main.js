let disposers = [];

markdownViewer.definePlugin({
  async onLoad(ctx) {
    disposers.push(ctx.commands.register({
      id: "try-save-shortcut",
      title: "Shortcut Demo：测试 Mod+S 冲突",
      description: "该命令故意请求宿主保存快捷键，应该只保留命令面板入口。",
      shortcut: "Mod+S",
      async run() {
        await ctx.ui.notice("冲突命令已执行；Mod+S 仍由 oneView 保存占用");
      }
    }));

    disposers.push(ctx.commands.register({
      id: "available-shortcut",
      title: "Shortcut Demo：可用快捷键",
      shortcut: "Mod+Shift+U",
      async run() {
        await ctx.ui.notice("Mod+Shift+U 插件快捷键可用");
      }
    }));
  },

  async onUnload() {
    for (const dispose of disposers.splice(0).reverse()) {
      try { dispose(); } catch (_) {}
    }
  }
});

markdownViewer.definePlugin({
  async onLoad(ctx) {
    const launches = Number((await ctx.storage.get("launches")) ?? 0) + 1;
    await ctx.storage.set("launches", launches);

    ctx.commands.register({
      id: "say-hello",
      title: "Hello World：显示当前文档",
      description: "演示 commands、workspace、storage 与 notice API",
      keywords: ["hello", "example", "示例"],
      run: async () => {
        const file = await ctx.workspace.getActiveFile();
        const target = file ? `当前文档：${file.fileName}` : "当前没有打开文档";
        await ctx.ui.notice(`${target} · 插件已加载 ${launches} 次`);
      }
    });
  },

  async onUnload() {
    // 注册的命令会由宿主自动清理；这里只处理插件自己的临时资源。
  }
});

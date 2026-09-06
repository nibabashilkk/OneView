let disposers = [];

markdownViewer.definePlugin({
  async onLoad(ctx) {
    disposers.push(ctx.commands.register({
      id: "healthy",
      title: "Diagnostics Demo：运行正常",
      keywords: ["diagnostics", "health", "demo"],
      async run() {
        await ctx.ui.notice("Diagnostics Demo 当前运行正常");
      }
    }));

    disposers.push(ctx.commands.register({
      id: "throw-test-error",
      title: "Diagnostics Demo：抛出一次测试错误",
      description: "连续执行 5 次可验证 60 秒熔断保护。",
      keywords: ["diagnostics", "error", "breaker", "测试错误"],
      async run() {
        throw new Error("这是 Diagnostics Demo 主动产生的测试错误");
      }
    }));
  },

  async onUnload() {
    for (const dispose of disposers.splice(0).reverse()) {
      try { dispose(); } catch (_) {}
    }
  }
});

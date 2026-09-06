let disposers = [];

markdownViewer.definePlugin({
  async onLoad(ctx) {
    disposers.push(ctx.settings.register({
      title: "Settings Demo",
      fields: [
        {
          key: "enabled",
          type: "boolean",
          label: "启用增强提示",
          description: "演示布尔型设置。",
          defaultValue: true
        },
        {
          key: "nickname",
          type: "text",
          label: "显示名称",
          description: "演示文本设置。",
          defaultValue: "oneView",
          placeholder: "请输入名称"
        },
        {
          key: "density",
          type: "number",
          label: "密度",
          description: "演示数值范围校验。",
          defaultValue: 2,
          min: 1,
          max: 5,
          step: 1
        },
        {
          key: "mode",
          type: "select",
          label: "模式",
          description: "演示受控枚举。",
          defaultValue: "compact",
          options: [
            { label: "紧凑", value: "compact" },
            { label: "舒展", value: "comfortable" }
          ]
        },
        {
          key: "note",
          type: "text",
          label: "备注",
          description: "多行文本不会被插件直接插入设置页 DOM。",
          defaultValue: "",
          multiline: true,
          placeholder: "写点说明…"
        }
      ]
    }));

    disposers.push(ctx.settings.onChanged(async ({ key, value }) => {
      if (key === "enabled") {
        await ctx.ui.notice(`Settings Demo：enabled = ${String(value)}`);
      }
    }));

    disposers.push(ctx.commands.register({
      id: "show-settings",
      title: "Settings Demo：显示当前设置",
      keywords: ["settings", "plugin", "demo"],
      async run() {
        const [enabled, nickname, density, mode] = await Promise.all([
          ctx.settings.get("enabled"),
          ctx.settings.get("nickname"),
          ctx.settings.get("density"),
          ctx.settings.get("mode")
        ]);
        await ctx.ui.notice(`${nickname} · enabled=${enabled} · density=${density} · mode=${mode}`);
      }
    }));
  },

  async onUnload() {
    for (const dispose of disposers.splice(0).reverse()) {
      try { dispose(); } catch (_) {}
    }
  }
});

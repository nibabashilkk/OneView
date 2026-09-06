export type CommandGroup = "文件" | "工作区" | "编辑" | "查看" | "导航" | "复制" | "导出" | "插件" | "设置" | "帮助";

export type AppCommand = {
  id: string;
  title: string;
  subtitle?: string;
  group: CommandGroup;
  keywords?: string[];
  shortcut?: string;
  enabled?: boolean;
  run: () => void | Promise<void>;
};

export const APP_RESERVED_SHORTCUTS = {
  "file.open": "Mod+O",
  "workspace.open": "Mod+Shift+O",
  "workspace.search": "Mod+Shift+F",
  "file.save": "Mod+S",
  "view.command-palette": "Mod+K",
  "view.command-palette-alt": "Mod+Shift+P",
  "view.search": "Mod+F",
  "view.sidebar": "Mod+B",
  "nav.next-tab": "Ctrl+Tab",
  "nav.previous-tab": "Ctrl+Shift+Tab",
  "file.close-tab": "Mod+W",
  "export.pdf": "Mod+P",
  "settings.open": "Mod+,",
  "edit.copy": "Mod+C",
  "edit.cut": "Mod+X",
  "edit.paste": "Mod+V",
  "edit.select-all": "Mod+A",
  "edit.undo": "Mod+Z",
  "edit.redo": "Mod+Shift+Z",
  "edit.redo-windows": "Mod+Y",
  "nav.tab-1": "Mod+1",
  "nav.tab-2": "Mod+2",
  "nav.tab-3": "Mod+3",
  "nav.tab-4": "Mod+4",
  "nav.tab-5": "Mod+5",
  "nav.tab-6": "Mod+6",
  "nav.tab-7": "Mod+7",
  "nav.tab-8": "Mod+8",
  "nav.tab-9": "Mod+9",
  "app.quit": "Mod+Q",
} as const;

export const APP_RESERVED_SHORTCUT_ENTRIES = Object.entries(APP_RESERVED_SHORTCUTS).map(([id, shortcut]) => ({
  id,
  shortcut,
  title: reservedShortcutTitle(id),
}));

function reservedShortcutTitle(id: string) {
  const labels: Record<string, string> = {
    "file.open": "打开文档文件",
    "workspace.open": "打开文件夹工作区",
    "workspace.search": "在工作区中搜索",
    "file.save": "保存当前 Markdown",
    "view.command-palette": "打开命令面板",
    "view.command-palette-alt": "打开命令面板（备用快捷键）",
    "view.search": "在当前文档中查找",
    "view.sidebar": "显示 / 隐藏侧栏",
    "nav.next-tab": "下一个标签页",
    "nav.previous-tab": "上一个标签页",
    "file.close-tab": "关闭当前标签页",
    "export.pdf": "PDF / 打印",
    "settings.open": "打开设置",
    "edit.copy": "系统复制",
    "edit.cut": "系统剪切",
    "edit.paste": "系统粘贴",
    "edit.select-all": "系统全选",
    "edit.undo": "系统撤销",
    "edit.redo": "系统重做",
    "edit.redo-windows": "系统重做（Windows）",
    "nav.tab-1": "切换到标签页 1",
    "nav.tab-2": "切换到标签页 2",
    "nav.tab-3": "切换到标签页 3",
    "nav.tab-4": "切换到标签页 4",
    "nav.tab-5": "切换到标签页 5",
    "nav.tab-6": "切换到标签页 6",
    "nav.tab-7": "切换到标签页 7",
    "nav.tab-8": "切换到标签页 8",
    "nav.tab-9": "切换到标签页 9",
    "app.quit": "退出 oneView",
  };
  return labels[id] ?? id;
}

export type AppCommandContext = {
  hasDocument: boolean;
  hasLocalDocument: boolean;
  canEdit: boolean;
  hasMultipleTabs: boolean;
  updaterConfigured: boolean;
  dirty: boolean;
  canSearch: boolean;
  openFile: () => void | Promise<void>;
  openWorkspace: () => void | Promise<void>;
  openWorkspaceSearch: () => void;
  hasWorkspace: boolean;
  openSearch: () => void;
  saveActive: () => void | Promise<void>;
  openCommandPalette: () => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  closeActive: () => void | Promise<void>;
  nextTab: () => void;
  previousTab: () => void;
  openSettings: () => void;
  openPlugins: () => void;
  revealActive: () => void | Promise<void>;
  exportHtml: () => void | Promise<void>;
  printPdf: () => void;
  copyDocumentText: () => void | Promise<void>;
  copyDocumentRich: () => void | Promise<void>;
  copyDocumentHtml: () => void | Promise<void>;
  copyDocumentPath: () => void | Promise<void>;
  checkUpdates: () => void | Promise<void>;
  openAbout: () => void;
  openDiagnostics: () => void;
  quitApp: () => void | Promise<void>;
};

export function createAppCommands(context: AppCommandContext): AppCommand[] {
  return [
    {
      id: "file.open",
      title: "打开文档文件",
      subtitle: "Markdown 与已启用插件支持的格式",
      group: "文件",
      keywords: ["open", "打开", "文件"],
      shortcut: APP_RESERVED_SHORTCUTS["file.open"],
      run: context.openFile,
    },
    {
      id: "workspace.open",
      title: "打开文件夹工作区",
      subtitle: "浏览 Markdown 与插件支持的项目文档",
      group: "工作区",
      keywords: ["workspace", "folder", "project", "工作区", "文件夹", "项目"],
      shortcut: APP_RESERVED_SHORTCUTS["workspace.open"],
      run: context.openWorkspace,
    },
    {
      id: "workspace.search",
      title: "在工作区中搜索",
      subtitle: "跨文件全文搜索当前项目",
      group: "工作区",
      keywords: ["workspace", "global", "search", "全局搜索", "项目搜索"],
      shortcut: APP_RESERVED_SHORTCUTS["workspace.search"],
      enabled: context.hasWorkspace,
      run: context.openWorkspaceSearch,
    },
    {
      id: "file.save",
      title: "保存当前 Markdown",
      subtitle: context.dirty ? "写回原文件" : "当前文档没有未保存更改",
      group: "文件",
      keywords: ["save", "保存", "写入"],
      shortcut: APP_RESERVED_SHORTCUTS["file.save"],
      enabled: context.canEdit && context.dirty,
      run: context.saveActive,
    },
    {
      id: "view.command-palette",
      title: "打开命令面板",
      group: "查看",
      keywords: ["command", "palette", "命令"],
      shortcut: APP_RESERVED_SHORTCUTS["view.command-palette"],
      run: context.openCommandPalette,
    },
    {
      id: "view.search",
      title: "在当前文档中查找",
      group: "查看",
      keywords: ["find", "search", "搜索", "查找"],
      shortcut: APP_RESERVED_SHORTCUTS["view.search"],
      enabled: context.hasDocument && context.canSearch,
      run: context.openSearch,
    },
    {
      id: "view.sidebar",
      title: "显示 / 隐藏侧栏",
      group: "查看",
      keywords: ["outline", "sidebar", "目录", "侧栏"],
      shortcut: APP_RESERVED_SHORTCUTS["view.sidebar"],
      run: context.toggleSidebar,
    },
    {
      id: "view.toggle-theme",
      title: "快速切换明暗模式",
      group: "查看",
      keywords: ["theme", "dark", "light", "主题", "明暗"],
      run: context.toggleTheme,
    },
    {
      id: "nav.next-tab",
      title: "下一个标签页",
      group: "导航",
      keywords: ["tab", "next", "下一个"],
      shortcut: APP_RESERVED_SHORTCUTS["nav.next-tab"],
      enabled: context.hasMultipleTabs,
      run: context.nextTab,
    },
    {
      id: "nav.previous-tab",
      title: "上一个标签页",
      group: "导航",
      keywords: ["tab", "previous", "上一个"],
      shortcut: APP_RESERVED_SHORTCUTS["nav.previous-tab"],
      enabled: context.hasMultipleTabs,
      run: context.previousTab,
    },
    {
      id: "file.close-tab",
      title: "关闭当前标签页",
      group: "文件",
      keywords: ["close", "tab", "关闭"],
      shortcut: APP_RESERVED_SHORTCUTS["file.close-tab"],
      enabled: context.hasDocument,
      run: context.closeActive,
    },
    {
      id: "file.reveal",
      title: "在 Finder / 资源管理器中显示",
      group: "文件",
      keywords: ["finder", "explorer", "显示位置", "定位"],
      enabled: context.hasLocalDocument,
      run: context.revealActive,
    },
    {
      id: "copy.document-text",
      title: "复制全文纯文本",
      subtitle: "复制当前渲染后的可见文本",
      group: "复制",
      keywords: ["copy", "plain", "text", "复制", "纯文本"],
      enabled: context.hasDocument,
      run: context.copyDocumentText,
    },
    {
      id: "copy.document-rich",
      title: "复制全文为富文本",
      subtitle: "粘贴到 Word、Notion、邮件时保留格式",
      group: "复制",
      keywords: ["copy", "rich", "word", "notion", "复制", "富文本"],
      enabled: context.hasDocument,
      run: context.copyDocumentRich,
    },
    {
      id: "copy.document-html",
      title: "复制全文 HTML",
      subtitle: "把渲染后的 HTML 标记作为源码复制",
      group: "复制",
      keywords: ["copy", "html", "source", "复制"],
      enabled: context.hasDocument,
      run: context.copyDocumentHtml,
    },
    {
      id: "copy.document-path",
      title: "复制当前文件路径",
      group: "复制",
      keywords: ["copy", "path", "路径"],
      enabled: context.hasLocalDocument,
      run: context.copyDocumentPath,
    },
    {
      id: "export.html",
      title: "导出 HTML",
      group: "导出",
      keywords: ["export", "html", "导出"],
      enabled: context.hasLocalDocument,
      run: context.exportHtml,
    },
    {
      id: "export.pdf",
      title: "PDF / 打印",
      group: "导出",
      keywords: ["pdf", "print", "打印", "导出"],
      shortcut: APP_RESERVED_SHORTCUTS["export.pdf"],
      enabled: context.hasDocument,
      run: context.printPdf,
    },
    {
      id: "plugins.open",
      title: "打开插件中心",
      subtitle: "安装、启用和管理插件",
      group: "插件",
      keywords: ["plugin", "extension", "插件", "扩展", "安装"],
      run: context.openPlugins,
    },
    {
      id: "settings.open",
      title: "打开设置",
      group: "设置",
      keywords: ["settings", "theme", "font", "autosave", "设置", "主题", "字体", "自动保存"],
      shortcut: APP_RESERVED_SHORTCUTS["settings.open"],
      run: context.openSettings,
    },
    {
      id: "help.check-updates",
      title: "检查软件更新",
      subtitle: context.updaterConfigured ? "检查是否有新版本" : "当前构建未配置更新源",
      group: "帮助",
      keywords: ["update", "upgrade", "更新", "升级"],
      enabled: context.updaterConfigured,
      run: context.checkUpdates,
    },
    {
      id: "help.diagnostics",
      title: "打开诊断信息",
      group: "帮助",
      keywords: ["diagnostics", "debug", "error", "诊断", "错误"],
      run: context.openDiagnostics,
    },
    {
      id: "help.about",
      title: "关于 oneView",
      group: "帮助",
      keywords: ["about", "version", "关于", "版本"],
      run: context.openAbout,
    },
    {
      id: "app.quit",
      title: "退出 oneView",
      group: "文件",
      keywords: ["quit", "exit", "退出", "关闭应用"],
      shortcut: APP_RESERVED_SHORTCUTS["app.quit"],
      run: context.quitApp,
    },
  ];
}

export function commandMatchesQuery(command: AppCommand, query: string): number {
  const needle = normalize(query);
  if (!needle) return 1;
  const title = normalize(command.title);
  const haystack = normalize([command.title, command.subtitle ?? "", command.group, ...(command.keywords ?? [])].join(" "));
  if (title === needle) return 100;
  if (title.startsWith(needle)) return 80;
  if (title.includes(needle)) return 60;
  if (haystack.includes(needle)) return 40;

  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor >= needle.length) return 15;
  }
  return 0;
}

export function commandMatchesKeyboard(command: AppCommand, event: KeyboardEvent): boolean {
  if (!command.shortcut) return false;
  const parts = command.shortcut.split("+");
  const wantedKey = parts.at(-1)?.toLowerCase() ?? "";
  const wantsMod = parts.includes("Mod");
  const wantsCtrl = parts.includes("Ctrl");
  const wantsShift = parts.includes("Shift");
  const wantsAlt = parts.includes("Alt");
  const primary = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (wantsMod) {
    if (!primary) return false;
  } else {
    if (event.metaKey) return false;
    if (wantsCtrl !== event.ctrlKey) return false;
  }
  if (wantsShift !== event.shiftKey) return false;
  if (wantsAlt !== event.altKey) return false;
  return key === wantedKey;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

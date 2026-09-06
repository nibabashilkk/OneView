# v0.17.3 — Top Title Tabs

## Goal

把多文档标签从独立第二行移动到窗口最顶部，接近浏览器/Obsidian 的标签切换方式，同时减少常驻按钮对正文的干扰。

## Changes

- macOS 开启 `titleBarStyle: Overlay` + `hiddenTitle`，保留原生红黄绿窗口按钮。
- `TopBar.svelte` 直接承载文档标签；一个文档时也显示标签。
- `+` 用于打开新文件并形成新标签。
- 低频按钮统一进入 `MoreMenu.svelte`。
- 删除旧独立 TabBar/ExportMenu/RecentMenu。
- 顶部总高度由原来的 topbar + tabbar 两行压缩为 40px 一行。

## Safety

未修改文档解析、WYSIWYG、保存、退出保护和文件监听逻辑。

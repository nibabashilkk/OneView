use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter,
};

pub const MENU_COMMAND_EVENT: &str = "app://command";

pub fn install(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("file.open", "打开…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let open_workspace = MenuItemBuilder::with_id("workspace.open", "打开文件夹工作区…")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
    let workspace_search = MenuItemBuilder::with_id("workspace.search", "在工作区中搜索…")
        .accelerator("CmdOrCtrl+Shift+F")
        .build(app)?;
    let save = MenuItemBuilder::with_id("file.save", "保存")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let close = MenuItemBuilder::with_id("file.close-tab", "关闭标签页")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;
    let reveal = MenuItemBuilder::with_id("file.reveal", "在 Finder / 资源管理器中显示")
        .build(app)?;
    let export_html = MenuItemBuilder::with_id("export.html", "导出 HTML…").build(app)?;
    let print_pdf = MenuItemBuilder::with_id("export.pdf", "PDF / 打印…")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;

    let command_palette = MenuItemBuilder::with_id("view.command-palette", "命令面板…")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let search = MenuItemBuilder::with_id("view.search", "查找…")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let sidebar = MenuItemBuilder::with_id("view.sidebar", "显示 / 隐藏侧栏")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;
    let theme = MenuItemBuilder::with_id("view.toggle-theme", "切换明暗模式").build(app)?;
    let settings = MenuItemBuilder::with_id("settings.open", "设置…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let plugin_center = MenuItemBuilder::with_id("plugins.open", "插件中心…").build(app)?;

    let copy_text = MenuItemBuilder::with_id("copy.document-text", "复制全文纯文本").build(app)?;
    let copy_rich = MenuItemBuilder::with_id("copy.document-rich", "复制全文为富文本").build(app)?;
    let copy_html = MenuItemBuilder::with_id("copy.document-html", "复制全文 HTML").build(app)?;
    let copy_path = MenuItemBuilder::with_id("copy.document-path", "复制文件路径").build(app)?;

    let next_tab = MenuItemBuilder::with_id("nav.next-tab", "下一个标签页")
        .accelerator("Ctrl+Tab")
        .build(app)?;
    let previous_tab = MenuItemBuilder::with_id("nav.previous-tab", "上一个标签页")
        .accelerator("Ctrl+Shift+Tab")
        .build(app)?;

    let check_updates = MenuItemBuilder::with_id("help.check-updates", "检查更新…").build(app)?;
    let diagnostics = MenuItemBuilder::with_id("help.diagnostics", "诊断信息…").build(app)?;
    let about = MenuItemBuilder::with_id("help.about", "关于 oneView").build(app)?;
    let quit_app = MenuItemBuilder::with_id("app.quit", "退出 oneView")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    #[cfg(target_os = "macos")]
    let application_menu = SubmenuBuilder::new(app, "oneView")
        .item(&about)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&quit_app)
        .build()?;

    #[cfg(target_os = "macos")]
    let file_menu = SubmenuBuilder::new(app, "文件")
        .items(&[&open, &open_workspace, &save, &close])
        .separator()
        .item(&reveal)
        .separator()
        .items(&[&export_html, &print_pdf])
        .build()?;

    #[cfg(not(target_os = "macos"))]
    let file_menu = SubmenuBuilder::new(app, "文件")
        .items(&[&open, &open_workspace, &save, &close])
        .separator()
        .item(&reveal)
        .separator()
        .items(&[&export_html, &print_pdf])
        .separator()
        .quit()
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .copy()
        .select_all()
        .separator()
        .items(&[&copy_text, &copy_rich, &copy_html, &copy_path])
        .build()?;

    #[cfg(target_os = "macos")]
    let view_menu = SubmenuBuilder::new(app, "查看")
        .items(&[&command_palette, &search, &workspace_search, &sidebar, &theme])
        .build()?;

    #[cfg(not(target_os = "macos"))]
    let view_menu = SubmenuBuilder::new(app, "查看")
        .items(&[&command_palette, &search, &workspace_search, &sidebar, &theme])
        .separator()
        .item(&settings)
        .build()?;

    let navigation_menu = SubmenuBuilder::new(app, "标签页")
        .items(&[&next_tab, &previous_tab])
        .build()?;

    let plugins_menu = SubmenuBuilder::new(app, "插件")
        .item(&plugin_center)
        .build()?;

    #[cfg(target_os = "macos")]
    let help_menu = SubmenuBuilder::new(app, "帮助")
        .items(&[&check_updates, &diagnostics])
        .build()?;

    #[cfg(not(target_os = "macos"))]
    let help_menu = SubmenuBuilder::new(app, "帮助")
        .items(&[&check_updates, &diagnostics])
        .separator()
        .item(&about)
        .build()?;

    #[cfg(target_os = "macos")]
    let menu = MenuBuilder::new(app)
        .items(&[
            &application_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &navigation_menu,
            &plugins_menu,
            &help_menu,
        ])
        .build()?;

    #[cfg(not(target_os = "macos"))]
    let menu = MenuBuilder::new(app)
        .items(&[&file_menu, &edit_menu, &view_menu, &navigation_menu, &plugins_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if id == "app.quit" {
            // Enter the native ExitRequested lifecycle. The frontend close guard will be asked by
            // ExitCoordinator instead of handling Quit as an ordinary command event.
            app.exit(0);
        } else if id.contains('.') {
            let _ = app.emit(MENU_COMMAND_EVENT, id.to_string());
        }
    });

    Ok(())
}

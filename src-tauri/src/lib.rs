mod app_menu;
mod application;
mod commands;
mod crash_log;
mod default_apps;
mod encoding;
mod export;
mod exit_lifecycle;
mod editor_assets;
mod release;
mod plugins;
mod resources;
mod session;
mod settings_state;
mod startup;
mod updates;
mod workspace_state;
mod workspace;

use crash_log::CrashLogStore;
use exit_lifecycle::ExitCoordinator;
use plugins::PluginService;
use session::DocumentSessionService;
use settings_state::SettingsStateStore;
use startup::{resolve_document_paths, resolve_system_actions, StartupFileQueue, StartupSystemActionQueue};
use std::path::PathBuf;
use workspace_state::WorkspaceStateStore;
use workspace::WorkspaceIndexCache;
use tauri::{Emitter, Manager};

const OPEN_FILES_EVENT: &str = "app://open-files";
const SYSTEM_ACTIONS_EVENT: &str = "app://system-actions";

fn enqueue_open_files(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if let Some(queue) = app.try_state::<StartupFileQueue>() {
        queue.push_many(paths.clone());
    }
    let _ = app.emit(OPEN_FILES_EVENT, paths);
}

fn enqueue_system_actions(app: &tauri::AppHandle, actions: Vec<startup::StartupSystemAction>) {
    if actions.is_empty() {
        return;
    }
    if let Some(queue) = app.try_state::<StartupSystemActionQueue>() {
        queue.push_many(actions.clone());
    }
    let _ = app.emit(SYSTEM_ACTIONS_EVENT, actions);
}

fn present_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Startup open queues must exist before setup/webview initialization. On macOS a
    // RunEvent::Opened can be delivered while the application is still bootstrapping;
    // keeping the queue on Builder makes cold-start file opens durable until the
    // frontend explicitly drains them after workspace restoration.
    let mut builder = tauri::Builder::default()
        .manage(StartupFileQueue::from_process_args())
        .manage(StartupSystemActionQueue::from_process_args());

    // 官方建议 single-instance 尽量最先注册，避免后续插件先处理第二实例。
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let cwd = PathBuf::from(cwd);
            let paths = resolve_document_paths(args.clone(), &cwd);
            let actions = resolve_system_actions(args, &cwd);
            if paths.is_empty() && actions.is_empty() {
                return;
            }

            enqueue_open_files(app, paths);
            enqueue_system_actions(app, actions);
            present_main_window(app);
        }));
    }

    let app = builder
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .with_filter(|label| label == "main")
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(DocumentSessionService::new(app.handle().clone())?);
            app.manage(WorkspaceStateStore::new(app.handle())?);
            app.manage(WorkspaceIndexCache::default());
            app.manage(ExitCoordinator::default());
            app.manage(SettingsStateStore::new(app.handle())?);
            app.manage(PluginService::new(app.handle()).map_err(std::io::Error::other)?);
            let crash_log = CrashLogStore::new(app.handle())?;
            crash_log.install_panic_hook();
            app.manage(crash_log);
            app.manage(updates::PendingUpdate::default());
            #[cfg(desktop)]
            app_menu::install(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_document,
            commands::analyze_markdown,
            commands::save_document,
            commands::close_document,
            commands::set_exit_guard_ready,
            commands::request_app_exit,
            commands::confirm_app_exit,
            commands::cancel_app_exit,
            commands::take_startup_files,
            commands::take_startup_actions,
            commands::resolve_document_resources,
            commands::import_editor_image_path,
            commands::import_editor_image_bytes,
            commands::load_workspace,
            commands::save_workspace,
            commands::open_workspace,
            commands::search_workspace,
            commands::load_settings,
            commands::save_settings,
            commands::write_export_file,
            commands::get_build_info,
            commands::set_main_window_title,
            commands::load_crash_log,
            commands::clear_crash_log,
            commands::get_default_app_status,
            commands::request_default_app,
            commands::list_plugins,
            commands::install_plugin,
            commands::link_development_plugin,
            commands::uninstall_plugin,
            commands::set_plugin_enabled,
            commands::begin_plugin_startup_session,
            commands::mark_plugin_startup_plugin,
            commands::complete_plugin_startup_session,
            commands::set_plugin_safe_mode,
            commands::set_plugin_shortcut_override,
            commands::clear_plugin_shortcut_override,
            commands::read_plugin_bundle,
            commands::plugin_storage_get,
            commands::plugin_storage_set,
            commands::plugin_storage_delete,
            updates::check_for_update,
            updates::install_update
        ])
        .build(tauri::generate_context!())
        .expect("failed to build oneView");

    app.run(|app, event| {
        match event {
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                if let Some(coordinator) = app.try_state::<ExitCoordinator>() {
                    coordinator.handle_window_close_requested(app, &api);
                }
            }
            tauri::RunEvent::ExitRequested { api, .. } => {
                if let Some(coordinator) = app.try_state::<ExitCoordinator>() {
                    coordinator.handle_exit_requested(app, &api);
                }
            }
            tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::Destroyed, .. }
                if label == "main" =>
            {
                if let Some(coordinator) = app.try_state::<ExitCoordinator>() {
                    coordinator.main_window_destroyed(app);
                }
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().into_owned())
                    .collect::<Vec<_>>();

                enqueue_open_files(app, paths);
                present_main_window(app);
            }
            _ => {}
        }
    });
}

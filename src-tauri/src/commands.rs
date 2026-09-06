use crate::{
    resources::{resolve_document_resources as resolve_resources, ResourceRequest, ResourceResolution},
    editor_assets::{self, ImportedAsset},
    release::{self, BuildInfo},
    export,
    default_apps::{self, DefaultAppActionResult, DefaultAppStatus},
    crash_log::CrashLogStore,
    exit_lifecycle::ExitCoordinator,
    session::DocumentSessionService,
    settings_state::{SettingsStateStore, UserSettings},
    startup::{StartupFileQueue, StartupSystemAction, StartupSystemActionQueue},
    workspace_state::{WorkspaceSnapshot, WorkspaceStateStore},
    workspace::{WorkspaceFormatSpec, WorkspaceIndexCache, WorkspaceProject, WorkspaceSearchResponse},
    plugins::{
        ipc::{
            ClearPluginShortcutOverrideRequest, InstallPluginRequest, LinkDevelopmentPluginRequest,
            MarkPluginStartupPluginRequest, PluginStorageDeleteRequest, PluginStorageGetRequest,
            PluginStorageSetRequest, ReadPluginBundleRequest, SetPluginEnabledRequest,
            SetPluginSafeModeRequest, SetPluginShortcutOverrideRequest, UninstallPluginRequest,
        },
        InstalledPlugin, PluginBundle, PluginInventory, PluginService, PluginStartupRecoveryState,
    },
};
use app_core::{CompatibilityReport, RenderedDocument};
use markdown_core::analyze_markdown_compatibility;
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn open_document(
    path: String,
    service: State<'_, DocumentSessionService>,
) -> Result<RenderedDocument, String> {
    service.open(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn analyze_markdown(content: String) -> CompatibilityReport {
    analyze_markdown_compatibility(&content)
}

#[tauri::command]
pub fn save_document(
    path: String,
    content: String,
    encoding: String,
    line_ending: String,
    service: State<'_, DocumentSessionService>,
) -> Result<RenderedDocument, String> {
    service.save(&path, &content, &encoding, &line_ending).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn close_document(
    path: String,
    service: State<'_, DocumentSessionService>,
) -> Result<(), String> {
    service.close(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_exit_guard_ready(ready: bool, coordinator: State<'_, ExitCoordinator>) {
    coordinator.set_guard_ready(ready);
}

#[tauri::command]
pub fn request_app_exit(app: AppHandle) {
    // Ask the native application lifecycle to quit. Red-X requests are gated separately at
    // WindowEvent::CloseRequested, while menu/command quit requests enter ExitRequested.
    app.exit(0);
}

#[tauri::command]
pub fn confirm_app_exit(app: AppHandle, coordinator: State<'_, ExitCoordinator>) {
    coordinator.authorize_exit();
    app.exit(0);
}

#[tauri::command]
pub fn cancel_app_exit(coordinator: State<'_, ExitCoordinator>) {
    coordinator.cancel_exit();
}

#[tauri::command]
pub fn take_startup_files(queue: State<'_, StartupFileQueue>) -> Vec<String> {
    queue.take_all()
}

#[tauri::command]
pub fn take_startup_actions(queue: State<'_, StartupSystemActionQueue>) -> Vec<StartupSystemAction> {
    queue.take_all()
}

#[tauri::command]
pub fn resolve_document_resources(
    app: AppHandle,
    document_path: String,
    resources: Vec<ResourceRequest>,
) -> Vec<ResourceResolution> {
    resolve_resources(&app, &document_path, resources)
}


#[tauri::command]
pub fn import_editor_image_path(app: AppHandle, document_path: String, source_path: String) -> Result<ImportedAsset, String> {
    editor_assets::import_image_path(&app, &document_path, &source_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn import_editor_image_bytes(app: AppHandle, document_path: String, file_name: String, bytes: Vec<u8>) -> Result<ImportedAsset, String> {
    editor_assets::import_image_bytes(&app, &document_path, &file_name, bytes).map_err(|error| error.to_string())
}


#[tauri::command]
pub async fn open_workspace(path: String, force_refresh: Option<bool>, formats: Option<Vec<WorkspaceFormatSpec>>, cache: State<'_, WorkspaceIndexCache>) -> Result<WorkspaceProject, String> {
    let cache = cache.inner().clone();
    let force_refresh = force_refresh.unwrap_or(false);
    let formats = formats.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || cache.open_workspace(&path, force_refresh, formats))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn search_workspace(path: String, query: String, limit: Option<usize>, formats: Option<Vec<WorkspaceFormatSpec>>, cache: State<'_, WorkspaceIndexCache>) -> Result<WorkspaceSearchResponse, String> {
    let cache = cache.inner().clone();
    let formats = formats.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || cache.search_workspace(&path, &query, limit, formats))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_workspace(store: State<'_, WorkspaceStateStore>) -> Result<WorkspaceSnapshot, String> {
    store.load().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_workspace(
    snapshot: WorkspaceSnapshot,
    store: State<'_, WorkspaceStateStore>,
) -> Result<(), String> {
    store.save(snapshot).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_settings(store: State<'_, SettingsStateStore>) -> Result<UserSettings, String> {
    store.load().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_settings(
    settings: UserSettings,
    store: State<'_, SettingsStateStore>,
) -> Result<UserSettings, String> {
    store.save(settings).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn write_export_file(path: String, contents: String) -> Result<(), String> {
    export::write_text_file(&path, &contents).map_err(|error| error.to_string())
}


#[tauri::command]
pub fn get_build_info(app: AppHandle) -> BuildInfo {
    release::build_info(&app)
}

#[tauri::command]
pub fn set_main_window_title(app: AppHandle, title: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    window.set_title(&title).map_err(|error| error.to_string())
}


#[tauri::command]
pub fn load_crash_log(store: State<'_, CrashLogStore>) -> Result<Option<String>, String> {
    store.load().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_crash_log(store: State<'_, CrashLogStore>) -> Result<(), String> {
    store.clear().map_err(|error| error.to_string())
}


#[tauri::command]
pub fn get_default_app_status(app: AppHandle) -> Result<DefaultAppStatus, String> {
    default_apps::status(&app)
}

#[tauri::command]
pub fn request_default_app(app: AppHandle, group: String) -> Result<DefaultAppActionResult, String> {
    default_apps::request(&app, &group)
}


#[tauri::command]
pub fn list_plugins(service: State<'_, PluginService>) -> Result<PluginInventory, String> {
    service.list()
}

#[tauri::command]
pub async fn install_plugin(request: InstallPluginRequest, service: State<'_, PluginService>) -> Result<InstalledPlugin, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.install(&request.path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn link_development_plugin(request: LinkDevelopmentPluginRequest, service: State<'_, PluginService>) -> Result<InstalledPlugin, String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.link_development(&request.path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn uninstall_plugin(request: UninstallPluginRequest, service: State<'_, PluginService>) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.uninstall(&request.id, request.remove_data))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn set_plugin_enabled(request: SetPluginEnabledRequest, service: State<'_, PluginService>) -> Result<InstalledPlugin, String> {
    service.set_enabled(&request.id, request.enabled)
}


#[tauri::command]
pub fn begin_plugin_startup_session(service: State<'_, PluginService>) -> Result<PluginStartupRecoveryState, String> {
    service.begin_startup_session()
}

#[tauri::command]
pub fn mark_plugin_startup_plugin(request: MarkPluginStartupPluginRequest, service: State<'_, PluginService>) -> Result<(), String> {
    service.mark_startup_plugin(request.id.as_deref())
}

#[tauri::command]
pub fn complete_plugin_startup_session(service: State<'_, PluginService>) -> Result<(), String> {
    service.complete_startup_session()
}

#[tauri::command]
pub fn set_plugin_safe_mode(request: SetPluginSafeModeRequest, service: State<'_, PluginService>) -> Result<PluginStartupRecoveryState, String> {
    service.set_safe_mode(request.enabled)
}

#[tauri::command]
pub fn set_plugin_shortcut_override(request: SetPluginShortcutOverrideRequest, service: State<'_, PluginService>) -> Result<(), String> {
    service.set_shortcut_override(&request.command_id, request.shortcut.as_deref())
}

#[tauri::command]
pub fn clear_plugin_shortcut_override(request: ClearPluginShortcutOverrideRequest, service: State<'_, PluginService>) -> Result<(), String> {
    service.clear_shortcut_override(&request.command_id)
}

#[tauri::command]
pub fn read_plugin_bundle(request: ReadPluginBundleRequest, service: State<'_, PluginService>) -> Result<PluginBundle, String> {
    service.read_bundle(&request.id)
}

#[tauri::command]
pub fn plugin_storage_get(request: PluginStorageGetRequest, service: State<'_, PluginService>) -> Result<Option<serde_json::Value>, String> {
    service.storage_get(&request.id, &request.key)
}

#[tauri::command]
pub fn plugin_storage_set(request: PluginStorageSetRequest, service: State<'_, PluginService>) -> Result<(), String> {
    service.storage_set(&request.id, &request.key, request.value)
}

#[tauri::command]
pub fn plugin_storage_delete(request: PluginStorageDeleteRequest, service: State<'_, PluginService>) -> Result<(), String> {
    service.storage_delete(&request.id, &request.key)
}

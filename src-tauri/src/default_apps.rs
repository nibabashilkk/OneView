use serde::Serialize;
use tauri::AppHandle;

#[derive(Clone, Copy)]
struct AssociationGroup {
    key: &'static str,
    label: &'static str,
    extensions: &'static [&'static str],
}

#[cfg(target_os = "macos")]
const GROUPS: &[AssociationGroup] = &[
    AssociationGroup { key: "markdown", label: "Markdown", extensions: &["md", "markdown", "mdown", "mkd"] },
    AssociationGroup { key: "json", label: "JSON", extensions: &["json"] },
    AssociationGroup { key: "yaml", label: "YAML", extensions: &["yaml", "yml"] },
    AssociationGroup { key: "toml", label: "TOML", extensions: &["toml"] },
    AssociationGroup { key: "csv", label: "CSV", extensions: &["csv"] },
    AssociationGroup { key: "log", label: "LOG", extensions: &["log"] },
    AssociationGroup { key: "diff", label: "DIFF / PATCH", extensions: &["diff", "patch"] },
];

#[cfg(not(target_os = "macos"))]
const GROUPS: &[AssociationGroup] = &[
    AssociationGroup { key: "markdown", label: "Markdown", extensions: &["md", "markdown", "mdown", "mkd"] },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAppAssociationStatus {
    pub key: String,
    pub label: String,
    pub extensions: Vec<String>,
    pub is_default: Option<bool>,
    pub current_app_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAppStatus {
    pub platform: String,
    pub can_set_directly: bool,
    pub can_open_system_settings: bool,
    pub app_installed: bool,
    pub associations: Vec<DefaultAppAssociationStatus>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAppActionResult {
    pub group: String,
    pub mode: String,
    pub message: String,
}

pub fn status(app: &AppHandle) -> Result<DefaultAppStatus, String> {
    #[cfg(target_os = "macos")]
    {
        return macos::status(app);
    }

    #[cfg(target_os = "windows")]
    {
        return Ok(DefaultAppStatus {
            platform: "windows".into(),
            can_set_directly: false,
            can_open_system_settings: true,
            app_installed: true,
            associations: windows::association_statuses(app),
        });
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
        Ok(DefaultAppStatus {
            platform: std::env::consts::OS.into(),
            can_set_directly: false,
            can_open_system_settings: false,
            app_installed: false,
            associations: unknown_associations(),
        })
    }
}

pub fn request(app: &AppHandle, group_key: &str) -> Result<DefaultAppActionResult, String> {
    let group = find_group(group_key)?;

    #[cfg(target_os = "macos")]
    {
        return macos::request(app, group);
    }

    #[cfg(target_os = "windows")]
    {
        let _ = app;
        windows::open_default_apps_settings()?;
        return Ok(DefaultAppActionResult {
            group: group.key.into(),
            mode: "systemSettings".into(),
            message: "已打开 Windows 默认应用设置，请在系统页面中选择 oneView。".into(),
        });
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = app;
        Err(format!("{} 暂不支持在应用内设置默认打开方式", std::env::consts::OS))
    }
}

fn find_group(key: &str) -> Result<&'static AssociationGroup, String> {
    GROUPS
        .iter()
        .find(|group| group.key == key)
        .ok_or_else(|| format!("未知的文件关联类型: {key}"))
}

fn unknown_associations() -> Vec<DefaultAppAssociationStatus> {
    GROUPS
        .iter()
        .map(|group| DefaultAppAssociationStatus {
            key: group.key.into(),
            label: group.label.into(),
            extensions: group.extensions.iter().map(|ext| format!(".{ext}")).collect(),
            is_default: None,
            current_app_name: None,
        })
        .collect()
}

#[cfg(target_os = "windows")]
mod windows {
    use super::{DefaultAppAssociationStatus, GROUPS};
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt, path::PathBuf, process::Command, ptr};
    use tauri::AppHandle;

    const ASSOCSTR_EXECUTABLE: u32 = 2;
    const ASSOCSTR_FRIENDLYAPPNAME: u32 = 4;

    #[link(name = "shlwapi")]
    extern "system" {
        fn AssocQueryStringW(
            flags: u32,
            str_type: u32,
            assoc: *const u16,
            extra: *const u16,
            output: *mut u16,
            output_len: *mut u32,
        ) -> i32;
    }

    pub fn association_statuses(_app: &AppHandle) -> Vec<DefaultAppAssociationStatus> {
        let current_exe = std::env::current_exe().ok().map(normalize_path);
        GROUPS
            .iter()
            .map(|group| {
                let mut executables = Vec::<PathBuf>::new();
                let mut friendly_names = Vec::<String>::new();
                for extension in group.extensions {
                    let assoc = format!(".{extension}");
                    if let Some(exe) = query_assoc(&assoc, ASSOCSTR_EXECUTABLE) {
                        executables.push(normalize_path(PathBuf::from(exe)));
                    }
                    if let Some(name) = query_assoc(&assoc, ASSOCSTR_FRIENDLYAPPNAME) {
                        if !name.trim().is_empty() { friendly_names.push(name); }
                    }
                }

                let is_default = current_exe.as_ref().and_then(|current| {
                    if executables.is_empty() { return None; }
                    Some(executables.iter().all(|handler| handler == current))
                });
                let current_app_name = if friendly_names.is_empty() {
                    None
                } else if friendly_names.iter().all(|name| name == &friendly_names[0]) {
                    Some(friendly_names[0].clone())
                } else {
                    Some("多种应用".into())
                };

                DefaultAppAssociationStatus {
                    key: group.key.into(),
                    label: group.label.into(),
                    extensions: group.extensions.iter().map(|ext| format!(".{ext}")).collect(),
                    is_default,
                    current_app_name,
                }
            })
            .collect()
    }

    pub fn open_default_apps_settings() -> Result<(), String> {
        // The installer registers oneView under HKCU\\Software\\RegisteredApplications.
        // Windows 11 can therefore deep-link directly to our Default Apps page.
        const URI: &str = "ms-settings:defaultapps?registeredAppUser=oneView";
        Command::new("explorer.exe")
            .arg(URI)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("无法打开 Windows 默认应用设置: {error}"))
    }

    fn query_assoc(extension: &str, kind: u32) -> Option<String> {
        let assoc = OsStr::new(extension).encode_wide().chain(Some(0)).collect::<Vec<_>>();
        let mut len = 0u32;
        unsafe {
            let _ = AssocQueryStringW(0, kind, assoc.as_ptr(), ptr::null(), ptr::null_mut(), &mut len);
        }
        if len <= 1 { return None; }
        let mut buffer = vec![0u16; len as usize];
        let hr = unsafe {
            AssocQueryStringW(0, kind, assoc.as_ptr(), ptr::null(), buffer.as_mut_ptr(), &mut len)
        };
        if hr < 0 || len == 0 { return None; }
        let usable = (len as usize).saturating_sub(1).min(buffer.len());
        Some(String::from_utf16_lossy(&buffer[..usable]))
    }

    fn normalize_path(path: PathBuf) -> PathBuf {
        path.canonicalize().unwrap_or(path)
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::{AssociationGroup, DefaultAppActionResult, DefaultAppAssociationStatus, DefaultAppStatus, GROUPS};
    use objc2_app_kit::NSWorkspace;
    use objc2_foundation::{NSString, NSURL};
    use objc2_uniform_type_identifiers::UTType;
    use std::{collections::HashSet, path::{Path, PathBuf}};
    use tauri::AppHandle;

    const BUNDLE_ID: &str = "com.xiaomogu.markdownviewer";

    pub fn status(app: &AppHandle) -> Result<DefaultAppStatus, String> {
        let workspace = NSWorkspace::sharedWorkspace();
        let installed_app = installed_app_path(app, &workspace);
        let associations = GROUPS
            .iter()
            .map(|group| association_status(group, &workspace, installed_app.as_deref()))
            .collect::<Vec<_>>();

        Ok(DefaultAppStatus {
            platform: "macos".into(),
            can_set_directly: true,
            can_open_system_settings: false,
            app_installed: installed_app.is_some(),
            associations,
        })
    }

    pub fn request(app: &AppHandle, group: &AssociationGroup) -> Result<DefaultAppActionResult, String> {
        let workspace = NSWorkspace::sharedWorkspace();
        let app_path = installed_app_path(app, &workspace)
            .ok_or_else(|| "未找到已安装的 oneView.app。请先把应用拖到“应用程序”后再设置默认打开方式。".to_string())?;
        let app_url = NSURL::from_directory_path(&app_path)
            .ok_or_else(|| format!("无法创建应用 URL: {}", app_path.display()))?;

        let mut handled_types = HashSet::new();
        let mut requested = 0usize;
        for extension in group.extensions {
            let extension = NSString::from_str(extension);
            let Some(content_type) = UTType::typeWithFilenameExtension(&extension) else { continue; };
            let identifier = content_type.identifier().to_string();
            if !handled_types.insert(identifier) { continue; }
            workspace.setDefaultApplicationAtURL_toOpenContentType_completionHandler(
                &app_url,
                &content_type,
                None,
            );
            requested += 1;
        }

        if requested == 0 {
            return Err(format!("macOS 无法识别 {} 对应的文件类型", group.label));
        }

        Ok(DefaultAppActionResult {
            group: group.key.into(),
            mode: "direct".into(),
            message: "已向 macOS 请求更改默认应用；如果系统弹出确认，请选择允许。".into(),
        })
    }

    fn association_status(
        group: &AssociationGroup,
        workspace: &NSWorkspace,
        installed_app: Option<&Path>,
    ) -> DefaultAppAssociationStatus {
        let mut handlers = Vec::<PathBuf>::new();
        let mut handled_types = HashSet::new();

        for extension in group.extensions {
            let extension = NSString::from_str(extension);
            let Some(content_type) = UTType::typeWithFilenameExtension(&extension) else { continue; };
            let identifier = content_type.identifier().to_string();
            if !handled_types.insert(identifier) { continue; }
            if let Some(url) = workspace.URLForApplicationToOpenContentType(&content_type) {
                if let Some(path) = url.to_file_path() {
                    handlers.push(normalize_path(path));
                }
            }
        }

        let installed_app = installed_app.map(|path| normalize_path(path.to_path_buf()));
        let is_default = installed_app.as_ref().and_then(|app_path| {
            if handlers.is_empty() { return None; }
            Some(handlers.iter().all(|handler| handler == app_path))
        });

        let current_app_name = if handlers.is_empty() {
            None
        } else {
            let first = &handlers[0];
            if handlers.iter().all(|handler| handler == first) {
                app_name(first)
            } else {
                Some("多种应用".into())
            }
        };

        DefaultAppAssociationStatus {
            key: group.key.into(),
            label: group.label.into(),
            extensions: group.extensions.iter().map(|ext| format!(".{ext}")).collect(),
            is_default,
            current_app_name,
        }
    }

    fn installed_app_path(_app: &AppHandle, workspace: &NSWorkspace) -> Option<PathBuf> {
        let identifier = NSString::from_str(BUNDLE_ID);
        if let Some(url) = workspace.URLForApplicationWithBundleIdentifier(&identifier) {
            if let Some(path) = url.to_file_path() {
                return Some(normalize_path(path));
            }
        }

        let executable = std::env::current_exe().ok()?;
        executable
            .ancestors()
            .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("app"))
            .map(|path| normalize_path(path.to_path_buf()))
    }

    fn normalize_path(path: PathBuf) -> PathBuf {
        path.canonicalize().unwrap_or(path)
    }

    fn app_name(path: &Path) -> Option<String> {
        path.file_stem().map(|name| name.to_string_lossy().into_owned())
    }
}

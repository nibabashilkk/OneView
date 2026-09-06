use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};


#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StartupSystemAction {
    pub path: String,
    pub action: String,
}

#[derive(Default)]
pub struct StartupSystemActionQueue {
    actions: Mutex<Vec<StartupSystemAction>>,
}

impl StartupSystemActionQueue {
    pub fn from_process_args() -> Self {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let args = std::env::args().skip(1).collect::<Vec<_>>();
        Self::from_args(args, &cwd)
    }

    pub fn from_args(args: Vec<String>, cwd: &Path) -> Self {
        Self {
            actions: Mutex::new(resolve_system_actions(args, cwd)),
        }
    }

    pub fn push_many(&self, actions: impl IntoIterator<Item = StartupSystemAction>) {
        let mut queue = self.actions.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        for action in actions {
            if !queue.iter().any(|current| {
                current.action == action.action && paths_equal(&current.path, &action.path)
            }) {
                queue.push(action);
            }
        }
    }

    pub fn take_all(&self) -> Vec<StartupSystemAction> {
        let mut queue = self.actions.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        std::mem::take(&mut *queue)
    }
}

#[derive(Default)]
pub struct StartupFileQueue {
    paths: Mutex<Vec<String>>,
}

impl StartupFileQueue {
    pub fn from_process_args() -> Self {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let args = std::env::args().skip(1).collect::<Vec<_>>();
        Self::from_args(args, &cwd)
    }

    pub fn from_args(args: Vec<String>, cwd: &Path) -> Self {
        Self {
            paths: Mutex::new(resolve_document_paths(args, cwd)),
        }
    }

    pub fn push_many(&self, paths: impl IntoIterator<Item = String>) {
        let mut queue = self.paths.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        for path in paths {
            if !queue.iter().any(|current| paths_equal(current, &path)) {
                queue.push(path);
            }
        }
    }

    pub fn take_all(&self) -> Vec<String> {
        let mut queue = self.paths.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        std::mem::take(&mut *queue)
    }
}

pub fn resolve_system_actions(args: Vec<String>, cwd: &Path) -> Vec<StartupSystemAction> {
    let mut action: Option<&str> = None;
    let mut resolved = Vec::new();

    for arg in args {
        match arg.as_str() {
            "--read" => { action = Some("read"); continue; }
            "--edit" => { action = Some("edit"); continue; }
            "--source" => { action = Some("source"); continue; }
            "--print" => { action = Some("print"); continue; }
            "--export-html" => { action = Some("exportHtml"); continue; }
            "--copy-rich" => { action = Some("copyRich"); continue; }
            _ => {}
        }

        let Some(current_action) = action else { continue; };
        let path = PathBuf::from(&arg);
        let path = if path.is_absolute() { path } else { cwd.join(path) };
        if !is_markdown_path(&path) || !path.is_file() { continue; }

        let path = path.canonicalize().unwrap_or(path);
        let value = path.to_string_lossy().into_owned();
        if !resolved.iter().any(|current: &StartupSystemAction| {
            current.action == current_action && paths_equal(&current.path, &value)
        }) {
            resolved.push(StartupSystemAction {
                path: value,
                action: current_action.to_string(),
            });
        }
    }

    resolved
}

pub fn resolve_document_paths(args: Vec<String>, cwd: &Path) -> Vec<String> {
    let mut resolved: Vec<String> = Vec::new();

    for arg in args {
        let path = PathBuf::from(&arg);
        let path = if path.is_absolute() { path } else { cwd.join(path) };

        // Startup happens before the frontend plugin registry is available. Queue every existing
        // regular file and let the initialized frontend format router decide whether Core, a
        // plugin, or no viewer supports it. This keeps future plugin extensions open-ended.
        if !path.is_file() { continue; }

        let path = path.canonicalize().unwrap_or(path);
        let value = path.to_string_lossy().into_owned();
        if !resolved.iter().any(|current| paths_equal(current, &value)) {
            resolved.push(value);
        }
    }

    resolved
}

pub fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("md" | "markdown" | "mdown" | "mkd")
    )
}

fn paths_equal(left: &str, right: &str) -> bool {
    #[cfg(windows)]
    {
        left.eq_ignore_ascii_case(right)
    }

    #[cfg(not(windows))]
    {
        left == right
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_shell_actions_without_treating_flags_as_files() {
        let dir = std::env::temp_dir().join("markdown-viewer-startup-actions");
        let _ = std::fs::create_dir_all(&dir);
        let file = dir.join("README.md");
        std::fs::write(&file, "# test").unwrap();
        let actions = resolve_system_actions(
            vec!["--edit".into(), file.to_string_lossy().into_owned()],
            &dir,
        );
        assert_eq!(actions.len(), 1);
        assert_eq!(actions[0].action, "edit");
        assert!(actions[0].path.ends_with("README.md"));
        let _ = std::fs::remove_file(file);
        let _ = std::fs::remove_dir(dir);
    }

    #[test]
    fn markdown_actions_remain_core_only() {
        assert!(is_markdown_path(Path::new("README.md")));
        assert!(is_markdown_path(Path::new("README.MARKDOWN")));
        assert!(!is_markdown_path(Path::new("data.json")));
    }

    #[test]
    fn startup_file_queue_is_extension_agnostic_for_plugins() {
        let dir = std::env::temp_dir().join("markdown-viewer-plugin-startup");
        let _ = std::fs::create_dir_all(&dir);
        let file = dir.join("custom.futurefmt");
        std::fs::write(&file, "plugin document").unwrap();
        let paths = resolve_document_paths(vec![file.to_string_lossy().into_owned()], &dir);
        assert_eq!(paths.len(), 1);
        let _ = std::fs::remove_file(file);
        let _ = std::fs::remove_dir(dir);
    }
}

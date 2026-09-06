use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
use thiserror::Error;

const WORKSPACE_FILE: &str = "workspace-v1.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTabSnapshot {
    pub path: String,
    #[serde(default)]
    pub scroll_top: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFileSnapshot {
    pub path: String,
    pub file_name: String,
    #[serde(default)]
    pub last_opened_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectSnapshot {
    pub path: String,
    pub name: String,
    #[serde(default)]
    pub last_opened_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    #[serde(default = "workspace_version")]
    pub version: u8,
    #[serde(default)]
    pub open_tabs: Vec<WorkspaceTabSnapshot>,
    #[serde(default)]
    pub active_path: Option<String>,
    #[serde(default = "default_sidebar_open")]
    pub sidebar_open: bool,
    #[serde(default)]
    pub recent_files: Vec<RecentFileSnapshot>,
    #[serde(default)]
    pub project_root: Option<String>,
    #[serde(default)]
    pub recent_projects: Vec<RecentProjectSnapshot>,
}

impl Default for WorkspaceSnapshot {
    fn default() -> Self {
        Self {
            version: workspace_version(),
            open_tabs: Vec::new(),
            active_path: None,
            sidebar_open: true,
            recent_files: Vec::new(),
            project_root: None,
            recent_projects: Vec::new(),
        }
    }
}

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("无法确定应用数据目录: {0}")]
    AppData(String),
    #[error("读取工作区失败: {0}")]
    Read(String),
    #[error("保存工作区失败: {0}")]
    Write(String),
}

pub struct WorkspaceStateStore {
    path: PathBuf,
    io_lock: Mutex<()>,
}

impl WorkspaceStateStore {
    pub fn new(app: &AppHandle) -> Result<Self, WorkspaceError> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|error| WorkspaceError::AppData(error.to_string()))?;
        Ok(Self {
            path: dir.join(WORKSPACE_FILE),
            io_lock: Mutex::new(()),
        })
    }

    pub fn load(&self) -> Result<WorkspaceSnapshot, WorkspaceError> {
        let _guard = self
            .io_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !self.path.is_file() {
            return Ok(WorkspaceSnapshot::default());
        }

        let bytes = fs::read(&self.path).map_err(|error| WorkspaceError::Read(error.to_string()))?;
        serde_json::from_slice(&bytes).map_err(|error| WorkspaceError::Read(error.to_string()))
    }

    pub fn save(&self, snapshot: WorkspaceSnapshot) -> Result<(), WorkspaceError> {
        let _guard = self
            .io_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| WorkspaceError::Write(error.to_string()))?;
        }
        let bytes = serde_json::to_vec_pretty(&snapshot)
            .map_err(|error| WorkspaceError::Write(error.to_string()))?;
        fs::write(&self.path, bytes).map_err(|error| WorkspaceError::Write(error.to_string()))
    }
}

fn workspace_version() -> u8 {
    2
}

fn default_sidebar_open() -> bool {
    true
}

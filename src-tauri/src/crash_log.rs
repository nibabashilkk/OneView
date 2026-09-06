use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use thiserror::Error;

const CRASH_FILE: &str = "last-crash.txt";

#[derive(Debug, Error)]
pub enum CrashLogError {
    #[error("无法确定应用数据目录: {0}")]
    AppData(String),
    #[error("读取崩溃日志失败: {0}")]
    Read(String),
    #[error("清理崩溃日志失败: {0}")]
    Clear(String),
}

#[derive(Clone)]
pub struct CrashLogStore {
    path: PathBuf,
}

impl CrashLogStore {
    pub fn new(app: &AppHandle) -> Result<Self, CrashLogError> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|error| CrashLogError::AppData(error.to_string()))?;
        Ok(Self { path: dir.join(CRASH_FILE) })
    }

    pub fn install_panic_hook(&self) {
        let path = self.path.clone();
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let thread = std::thread::current();
            let thread_name = thread.name().unwrap_or("unnamed");
            let payload = if let Some(message) = info.payload().downcast_ref::<&str>() {
                (*message).to_string()
            } else if let Some(message) = info.payload().downcast_ref::<String>() {
                message.clone()
            } else {
                "non-string panic payload".to_string()
            };
            let location = info
                .location()
                .map(|location| format!("{}:{}:{}", location.file(), location.line(), location.column()))
                .unwrap_or_else(|| "unknown".to_string());
            let contents = format!(
                "panic\nthread: {thread_name}\nlocation: {location}\nmessage: {payload}\n"
            );
            let _ = fs::write(&path, contents);
            previous(info);
        }));
    }

    pub fn load(&self) -> Result<Option<String>, CrashLogError> {
        if !self.path.is_file() {
            return Ok(None);
        }
        fs::read_to_string(&self.path)
            .map(Some)
            .map_err(|error| CrashLogError::Read(error.to_string()))
    }

    pub fn clear(&self) -> Result<(), CrashLogError> {
        if self.path.is_file() {
            fs::remove_file(&self.path).map_err(|error| CrashLogError::Clear(error.to_string()))?;
        }
        Ok(())
    }
}

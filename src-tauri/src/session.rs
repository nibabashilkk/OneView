use crate::application::{DocumentError, DocumentService};
use app_core::RenderedDocument;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter};
use thiserror::Error;

pub const DOCUMENT_CHANGED_EVENT: &str = "document://changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentFileEvent {
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Error)]
pub enum SessionError {
    #[error(transparent)]
    Document(#[from] DocumentError),
    #[error("文件监听失败: {0}")]
    Watch(String),
}

pub struct DocumentSessionService {
    documents: DocumentService,
    watcher: Mutex<RecommendedWatcher>,
    watched_files: Arc<Mutex<HashMap<String, PathBuf>>>,
    watched_directories: Mutex<HashMap<String, (PathBuf, usize)>>,
}

impl DocumentSessionService {
    pub fn new(app: AppHandle) -> Result<Self, SessionError> {
        let watched_files = Arc::new(Mutex::new(HashMap::<String, PathBuf>::new()));
        let callback_files = watched_files.clone();
        let callback_app = app.clone();

        let watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let Ok(event) = result else {
                return;
            };
            if !is_relevant_event(&event.kind) {
                return;
            }

            let tracked = callback_files
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());

            for event_path in event.paths {
                let key = path_key(&event_path);
                if let Some(target) = tracked.get(&key) {
                    let payload = DocumentFileEvent {
                        path: target.to_string_lossy().into_owned(),
                        kind: event_kind_name(&event.kind).to_string(),
                    };
                    let _ = callback_app.emit(DOCUMENT_CHANGED_EVENT, payload);
                }
            }
        })
        .map_err(|error| SessionError::Watch(error.to_string()))?;

        Ok(Self {
            documents: DocumentService::default(),
            watcher: Mutex::new(watcher),
            watched_files,
            watched_directories: Mutex::new(HashMap::new()),
        })
    }

    pub fn open(&self, path: &str) -> Result<RenderedDocument, SessionError> {
        let document = self.documents.open(path)?;
        self.watch(&document.path)?;
        Ok(document)
    }

    pub fn save(&self, path: &str, content: &str, encoding: &str, line_ending: &str) -> Result<RenderedDocument, SessionError> {
        let document = self.documents.save(path, content, encoding, line_ending)?;
        self.watch(&document.path)?;
        Ok(document)
    }

    pub fn close(&self, path: &str) -> Result<(), SessionError> {
        self.unwatch(path)
    }

    fn watch(&self, raw_path: &str) -> Result<(), SessionError> {
        let path = normalize_path(Path::new(raw_path));
        let file_key = path_key(&path);

        {
            let files = self
                .watched_files
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if files.contains_key(&file_key) {
                return Ok(());
            }
        }

        let parent = path
            .parent()
            .map(normalize_path)
            .ok_or_else(|| SessionError::Watch("无法确定文件所在目录".to_string()))?;
        let directory_key = path_key(&parent);

        let mut directories = self
            .watched_directories
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if let Some((_, ref_count)) = directories.get_mut(&directory_key) {
            *ref_count += 1;
        } else {
            self.watcher
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .watch(&parent, RecursiveMode::NonRecursive)
                .map_err(|error| SessionError::Watch(error.to_string()))?;
            directories.insert(directory_key, (parent, 1));
        }

        self.watched_files
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(file_key, path);

        Ok(())
    }

    fn unwatch(&self, raw_path: &str) -> Result<(), SessionError> {
        let path = normalize_path(Path::new(raw_path));
        let file_key = path_key(&path);

        let removed = self
            .watched_files
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&file_key);

        let Some(removed_path) = removed else {
            return Ok(());
        };

        let Some(parent) = removed_path.parent().map(normalize_path) else {
            return Ok(());
        };
        let directory_key = path_key(&parent);

        let mut directories = self
            .watched_directories
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if let Some((directory, ref_count)) = directories.get_mut(&directory_key) {
            if *ref_count > 1 {
                *ref_count -= 1;
                return Ok(());
            }

            let directory = directory.clone();
            directories.remove(&directory_key);
            let _ = self
                .watcher
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .unwatch(&directory);
        }

        Ok(())
    }
}

fn normalize_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| {
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(path)
        }
    })
}

fn path_key(path: &Path) -> String {
    let value = normalize_path(path).to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    {
        value.to_ascii_lowercase()
    }
    #[cfg(not(windows))]
    {
        value
    }
}

fn is_relevant_event(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Any | EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
    )
}

fn event_kind_name(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "created",
        EventKind::Modify(_) => "modified",
        EventKind::Remove(_) => "removed",
        _ => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_separators_for_keys() {
        let key = path_key(Path::new("./README.md"));
        assert!(key.ends_with("README.md") || key.ends_with("readme.md"));
    }
}

use std::sync::Mutex;

use serde::Serialize;
use tauri::{ipc::Channel, AppHandle, State, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::release::update_config;

#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    #[error("当前构建未配置更新源；发布版需设置 MDV_UPDATE_ENDPOINT 和 MDV_UPDATE_PUBKEY")]
    NotConfigured,
    #[error("没有待安装的更新，请先检查更新")]
    NoPendingUpdate,
    #[error("更新地址无效: {0}")]
    InvalidEndpoint(String),
    #[error(transparent)]
    Updater(#[from] tauri_plugin_updater::Error),
}

impl Serialize for UpdateError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type Result<T> = std::result::Result<T, UpdateError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    pub version: String,
    pub current_version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started { content_length: Option<u64> },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Finished,
}

pub struct PendingUpdate(pub Mutex<Option<Update>>);

impl Default for PendingUpdate {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[tauri::command]
pub async fn check_for_update(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<Option<UpdateMetadata>> {
    let (endpoint, pubkey) = update_config().ok_or(UpdateError::NotConfigured)?;
    let endpoint = Url::parse(endpoint)
        .map_err(|error| UpdateError::InvalidEndpoint(error.to_string()))?;
    let update = app
        .updater_builder()
        .endpoints(vec![endpoint])?
        .pubkey(pubkey)
        .build()?
        .check()
        .await?;

    let metadata = update.as_ref().map(|update| UpdateMetadata {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        date: update.date.as_ref().map(ToString::to_string),
        body: update.body.clone(),
    });

    *pending_update
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = update;

    Ok(metadata)
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
    on_event: Channel<DownloadEvent>,
) -> Result<()> {
    let update = pending_update
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .take()
        .ok_or(UpdateError::NoPendingUpdate)?;

    let mut started = false;
    update
        .download_and_install(
            |chunk_length, content_length| {
                if !started {
                    let _ = on_event.send(DownloadEvent::Started { content_length });
                    started = true;
                }
                let _ = on_event.send(DownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(DownloadEvent::Finished);
            },
        )
        .await?;

    #[cfg(target_os = "windows")]
    {
        let _ = app;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        app.restart()
    }
}

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};
use thiserror::Error;

const SETTINGS_FILE: &str = "settings-v1.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(default = "settings_version")]
    pub version: u8,
    #[serde(default = "default_app_theme")]
    pub app_theme: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default = "default_content_width")]
    pub content_width: u16,
    #[serde(default = "default_code_font_size")]
    pub code_font_size: f64,
    #[serde(default = "default_auto_check_updates")]
    pub auto_check_updates: bool,
    #[serde(default = "default_auto_save")]
    pub auto_save: bool,
    #[serde(default)]
    pub default_app_prompt_dismissed_until_ms: u64,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            version: settings_version(),
            app_theme: default_app_theme(),
            font_family: default_font_family(),
            font_size: default_font_size(),
            line_height: default_line_height(),
            content_width: default_content_width(),
            code_font_size: default_code_font_size(),
            auto_check_updates: default_auto_check_updates(),
            auto_save: default_auto_save(),
            default_app_prompt_dismissed_until_ms: 0,
        }
    }
}

impl UserSettings {
    pub fn normalized(mut self) -> Self {
        self.version = settings_version();
        if !matches!(self.app_theme.as_str(), "light" | "dark" | "system") {
            self.app_theme = default_app_theme();
        }
        if !matches!(self.font_family.as_str(), "system" | "serif" | "mono") {
            self.font_family = default_font_family();
        }
        self.font_size = self.font_size.clamp(12.0, 24.0);
        self.line_height = self.line_height.clamp(1.35, 2.2);
        self.content_width = self.content_width.clamp(560, 1240);
        self.code_font_size = self.code_font_size.clamp(11.0, 18.0);
        self
    }
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("无法确定应用数据目录: {0}")]
    AppData(String),
    #[error("读取设置失败: {0}")]
    Read(String),
    #[error("保存设置失败: {0}")]
    Write(String),
}

pub struct SettingsStateStore {
    path: PathBuf,
    io_lock: Mutex<()>,
}

impl SettingsStateStore {
    pub fn new(app: &AppHandle) -> Result<Self, SettingsError> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|error| SettingsError::AppData(error.to_string()))?;
        Ok(Self {
            path: dir.join(SETTINGS_FILE),
            io_lock: Mutex::new(()),
        })
    }

    pub fn load(&self) -> Result<UserSettings, SettingsError> {
        let _guard = self
            .io_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !self.path.is_file() {
            return Ok(UserSettings::default());
        }
        let bytes = fs::read(&self.path).map_err(|error| SettingsError::Read(error.to_string()))?;
        let settings = serde_json::from_slice::<UserSettings>(&bytes)
            .map_err(|error| SettingsError::Read(error.to_string()))?;
        Ok(settings.normalized())
    }

    pub fn save(&self, settings: UserSettings) -> Result<UserSettings, SettingsError> {
        let _guard = self
            .io_lock
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let settings = settings.normalized();
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| SettingsError::Write(error.to_string()))?;
        }
        let bytes = serde_json::to_vec_pretty(&settings)
            .map_err(|error| SettingsError::Write(error.to_string()))?;
        fs::write(&self.path, bytes).map_err(|error| SettingsError::Write(error.to_string()))?;
        Ok(settings)
    }
}

fn settings_version() -> u8 { 5 }
fn default_app_theme() -> String { "system".into() }
fn default_font_family() -> String { "system".into() }
fn default_font_size() -> f64 { 15.0 }
fn default_line_height() -> f64 { 1.75 }
fn default_content_width() -> u16 { 860 }
fn default_code_font_size() -> f64 { 13.0 }

fn default_auto_check_updates() -> bool { true }
fn default_auto_save() -> bool { true }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_reader_theme_is_ignored_when_loading_v5_settings() {
        let raw = r#"{
          "version": 4,
          "appTheme": "dark",
          "readerTheme": "sepia",
          "fontFamily": "serif",
          "fontSize": 18,
          "lineHeight": 1.9,
          "contentWidth": 940,
          "codeFontSize": 14,
          "autoCheckUpdates": false,
          "autoSave": true,
          "defaultAppPromptDismissedUntilMs": 123
        }"#;
        let settings = serde_json::from_str::<UserSettings>(raw).unwrap().normalized();
        assert_eq!(settings.version, 5);
        assert_eq!(settings.app_theme, "dark");
        assert_eq!(settings.font_family, "serif");
        assert_eq!(settings.font_size, 18.0);
        assert_eq!(settings.line_height, 1.9);
        assert_eq!(settings.content_width, 940);
        assert_eq!(settings.code_font_size, 14.0);
        assert!(!settings.auto_check_updates);
        assert!(settings.auto_save);
        assert_eq!(settings.default_app_prompt_dismissed_until_ms, 123);

        let saved = serde_json::to_value(settings).unwrap();
        assert!(saved.get("readerTheme").is_none());
    }
}

use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::Path};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRegistryFile {
    #[serde(default = "registry_version")]
    pub version: u8,
    #[serde(default)]
    pub enabled: BTreeMap<String, bool>,
    #[serde(default)]
    pub development: BTreeMap<String, String>,
    /// Permissions the user approved the last time the plugin was explicitly enabled.
    /// Keeping grants separate from the requested manifest permissions prevents an update
    /// from silently acquiring additional capabilities while remaining enabled.
    #[serde(default)]
    pub granted_permissions: BTreeMap<String, Vec<String>>,
    /// Host-owned shortcut overrides keyed by stable plugin command id (`plugin.id:local-command`).
    /// `Some(value)` is a custom shortcut, `None` explicitly disables that command shortcut.
    #[serde(default)]
    pub shortcut_overrides: BTreeMap<String, Option<String>>,
    /// Persistent safe-mode switch. It pauses third-party runtimes without mutating the
    /// user's enabled/disabled choices so recovery does not destroy configuration.
    #[serde(default)]
    pub safe_mode: bool,
    /// Crash-recovery guard for the short automatic plugin startup phase. If the process
    /// exits before the host clears this flag, the next launch enters safe mode.
    #[serde(default)]
    pub startup_in_progress: bool,
    /// Best-effort marker for the plugin being started when the guard was last updated.
    #[serde(default)]
    pub startup_plugin_id: Option<String>,
    /// Number of times an incomplete plugin startup was recovered across launches.
    #[serde(default)]
    pub recovery_count: u32,
}

impl PluginRegistryFile {
    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.is_file() {
            return Ok(Self {
                version: registry_version(),
                enabled: BTreeMap::new(),
                development: BTreeMap::new(),
                granted_permissions: BTreeMap::new(),
                shortcut_overrides: BTreeMap::new(),
                safe_mode: false,
                startup_in_progress: false,
                startup_plugin_id: None,
                recovery_count: 0,
            });
        }
        let bytes = fs::read(path).map_err(|error| format!("读取插件注册表失败: {error}"))?;
        let mut registry: Self = serde_json::from_slice(&bytes)
            .map_err(|error| format!("解析插件注册表失败: {error}"))?;
        registry.version = registry_version();
        Ok(registry)
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建插件数据目录失败: {error}"))?;
        }
        let mut normalized = self.clone();
        normalized.version = registry_version();
        let bytes = serde_json::to_vec_pretty(&normalized)
            .map_err(|error| format!("序列化插件注册表失败: {error}"))?;
        let temp = path.with_extension("tmp");
        fs::write(&temp, bytes).map_err(|error| format!("写入插件注册表失败: {error}"))?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| format!("替换插件注册表失败: {error}"))?;
        }
        fs::rename(&temp, path).map_err(|error| format!("替换插件注册表失败: {error}"))
    }
}

fn registry_version() -> u8 { 5 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v5_shortcut_overrides_keep_disabled_state() {
        let raw = br#"{"version":5,"shortcutOverrides":{"com.example.test:run":"Mod+J","com.example.test:other":null}}"#;
        let registry: PluginRegistryFile = serde_json::from_slice(raw).expect("registry should parse");
        assert_eq!(registry.shortcut_overrides.get("com.example.test:run"), Some(&Some("Mod+J".to_string())));
        assert_eq!(registry.shortcut_overrides.get("com.example.test:other"), Some(&None));
    }

    #[test]
    fn v1_registry_deserializes_with_new_fields_empty() {
        let raw = br#"{"version":1,"enabled":{"com.example.test":true}}"#;
        let registry: PluginRegistryFile = serde_json::from_slice(raw).expect("registry should parse");
        assert!(registry.development.is_empty());
        assert!(registry.granted_permissions.is_empty());
        assert!(registry.shortcut_overrides.is_empty());
        assert_eq!(registry.enabled.get("com.example.test"), Some(&true));
        assert!(!registry.safe_mode);
        assert!(!registry.startup_in_progress);
        assert!(registry.startup_plugin_id.is_none());
        assert_eq!(registry.recovery_count, 0);
    }
}

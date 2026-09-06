use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallPluginRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkDevelopmentPluginRequest {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UninstallPluginRequest {
    pub id: String,
    pub remove_data: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetPluginEnabledRequest {
    pub id: String,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MarkPluginStartupPluginRequest {
    pub id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetPluginSafeModeRequest {
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetPluginShortcutOverrideRequest {
    pub command_id: String,
    pub shortcut: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClearPluginShortcutOverrideRequest {
    pub command_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadPluginBundleRequest {
    pub id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginStorageGetRequest {
    pub id: String,
    pub key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginStorageSetRequest {
    pub id: String,
    pub key: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginStorageDeleteRequest {
    pub id: String,
    pub key: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn uninstall_request_accepts_camel_case_boolean() {
        let request: UninstallPluginRequest = serde_json::from_value(json!({
            "id": "official.developer-pack",
            "removeData": true
        }))
        .expect("valid uninstall request");

        assert_eq!(request.id, "official.developer-pack");
        assert!(request.remove_data);
    }

    #[test]
    fn uninstall_request_rejects_non_boolean_remove_data() {
        let error = serde_json::from_value::<UninstallPluginRequest>(json!({
            "id": "official.developer-pack",
            "removeData": { "value": true }
        }))
        .expect_err("removeData must remain a primitive boolean");

        assert!(error.to_string().contains("boolean"));
    }

    #[test]
    fn plugin_request_rejects_unknown_fields() {
        let error = serde_json::from_value::<SetPluginEnabledRequest>(json!({
            "id": "official.developer-pack",
            "enabled": true,
            "extra": "unexpected"
        }))
        .expect_err("unknown fields must be rejected at the IPC boundary");

        assert!(error.to_string().contains("unknown field"));
    }
}

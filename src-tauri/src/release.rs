use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildInfo {
    pub product_name: String,
    pub version: String,
    pub identifier: String,
    pub os: String,
    pub arch: String,
    pub debug: bool,
    pub updater_configured: bool,
}

pub fn build_info(app: &AppHandle) -> BuildInfo {
    BuildInfo {
        product_name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        identifier: app.config().identifier.clone(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        debug: cfg!(debug_assertions),
        updater_configured: update_config().is_some(),
    }
}

pub fn update_config() -> Option<(&'static str, &'static str)> {
    let endpoint = option_env!("MDV_UPDATE_ENDPOINT")?.trim();
    let pubkey = option_env!("MDV_UPDATE_PUBKEY")?.trim();
    if endpoint.is_empty() || pubkey.is_empty() {
        return None;
    }
    Some((endpoint, pubkey))
}

pub mod manifest;
pub mod ipc;
mod registry;
mod service;

pub use service::{InstalledPlugin, PluginBundle, PluginInventory, PluginService, PluginStartupRecoveryState};

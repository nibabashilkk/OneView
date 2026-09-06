use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, path::{Component, Path}};

pub const PLUGIN_API_VERSION: u16 = 1;
pub const THEME_TOKEN_KEYS: &[&str] = &[
    "app.background", "app.surface", "app.surfaceMuted", "app.border", "app.text", "app.textMuted", "app.accent", "app.accentText", "app.hover", "app.shadow",
    "reader.background", "reader.text", "reader.muted", "reader.heading", "reader.link", "reader.border", "reader.soft", "reader.codeBackground", "reader.selection", "reader.blockquote",
    "syntax.comment", "syntax.keyword", "syntax.string", "syntax.number", "syntax.function", "syntax.type", "syntax.variable",
];

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginContributes {
    #[serde(default)]
    pub document_formats: Vec<PluginDocumentFormatManifest>,
    #[serde(default)]
    pub themes: Vec<PluginThemeManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDocumentFormatManifest {
    pub id: String,
    pub label: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeVariant { Light, Dark }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeScope { App, Reader, Syntax }

impl ThemeScope {
    pub fn prefix(self) -> &'static str {
        match self { Self::App => "app.", Self::Reader => "reader.", Self::Syntax => "syntax." }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginThemeManifest {
    pub id: String,
    pub family: String,
    pub label: String,
    pub variant: ThemeVariant,
    pub scope: Vec<ThemeScope>,
    pub path: String,
}

const ALLOWED_PERMISSIONS: &[&str] = &[
    "commands", "workspace.read", "editor.read", "editor.write", "events", "clipboard.write", "storage", "ui.notice", "ui.contribute", "ui.panel", "settings",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginRuntimeKind { Document, Extension }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PluginRuntimeEngine { Worker }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginWorkerRuntimeDescriptor {
    pub kind: PluginRuntimeEngine,
    pub role: PluginRuntimeKind,
    pub main: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum PluginRuntimeConfig {
    Legacy(PluginRuntimeKind),
    Worker(PluginWorkerRuntimeDescriptor),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)] pub description: String,
    #[serde(default)] pub author: String,
    #[serde(default)] pub homepage: Option<String>,
    #[serde(default = "default_api_version")] pub api_version: u16,
    #[serde(default)] pub min_app_version: Option<String>,
    /// Legacy v0.20 entry. v0.21 manifests put main inside runtime descriptor.
    #[serde(default)] pub main: Option<String>,
    #[serde(default)] pub style: Option<String>,
    #[serde(default)] pub icon: Option<String>,
    #[serde(default)] pub runtime: Option<PluginRuntimeConfig>,
    #[serde(default)] pub permissions: Vec<String>,
    #[serde(default)] pub contributes: PluginContributes,
}

impl PluginManifest {
    pub fn worker_runtime(&self) -> Option<(PluginRuntimeKind, &str)> {
        match self.runtime.as_ref() {
            Some(PluginRuntimeConfig::Worker(descriptor)) => Some((descriptor.role, descriptor.main.as_str())),
            Some(PluginRuntimeConfig::Legacy(role)) => self.main.as_deref().map(|main| (*role, main)),
            None => self.main.as_deref().map(|main| {
                let role = if self.permissions.is_empty() && !self.contributes.document_formats.is_empty() { PluginRuntimeKind::Document } else { PluginRuntimeKind::Extension };
                (role, main)
            }),
        }
    }

    pub fn effective_runtime(&self) -> Option<PluginRuntimeKind> { self.worker_runtime().map(|(role, _)| role) }

    pub fn validate(&self) -> Result<(), String> {
        validate_id(&self.id)?;
        if self.name.trim().is_empty() || self.name.chars().count() > 80 { return Err("插件 name 必须为 1~80 个字符".into()); }
        validate_version(&self.version, "version")?;
        if let Some(version) = &self.min_app_version { validate_version(version, "minAppVersion")?; }
        if self.api_version != PLUGIN_API_VERSION { return Err(format!("插件 API 版本不兼容：插件需要 apiVersion={}，当前支持 {}", self.api_version, PLUGIN_API_VERSION)); }
        if let Some(main) = &self.main { validate_js_entry(main, "main")?; }
        if let Some(PluginRuntimeConfig::Worker(descriptor)) = &self.runtime { validate_js_entry(&descriptor.main, "runtime.main")?; }
        if matches!(self.runtime.as_ref(), Some(PluginRuntimeConfig::Legacy(_))) && self.main.is_none() { return Err("旧 runtime 字符串写法必须同时提供 main".into()); }
        if let Some(style) = &self.style { validate_relative_file(style, "style")?; if !style.to_ascii_lowercase().ends_with(".css") { return Err("style 必须指向 .css 文件".into()); } }
        if let Some(icon) = &self.icon { validate_relative_file(icon, "icon")?; }
        for permission in &self.permissions { if !ALLOWED_PERMISSIONS.contains(&permission.as_str()) { return Err(format!("不支持的插件权限：{permission}")); } }

        match self.effective_runtime() {
            Some(PluginRuntimeKind::Document) => {
                if !self.permissions.is_empty() { return Err("document Worker 必须是零权限 runtime；请移除 permissions".into()); }
                if self.contributes.document_formats.is_empty() { return Err("document Worker 必须声明至少一个 contributes.documentFormats".into()); }
            }
            Some(PluginRuntimeKind::Extension) => {
                if !self.contributes.document_formats.is_empty() { return Err("documentFormats 只能由 document Worker 提供".into()); }
            }
            None => {
                if !self.permissions.is_empty() { return Err("没有 Worker runtime 的声明式插件不能请求 permissions".into()); }
                if self.style.is_some() { return Err("声明式 Theme Plugin 不能注入任意 style；请使用 Semantic Token".into()); }
                if !self.contributes.document_formats.is_empty() { return Err("documentFormats 需要 document Worker runtime".into()); }
                if self.contributes.themes.is_empty() { return Err("插件必须至少声明一个 contribution 或 Worker runtime".into()); }
            }
        }

        validate_document_formats(&self.contributes.document_formats)?;
        validate_theme_manifests(&self.contributes.themes)?;
        Ok(())
    }

    pub fn compatibility_issue(&self, app_version: &str) -> Option<String> {
        let required = self.min_app_version.as_deref()?;
        match (VersionTriplet::parse(required), VersionTriplet::parse(app_version)) {
            (Some(required), Some(current)) if current < required => Some(format!("需要 oneView {required_text} 或更高版本（当前 {app_version}）", required_text = required)),
            _ => None,
        }
    }
}

fn validate_document_formats(formats: &[PluginDocumentFormatManifest]) -> Result<(), String> {
    if formats.len() > 24 { return Err("单个插件最多声明 24 个 documentFormats".into()); }
    let mut format_ids = HashSet::new(); let mut extensions = HashSet::new();
    for format in formats {
        validate_contribution_id(&format.id, "document format id")?;
        let normalized_id = format.id.to_ascii_lowercase();
        if matches!(normalized_id.as_str(), "markdown" | "text" | "plaintext" | "plain-text") { return Err(format!("document format id {} 由 Core 保留", format.id)); }
        if !format_ids.insert(normalized_id) { return Err(format!("重复的 document format id：{}", format.id)); }
        if format.label.trim().is_empty() || format.label.chars().count() > 60 { return Err(format!("document format {} 的 label 必须为 1~60 个字符", format.id)); }
        if format.extensions.is_empty() || format.extensions.len() > 24 { return Err(format!("document format {} 必须声明 1~24 个扩展名", format.id)); }
        for extension in &format.extensions {
            let normalized = extension.trim().trim_start_matches('.').to_ascii_lowercase();
            if normalized.is_empty() || normalized.len() > 24 || !normalized.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')) { return Err(format!("document format {} 包含无效扩展名：{}", format.id, extension)); }
            if matches!(normalized.as_str(), "md" | "markdown" | "mdown" | "mkd" | "txt" | "text") { return Err("Markdown / Plain Text 扩展名由 Core 独占，插件不能覆盖".into()); }
            if !extensions.insert(normalized.clone()) { return Err(format!("插件内重复声明扩展名：.{normalized}")); }
        }
    }
    Ok(())
}

fn validate_theme_manifests(themes: &[PluginThemeManifest]) -> Result<(), String> {
    if themes.len() > 24 { return Err("单个插件最多声明 24 个 themes".into()); }
    let mut ids = HashSet::new(); let mut family_scope: HashMap<String, HashSet<ThemeScope>> = HashMap::new(); let mut family_variants = HashSet::new();
    for theme in themes {
        validate_contribution_id(&theme.id, "theme id")?; validate_contribution_id(&theme.family, "theme family")?;
        if theme.label.trim().is_empty() || theme.label.chars().count() > 60 { return Err(format!("theme {} 的 label 必须为 1~60 个字符", theme.id)); }
        if !ids.insert(theme.id.to_ascii_lowercase()) { return Err(format!("重复的 theme id：{}", theme.id)); }
        validate_relative_file(&theme.path, "theme path")?;
        if !theme.path.to_ascii_lowercase().ends_with(".json") { return Err(format!("theme {} 必须指向 .json 文件", theme.id)); }
        if theme.scope.is_empty() { return Err(format!("theme {} scope 不能为空", theme.id)); }
        let scope: HashSet<_> = theme.scope.iter().copied().collect();
        if scope.len() != theme.scope.len() { return Err(format!("theme {} scope 包含重复项", theme.id)); }
        if let Some(previous) = family_scope.get(&theme.family) { if previous != &scope { return Err(format!("theme family {} 的 Light / Dark scope 必须一致", theme.family)); } } else { family_scope.insert(theme.family.clone(), scope); }
        if !family_variants.insert((theme.family.to_ascii_lowercase(), theme.variant)) { return Err(format!("theme family {} 重复声明 {:?} variant", theme.family, theme.variant)); }
    }
    Ok(())
}

fn validate_js_entry(value: &str, field: &str) -> Result<(), String> { validate_relative_file(value, field)?; if !value.to_ascii_lowercase().ends_with(".js") { return Err(format!("{field} 必须指向 .js 文件")); } Ok(()) }
fn default_api_version() -> u16 { PLUGIN_API_VERSION }

pub(crate) fn validate_id(id: &str) -> Result<(), String> {
    if id.len() < 3 || id.len() > 120 { return Err("插件 id 长度必须为 3~120".into()); }
    if !id.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'-' | b'_')) { return Err("插件 id 只能包含小写字母、数字、点、短横线和下划线".into()); }
    if id.starts_with('.') || id.ends_with('.') || id.contains("..") { return Err("插件 id 格式无效".into()); }
    Ok(())
}

fn validate_contribution_id(value: &str, field: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 80 || !value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_')) { return Err(format!("{field} 格式无效")); }
    Ok(())
}

pub(crate) fn validate_relative_file(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() || value.len() > 240 { return Err(format!("{field} 路径无效")); }
    let path = Path::new(value);
    if path.is_absolute() || path.components().any(|part| !matches!(part, Component::Normal(_))) { return Err(format!("{field} 必须是插件目录内的相对文件路径")); }
    Ok(())
}

fn validate_version(value: &str, field: &str) -> Result<(), String> { VersionTriplet::parse(value).map(|_| ()).ok_or_else(|| format!("{field} 必须使用 major.minor.patch 版本格式")) }

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct VersionTriplet(u64, u64, u64);
impl VersionTriplet {
    fn parse(raw: &str) -> Option<Self> { let core = raw.trim().trim_start_matches('v').split(|ch| ch == '-' || ch == '+').next()?; let mut parts = core.split('.'); let major=parts.next()?.parse().ok()?; let minor=parts.next()?.parse().ok()?; let patch=parts.next()?.parse().ok()?; if parts.next().is_some(){return None;} Some(Self(major,minor,patch)) }
}
impl std::fmt::Display for VersionTriplet { fn fmt(&self, f:&mut std::fmt::Formatter<'_>)->std::fmt::Result { write!(f,"{}.{}.{}",self.0,self.1,self.2) } }

#[cfg(test)]
mod tests {
    use super::*;
    fn parse(raw: &str) -> PluginManifest { serde_json::from_str(raw).expect("manifest should parse") }
    #[test] fn legacy_document_runtime_remains_supported() { let m=parse(r#"{"id":"com.example.doc","name":"Doc","version":"1.0.0","apiVersion":1,"main":"main.js","runtime":"document","permissions":[],"contributes":{"documentFormats":[{"id":"foo","label":"Foo","extensions":["foo"]}]}}"#); assert_eq!(m.effective_runtime(),Some(PluginRuntimeKind::Document)); assert!(m.validate().is_ok()); }
    #[test] fn declarative_theme_requires_no_worker() { let m=parse(r#"{"id":"com.example.theme","name":"Theme","version":"1.0.0","apiVersion":1,"permissions":[],"contributes":{"themes":[{"id":"slate.light","family":"slate","label":"Slate","variant":"light","scope":["app"],"path":"themes/light.json"}]}}"#); assert_eq!(m.effective_runtime(),None); assert!(m.validate().is_ok()); }
    #[test] fn new_worker_descriptor_is_supported() { let m=parse(r#"{"id":"com.example.doc","name":"Doc","version":"1.0.0","apiVersion":1,"runtime":{"kind":"worker","role":"document","main":"main.js"},"permissions":[],"contributes":{"documentFormats":[{"id":"foo","label":"Foo","extensions":["foo"]}]}}"#); assert_eq!(m.effective_runtime(),Some(PluginRuntimeKind::Document)); assert!(m.validate().is_ok()); }
}

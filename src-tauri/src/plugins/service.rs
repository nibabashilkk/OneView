use super::{
    manifest::{validate_id as validate_manifest_id, PluginManifest, PluginThemeManifest, ThemeScope, ThemeVariant, THEME_TOKEN_KEYS},
    registry::PluginRegistryFile,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const MAX_PACKAGE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_ENTRY_COUNT: usize = 512;
const MAX_MAIN_BYTES: u64 = 2 * 1024 * 1024;
const MAX_STYLE_BYTES: u64 = 512 * 1024;
const MAX_THEME_BYTES: u64 = 256 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PluginSource {
    Installed,
    Development { path: String },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPlugin {
    pub manifest: PluginManifest,
    pub enabled: bool,
    pub compatible: bool,
    pub compatibility_issue: Option<String>,
    pub permission_review_required: bool,
    pub source: PluginSource,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInventory {
    pub plugins: Vec<InstalledPlugin>,
    pub warnings: Vec<String>,
    pub shortcut_overrides: BTreeMap<String, Option<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginBundle {
    pub manifest: PluginManifest,
    pub main_js: Option<String>,
    pub style_css: Option<String>,
    pub theme_files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginStartupRecoveryState {
    pub safe_mode: bool,
    pub previous_startup_incomplete: bool,
    pub interrupted_plugin_id: Option<String>,
    pub recovery_count: u32,
}

#[derive(Debug, Clone)]
pub struct PluginService {
    inner: Arc<PluginServiceInner>,
}

#[derive(Debug)]
struct PluginServiceInner {
    plugins_dir: PathBuf,
    data_dir: PathBuf,
    registry_path: PathBuf,
    app_version: String,
    lock: Mutex<()>,
}

impl PluginService {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data = app.path().app_data_dir().map_err(|error| format!("无法确定应用数据目录: {error}"))?;
        let plugins_dir = app_data.join("plugins");
        let data_dir = app_data.join("plugin-data");
        fs::create_dir_all(&plugins_dir).map_err(|error| format!("创建插件目录失败: {error}"))?;
        fs::create_dir_all(&data_dir).map_err(|error| format!("创建插件数据目录失败: {error}"))?;
        Ok(Self {
            inner: Arc::new(PluginServiceInner {
                plugins_dir,
                data_dir,
                registry_path: app_data.join("plugin-registry-v1.json"),
                app_version: app.package_info().version.to_string(),
                lock: Mutex::new(()),
            }),
        })
    }

    pub fn list(&self) -> Result<PluginInventory, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        self.list_locked()
    }


    /// Begin the short automatic plugin startup phase. A marker is persisted before any
    /// third-party code runs so a hard crash can be detected on the next launch.
    pub fn begin_startup_session(&self) -> Result<PluginStartupRecoveryState, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        let previous_startup_incomplete = registry.startup_in_progress;
        let interrupted_plugin_id = if previous_startup_incomplete {
            registry.startup_plugin_id.clone()
        } else {
            None
        };
        if previous_startup_incomplete {
            registry.safe_mode = true;
            registry.recovery_count = registry.recovery_count.saturating_add(1);
        }
        registry.startup_in_progress = true;
        registry.startup_plugin_id = None;
        registry.save(&self.inner.registry_path)?;
        Ok(PluginStartupRecoveryState {
            safe_mode: registry.safe_mode,
            previous_startup_incomplete,
            interrupted_plugin_id,
            recovery_count: registry.recovery_count,
        })
    }

    pub fn mark_startup_plugin(&self, id: Option<&str>) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        if !registry.startup_in_progress {
            return Ok(());
        }
        registry.startup_plugin_id = id.map(str::to_string);
        registry.save(&self.inner.registry_path)
    }

    pub fn complete_startup_session(&self) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        registry.startup_in_progress = false;
        registry.startup_plugin_id = None;
        registry.save(&self.inner.registry_path)
    }

    pub fn set_safe_mode(&self, enabled: bool) -> Result<PluginStartupRecoveryState, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        registry.safe_mode = enabled;
        registry.save(&self.inner.registry_path)?;
        Ok(PluginStartupRecoveryState {
            safe_mode: registry.safe_mode,
            previous_startup_incomplete: false,
            interrupted_plugin_id: None,
            recovery_count: registry.recovery_count,
        })
    }

    pub fn install(&self, package_path: &str) -> Result<InstalledPlugin, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let package_path = Path::new(package_path);
        if !package_path.is_file() {
            return Err("插件安装包不存在".into());
        }
        if package_path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("mdvplugin")) != Some(true) {
            return Err("请选择 .mdvplugin 插件安装包".into());
        }
        let metadata = fs::metadata(package_path).map_err(|error| format!("读取插件安装包失败: {error}"))?;
        if metadata.len() > MAX_PACKAGE_BYTES {
            return Err("插件安装包超过 20 MB 限制".into());
        }

        let file = File::open(package_path).map_err(|error| format!("打开插件安装包失败: {error}"))?;
        let mut archive = ZipArchive::new(file).map_err(|error| format!("插件安装包不是有效 ZIP: {error}"))?;
        if archive.len() > MAX_ENTRY_COUNT {
            return Err("插件安装包文件数量过多".into());
        }

        let manifest = read_manifest_from_archive(&mut archive)?;
        manifest.validate()?;
        let previous_registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        if previous_registry.development.contains_key(&manifest.id) {
            return Err(format!("插件 {} 当前以开发目录方式加载，请先移除开发引用再安装正式包", manifest.id));
        }
        let was_enabled = previous_registry.enabled.get(&manifest.id).copied().unwrap_or(false);

        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
        let staging = self.inner.plugins_dir.join(format!(".install-{}-{unique}", manifest.id));
        let target = self.inner.plugins_dir.join(&manifest.id);
        let backup = self.inner.plugins_dir.join(format!(".backup-{}-{unique}", manifest.id));
        if staging.exists() { let _ = fs::remove_dir_all(&staging); }
        fs::create_dir_all(&staging).map_err(|error| format!("创建插件临时目录失败: {error}"))?;

        let extraction = extract_archive(&mut archive, &staging);
        if let Err(error) = extraction {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        if let Err(error) = ensure_declared_files(&staging, &manifest) {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }

        if target.exists() {
            fs::rename(&target, &backup).map_err(|error| format!("备份旧插件失败: {error}"))?;
        }
        if let Err(error) = fs::rename(&staging, &target) {
            if backup.exists() { let _ = fs::rename(&backup, &target); }
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("安装插件失败: {error}"));
        }
        if backup.exists() { let _ = fs::remove_dir_all(&backup); }

        let compatible = manifest.compatibility_issue(&self.inner.app_version).is_none();
        let permission_granted = permissions_are_granted(&manifest, &previous_registry);
        let enabled = was_enabled && compatible && permission_granted;
        let mut registry = previous_registry;
        registry.enabled.insert(manifest.id.clone(), enabled);
        registry.save(&self.inner.registry_path)?;
        Ok(self.installed_from_manifest(manifest, enabled, PluginSource::Installed, &registry))
    }

    /// Link an unpacked plugin directory for development. The directory is not copied;
    /// every reload reads `manifest.json` and `main.js` from the original location.
    pub fn link_development(&self, directory: &str) -> Result<InstalledPlugin, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let requested = Path::new(directory);
        if !requested.is_dir() {
            return Err("开发插件目录不存在".into());
        }
        let root = fs::canonicalize(requested).map_err(|error| format!("解析开发插件目录失败: {error}"))?;
        let manifest = read_valid_manifest_at(&root, None)?;
        ensure_declared_files(&root, &manifest)?;

        if self.inner.plugins_dir.join(&manifest.id).is_dir() {
            return Err(format!("已安装正式插件 {}，请先卸载正式插件后再加载同 id 的开发目录", manifest.id));
        }

        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        if let Some((other_id, _)) = registry.development.iter().find(|(id, path)| {
            id.as_str() != manifest.id && Path::new(path.as_str()) == root.as_path()
        }) {
            return Err(format!("此目录已被开发插件 {other_id} 使用"));
        }

        let canonical = root.to_string_lossy().to_string();
        let same_link = registry.development.get(&manifest.id).map(String::as_str) == Some(canonical.as_str());
        if !same_link {
            // A newly linked source directory is a new trust decision even when it reuses the same id.
            registry.enabled.insert(manifest.id.clone(), false);
            registry.granted_permissions.remove(&manifest.id);
        }
        let enabled = registry.enabled.get(&manifest.id).copied().unwrap_or(false)
            && permissions_are_granted(&manifest, &registry);
        registry.development.insert(manifest.id.clone(), canonical.clone());
        registry.enabled.entry(manifest.id.clone()).or_insert(false);
        registry.save(&self.inner.registry_path)?;
        Ok(self.installed_from_manifest(
            manifest,
            enabled,
            PluginSource::Development { path: canonical },
            &registry,
        ))
    }

    pub fn uninstall(&self, id: &str, remove_data: bool) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;

        // Development plugins are references, not owned files. Removing one must never
        // delete the user's source directory.
        if registry.development.remove(id).is_none() {
            let target = self.inner.plugins_dir.join(id);
            if target.exists() {
                fs::remove_dir_all(&target).map_err(|error| format!("删除插件失败: {error}"))?;
            }
        }

        if remove_data {
            let data = self.inner.data_dir.join(id);
            if data.exists() { fs::remove_dir_all(data).map_err(|error| format!("删除插件数据失败: {error}"))?; }
        }
        registry.enabled.remove(id);
        registry.granted_permissions.remove(id);
        let prefix = format!("{id}:");
        registry.shortcut_overrides.retain(|command_id, _| !command_id.starts_with(&prefix));
        registry.save(&self.inner.registry_path)
    }

    pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<InstalledPlugin, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        let registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        let (manifest, _, source) = self.resolve_plugin_locked(id, &registry)?;
        if enabled {
            if let Some(issue) = manifest.compatibility_issue(&self.inner.app_version) {
                return Err(format!("插件与当前版本不兼容：{issue}"));
            }
        }
        let mut registry = registry;
        registry.enabled.insert(id.to_string(), enabled);
        if enabled {
            registry.granted_permissions.insert(id.to_string(), manifest.permissions.clone());
        }
        registry.save(&self.inner.registry_path)?;
        Ok(self.installed_from_manifest(manifest, enabled, source, &registry))
    }

    pub fn set_shortcut_override(&self, command_id: &str, shortcut: Option<&str>) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (plugin_id, _) = validate_plugin_command_id(command_id)?;
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        self.resolve_plugin_locked(plugin_id, &registry)?;
        let normalized = shortcut.map(validate_shortcut_override).transpose()?;
        registry.shortcut_overrides.insert(command_id.to_string(), normalized);
        registry.save(&self.inner.registry_path)
    }

    pub fn clear_shortcut_override(&self, command_id: &str) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let (plugin_id, _) = validate_plugin_command_id(command_id)?;
        let mut registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        self.resolve_plugin_locked(plugin_id, &registry)?;
        registry.shortcut_overrides.remove(command_id);
        registry.save(&self.inner.registry_path)
    }

    pub fn read_bundle(&self, id: &str) -> Result<PluginBundle, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        let registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        let (manifest, root, _) = self.resolve_plugin_locked(id, &registry)?;
        if let Some(issue) = manifest.compatibility_issue(&self.inner.app_version) {
            return Err(format!("插件与当前版本不兼容：{issue}"));
        }
        let main_js = manifest.worker_runtime()
            .map(|(_, main)| safe_declared_path(&root, main, "插件 main.js").and_then(|path| read_text_limited(&path, MAX_MAIN_BYTES, "插件 main.js")))
            .transpose()?;
        let style_css = manifest.style.as_ref()
            .map(|style| safe_declared_path(&root, style, "插件 styles.css").and_then(|path| read_text_limited(&path, MAX_STYLE_BYTES, "插件 styles.css")))
            .transpose()?;
        let mut theme_files = BTreeMap::new();
        for theme in &manifest.contributes.themes {
            let path = safe_declared_path(&root, &theme.path, "主题文件")?;
            let raw = read_text_limited(&path, MAX_THEME_BYTES, "主题文件")?;
            validate_theme_json(theme, &raw)?;
            theme_files.insert(theme.path.clone(), raw);
        }
        Ok(PluginBundle { manifest, main_js, style_css, theme_files })
    }

    pub fn storage_get(&self, id: &str, key: &str) -> Result<Option<Value>, String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        self.ensure_available_locked(id)?;
        validate_storage_key(key)?;
        let data = self.read_storage(id)?;
        Ok(data.get(key).cloned())
    }

    pub fn storage_set(&self, id: &str, key: &str, value: Value) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        self.ensure_available_locked(id)?;
        validate_storage_key(key)?;
        let serialized = serde_json::to_vec(&value).map_err(|error| format!("插件数据无法序列化: {error}"))?;
        if serialized.len() > 256 * 1024 { return Err("单个插件数据项超过 256 KB".into()); }
        let mut data = self.read_storage(id)?;
        data.insert(key.to_string(), value);
        self.write_storage(id, &data)
    }

    pub fn storage_delete(&self, id: &str, key: &str) -> Result<(), String> {
        let _guard = self.inner.lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        validate_plugin_id(id)?;
        self.ensure_available_locked(id)?;
        validate_storage_key(key)?;
        let mut data = self.read_storage(id)?;
        data.remove(key);
        self.write_storage(id, &data)
    }

    fn list_locked(&self) -> Result<PluginInventory, String> {
        let registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        let mut plugins = Vec::new();
        let mut warnings = Vec::new();
        let mut managed_ids = BTreeSet::new();

        let entries = fs::read_dir(&self.inner.plugins_dir).map_err(|error| format!("读取插件目录失败: {error}"))?;
        for entry in entries {
            let entry = match entry { Ok(value) => value, Err(error) => { warnings.push(error.to_string()); continue; } };
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || !entry.path().is_dir() { continue; }
            match read_valid_manifest_at(&entry.path(), Some(&name)) {
                Ok(manifest) => {
                    managed_ids.insert(manifest.id.clone());
                    let compatible = manifest.compatibility_issue(&self.inner.app_version).is_none();
                    let enabled = registry.enabled.get(&manifest.id).copied().unwrap_or(false)
                        && compatible
                        && permissions_are_granted(&manifest, &registry);
                    plugins.push(self.installed_from_manifest(manifest, enabled, PluginSource::Installed, &registry));
                }
                Err(error) => warnings.push(format!("{name}: {error}")),
            }
        }

        for (id, path) in &registry.development {
            if managed_ids.contains(id) {
                warnings.push(format!("{id}: 同时存在正式插件与开发目录引用，已优先使用正式插件"));
                continue;
            }
            let root = PathBuf::from(path);
            if !root.is_dir() {
                warnings.push(format!("{id}: 开发插件目录不存在：{path}"));
                continue;
            }
            match read_valid_manifest_at(&root, Some(id)).and_then(|manifest| {
                ensure_declared_files(&root, &manifest)?;
                Ok(manifest)
            }) {
                Ok(manifest) => {
                    let compatible = manifest.compatibility_issue(&self.inner.app_version).is_none();
                    let enabled = registry.enabled.get(id).copied().unwrap_or(false)
                        && compatible
                        && permissions_are_granted(&manifest, &registry);
                    plugins.push(self.installed_from_manifest(
                        manifest,
                        enabled,
                        PluginSource::Development { path: path.clone() },
                        &registry,
                    ));
                }
                Err(error) => warnings.push(format!("{id}: {error}")),
            }
        }

        plugins.sort_by(|a, b| a.manifest.name.to_lowercase().cmp(&b.manifest.name.to_lowercase()));
        Ok(PluginInventory { plugins, warnings, shortcut_overrides: registry.shortcut_overrides.clone() })
    }

    fn resolve_plugin_locked(
        &self,
        id: &str,
        registry: &PluginRegistryFile,
    ) -> Result<(PluginManifest, PathBuf, PluginSource), String> {
        let installed_root = self.inner.plugins_dir.join(id);
        if installed_root.join("manifest.json").is_file() {
            let manifest = read_valid_manifest_at(&installed_root, Some(id))?;
            ensure_declared_files(&installed_root, &manifest)?;
            return Ok((manifest, installed_root, PluginSource::Installed));
        }
        let path = registry.development.get(id).ok_or_else(|| "插件未安装".to_string())?;
        let root = PathBuf::from(path);
        if !root.is_dir() {
            return Err(format!("开发插件目录不存在：{path}"));
        }
        let manifest = read_valid_manifest_at(&root, Some(id))?;
        ensure_declared_files(&root, &manifest)?;
        Ok((manifest, root, PluginSource::Development { path: path.clone() }))
    }

    fn installed_from_manifest(
        &self,
        manifest: PluginManifest,
        enabled: bool,
        source: PluginSource,
        registry: &PluginRegistryFile,
    ) -> InstalledPlugin {
        let compatibility_issue = manifest.compatibility_issue(&self.inner.app_version);
        let permission_review_required = !permissions_are_granted(&manifest, registry);
        InstalledPlugin {
            compatible: compatibility_issue.is_none(),
            enabled: enabled && compatibility_issue.is_none() && !permission_review_required,
            permission_review_required,
            manifest,
            compatibility_issue,
            source,
        }
    }

    fn ensure_available_locked(&self, id: &str) -> Result<(), String> {
        let registry = PluginRegistryFile::load(&self.inner.registry_path)?;
        self.resolve_plugin_locked(id, &registry).map(|_| ())
    }

    fn storage_path(&self, id: &str) -> PathBuf { self.inner.data_dir.join(id).join("data.json") }

    fn read_storage(&self, id: &str) -> Result<BTreeMap<String, Value>, String> {
        let path = self.storage_path(id);
        if !path.is_file() { return Ok(BTreeMap::new()); }
        let bytes = fs::read(path).map_err(|error| format!("读取插件数据失败: {error}"))?;
        serde_json::from_slice(&bytes).map_err(|error| format!("解析插件数据失败: {error}"))
    }

    fn write_storage(&self, id: &str, data: &BTreeMap<String, Value>) -> Result<(), String> {
        let path = self.storage_path(id);
        let parent = path.parent().ok_or_else(|| "插件数据路径无效".to_string())?;
        fs::create_dir_all(parent).map_err(|error| format!("创建插件数据目录失败: {error}"))?;
        let bytes = serde_json::to_vec_pretty(data).map_err(|error| format!("序列化插件数据失败: {error}"))?;
        if bytes.len() > 2 * 1024 * 1024 { return Err("插件数据总量超过 2 MB".into()); }
        let temp = path.with_extension("tmp");
        fs::write(&temp, bytes).map_err(|error| format!("写入插件数据失败: {error}"))?;
        if path.exists() {
            fs::remove_file(&path).map_err(|error| format!("替换插件数据失败: {error}"))?;
        }
        fs::rename(&temp, &path).map_err(|error| format!("替换插件数据失败: {error}"))
    }
}

fn read_manifest_from_archive<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>) -> Result<PluginManifest, String> {
    let mut file = archive.by_name("manifest.json").map_err(|_| "插件包根目录必须包含 manifest.json".to_string())?;
    if file.size() > 128 * 1024 { return Err("manifest.json 过大".into()); }
    let mut text = String::new();
    file.read_to_string(&mut text).map_err(|error| format!("读取 manifest.json 失败: {error}"))?;
    serde_json::from_str(&text).map_err(|error| format!("解析 manifest.json 失败: {error}"))
}

fn read_valid_manifest_at(root: &Path, expected_id: Option<&str>) -> Result<PluginManifest, String> {
    let path = root.join("manifest.json");
    let metadata = fs::metadata(&path).map_err(|error| format!("读取 manifest.json 失败: {error}"))?;
    if metadata.len() > 128 * 1024 { return Err("manifest.json 过大".into()); }
    let bytes = fs::read(&path).map_err(|error| format!("读取 manifest.json 失败: {error}"))?;
    let manifest: PluginManifest = serde_json::from_slice(&bytes).map_err(|error| format!("解析 manifest.json 失败: {error}"))?;
    manifest.validate()?;
    if let Some(expected) = expected_id {
        if manifest.id != expected {
            return Err(format!("manifest id 与插件引用不一致：期望={expected}, manifest={}", manifest.id));
        }
    }
    Ok(manifest)
}

fn extract_archive<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>, destination: &Path) -> Result<(), String> {
    let mut total = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| format!("读取插件包失败: {error}"))?;
        let enclosed = entry.enclosed_name().ok_or_else(|| format!("插件包包含不安全路径: {}", entry.name()))?.to_path_buf();
        total = total.saturating_add(entry.size());
        if total > MAX_PACKAGE_BYTES { return Err("插件解压后超过 20 MB 限制".into()); }
        let output = destination.join(enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&output).map_err(|error| format!("创建插件目录失败: {error}"))?;
            continue;
        }
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建插件目录失败: {error}"))?;
        }
        let mut file = File::create(&output).map_err(|error| format!("创建插件文件失败: {error}"))?;
        std::io::copy(&mut entry, &mut file).map_err(|error| format!("解压插件文件失败: {error}"))?;
        file.flush().map_err(|error| format!("写入插件文件失败: {error}"))?;
    }
    Ok(())
}

fn ensure_declared_files(root: &Path, manifest: &PluginManifest) -> Result<(), String> {
    safe_declared_path(root, "manifest.json", "manifest.json")?;
    if let Some((_, main)) = manifest.worker_runtime() { safe_declared_path(root, main, "插件入口")?; }
    if let Some(style) = &manifest.style { safe_declared_path(root, style, "插件样式")?; }
    if let Some(icon) = &manifest.icon { safe_declared_path(root, icon, "插件图标")?; }
    for theme in &manifest.contributes.themes {
        let path = safe_declared_path(root, &theme.path, "主题文件")?;
        let raw = read_text_limited(&path, MAX_THEME_BYTES, "主题文件")?;
        validate_theme_json(theme, &raw)?;
    }
    Ok(())
}

fn safe_declared_path(root: &Path, relative: &str, label: &str) -> Result<PathBuf, String> {
    let canonical_root = fs::canonicalize(root).map_err(|error| format!("解析插件目录失败: {error}"))?;
    let candidate = root.join(relative);
    let canonical = fs::canonicalize(&candidate).map_err(|error| format!("{label} 不存在或不可读取: {error}"))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(format!("{label} 不能通过 symlink 或路径跳出插件目录: {relative}"));
    }
    if !canonical.is_file() { return Err(format!("{label} 不是文件: {relative}")); }
    Ok(canonical)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThemeDefinitionFile {
    schema_version: u16,
    id: String,
    family: String,
    variant: ThemeVariant,
    scope: Vec<ThemeScope>,
    tokens: BTreeMap<String, String>,
}

fn validate_theme_json(manifest: &PluginThemeManifest, raw: &str) -> Result<(), String> {
    if raw.len() > MAX_THEME_BYTES as usize { return Err(format!("主题 {} 超过 256 KB 限制", manifest.id)); }
    let definition: ThemeDefinitionFile = serde_json::from_str(raw).map_err(|error| format!("解析主题 {} 失败: {error}", manifest.id))?;
    if definition.schema_version != 1 { return Err(format!("主题 {} schemaVersion 必须为 1", manifest.id)); }
    if definition.id != manifest.id || definition.family != manifest.family || definition.variant != manifest.variant {
        return Err(format!("主题 {} 的 id/family/variant 与 manifest 不一致", manifest.id));
    }
    let declared: BTreeSet<_> = manifest.scope.iter().copied().map(theme_scope_sort_key).collect();
    let actual: BTreeSet<_> = definition.scope.iter().copied().map(theme_scope_sort_key).collect();
    if declared != actual || actual.len() != definition.scope.len() { return Err(format!("主题 {} 的 scope 与 manifest 不一致", manifest.id)); }
    for (key, value) in &definition.tokens {
        if !THEME_TOKEN_KEYS.contains(&key.as_str()) { return Err(format!("主题 {} 包含未知 token: {key}", manifest.id)); }
        if !is_safe_theme_color(value) { return Err(format!("主题 {} 的 token {key} 值无效", manifest.id)); }
        let allowed = manifest.scope.iter().any(|scope| key.starts_with(scope.prefix()));
        if !allowed { return Err(format!("主题 {} 的 token {key} 超出声明 scope", manifest.id)); }
    }
    for key in THEME_TOKEN_KEYS {
        if manifest.scope.iter().any(|scope| key.starts_with(scope.prefix())) && !definition.tokens.contains_key(*key) {
            return Err(format!("主题 {} 缺少 token: {key}", manifest.id));
        }
    }
    Ok(())
}

fn is_safe_theme_color(raw: &str) -> bool {
    let value = raw.trim();
    if value.is_empty()
        || value.len() > 160
        || value.chars().any(|ch| ch.is_control() || matches!(ch, ';' | '{' | '}' | '@'))
    {
        return false;
    }
    let lower = value.to_ascii_lowercase();
    if matches!(lower.as_str(), "transparent" | "currentcolor") {
        return true;
    }
    if let Some(hex) = value.strip_prefix('#') {
        return matches!(hex.len(), 3 | 4 | 6 | 8) && hex.bytes().all(|byte| byte.is_ascii_hexdigit());
    }
    if value.bytes().all(|byte| byte.is_ascii_alphabetic() || byte == b'-') {
        return true;
    }
    let Some(open) = value.find('(') else { return false; };
    if !value.ends_with(')') {
        return false;
    }
    let inner = &value[open + 1..value.len() - 1];
    if inner.contains('(') || inner.contains(')') {
        return false;
    }
    let function = value[..open].to_ascii_lowercase();
    if !matches!(function.as_str(), "rgb" | "rgba" | "hsl" | "hsla" | "oklab" | "oklch" | "lab" | "lch" | "color") {
        return false;
    }
    inner.bytes().all(|byte| {
        byte.is_ascii_alphanumeric()
            || matches!(byte, b'.' | b',' | b'%' | b'+' | b'-' | b'/' | b' ' | b'\t')
    })
}

fn theme_scope_sort_key(scope: ThemeScope) -> u8 { match scope { ThemeScope::App => 0, ThemeScope::Reader => 1, ThemeScope::Syntax => 2 } }

fn read_text_limited(path: &Path, max: u64, label: &str) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("读取 {label} 失败: {error}"))?;
    if metadata.len() > max { return Err(format!("{label} 超过大小限制")); }
    fs::read_to_string(path).map_err(|error| format!("读取 {label} 失败: {error}"))
}

fn permissions_are_granted(manifest: &PluginManifest, registry: &PluginRegistryFile) -> bool {
    if manifest.permissions.is_empty() { return true; }
    let Some(granted) = registry.granted_permissions.get(&manifest.id) else { return false; };
    manifest.permissions.iter().all(|permission| granted.contains(permission))
}

fn validate_plugin_id(id: &str) -> Result<(), String> {
    validate_manifest_id(id).map_err(|_| "插件 id 无效".to_string())
}

fn validate_plugin_command_id(command_id: &str) -> Result<(&str, &str), String> {
    let (plugin_id, local_id) = command_id.split_once(':').ok_or_else(|| "插件命令 id 无效".to_string())?;
    validate_plugin_id(plugin_id)?;
    if local_id.is_empty() || local_id.len() > 80 || !local_id.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-')) {
        return Err("插件命令本地 id 无效".into());
    }
    Ok((plugin_id, local_id))
}

fn validate_shortcut_override(shortcut: &str) -> Result<String, String> {
    let value = shortcut.trim();
    if value.is_empty() || value.len() > 64 { return Err("插件快捷键必须为 1~64 个字符".into()); }
    if value.chars().any(|ch| ch.is_control()) { return Err("插件快捷键包含无效控制字符".into()); }
    Ok(value.to_string())
}

fn validate_storage_key(key: &str) -> Result<(), String> {
    if key.trim().is_empty() || key.len() > 128 { return Err("插件存储 key 必须为 1~128 个字符".into()); }
    Ok(())
}

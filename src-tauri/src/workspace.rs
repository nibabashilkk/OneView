use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Instant, UNIX_EPOCH},
};
use text_core::decode_text;
use thiserror::Error;

const MAX_TREE_ENTRIES: usize = 5_000;
const MAX_TREE_DEPTH: usize = 10;
const MAX_SEARCH_FILE_BYTES: u64 = 2 * 1024 * 1024;
const DEFAULT_SEARCH_LIMIT: usize = 200;
const MAX_SEARCH_LIMIT: usize = 500;
const CONTEXT_LINES: usize = 1;
const MAX_FORMAT_SPECS: usize = 64;
const MAX_EXTENSIONS_PER_FORMAT: usize = 24;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFormatSpec {
    pub id: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub depth: usize,
    pub directory: bool,
    pub format: Option<String>,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProject {
    pub root: String,
    pub name: String,
    pub readme_path: Option<String>,
    pub entries: Vec<WorkspaceEntry>,
    pub file_count: usize,
    pub truncated: bool,
    pub scan_duration_ms: u64,
    pub index_reused_files: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchContextLine {
    pub line: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
    pub path: String,
    pub relative_path: String,
    pub file_name: String,
    pub format: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
    pub context_before: Vec<WorkspaceSearchContextLine>,
    pub context_after: Vec<WorkspaceSearchContextLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResponse {
    pub results: Vec<WorkspaceSearchResult>,
    pub files_scanned: usize,
    pub cache_hits: usize,
    pub skipped_large_files: usize,
    pub duration_ms: u64,
    pub truncated: bool,
}

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("工作区目录不存在: {0}")]
    NotFound(String),
    #[error("读取工作区失败: {0}")]
    Io(String),
}

#[derive(Clone)]
struct IndexedFile {
    path: PathBuf,
    relative_path: String,
    file_name: String,
    format: String,
    size_bytes: u64,
    modified_at_ms: u64,
    decoded_content: Option<String>,
}

struct CachedProjectIndex {
    project: WorkspaceProject,
    files: Vec<IndexedFile>,
    format_signature: String,
}

#[derive(Clone, Default)]
pub struct WorkspaceIndexCache {
    projects: Arc<Mutex<HashMap<String, CachedProjectIndex>>>,
}

impl WorkspaceIndexCache {
    pub fn open_workspace(
        &self,
        raw_root: &str,
        force_refresh: bool,
        formats: Vec<WorkspaceFormatSpec>,
    ) -> Result<WorkspaceProject, WorkspaceError> {
        let root = canonical_directory(raw_root)?;
        let root_key = root.to_string_lossy().into_owned();
        let formats = normalize_formats(formats);
        let format_signature = formats_signature(&formats);

        if !force_refresh {
            if let Some(project) = self.projects.lock().unwrap_or_else(|p| p.into_inner()).get(&root_key) {
                if project.format_signature == format_signature {
                    return Ok(project.project.clone());
                }
            }
        }

        let started = Instant::now();
        let name = root.file_name()
            .and_then(|value| value.to_str())
            .filter(|value| !value.is_empty())
            .unwrap_or("Workspace")
            .to_string();

        let mut entries = Vec::new();
        let mut files = Vec::new();
        let mut readmes: Vec<(usize, String)> = Vec::new();
        let mut file_count = 0usize;
        let mut truncated = false;
        walk_directory(
            &root,
            &root,
            0,
            &formats,
            &mut entries,
            &mut files,
            &mut readmes,
            &mut file_count,
            &mut truncated,
        )?;
        readmes.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.len().cmp(&b.1.len())));

        let mut guard = self.projects.lock().unwrap_or_else(|p| p.into_inner());
        let previous = guard.remove(&root_key);
        let mut reused = 0usize;
        if let Some(previous) = previous {
            let old = previous.files.into_iter()
                .map(|file| (file.path.clone(), file))
                .collect::<HashMap<_, _>>();
            for file in &mut files {
                if let Some(cached) = old.get(&file.path) {
                    if cached.size_bytes == file.size_bytes && cached.modified_at_ms == file.modified_at_ms {
                        file.decoded_content = cached.decoded_content.clone();
                        if file.decoded_content.is_some() { reused += 1; }
                    }
                }
            }
        }

        let project = WorkspaceProject {
            root: root_key.clone(),
            name,
            readme_path: readmes.first().map(|(_, path)| path.clone()),
            entries,
            file_count,
            truncated,
            scan_duration_ms: started.elapsed().as_millis() as u64,
            index_reused_files: reused,
        };
        guard.insert(root_key, CachedProjectIndex { project: project.clone(), files, format_signature });
        Ok(project)
    }

    pub fn search_workspace(
        &self,
        raw_root: &str,
        query: &str,
        limit: Option<usize>,
        formats: Vec<WorkspaceFormatSpec>,
    ) -> Result<WorkspaceSearchResponse, WorkspaceError> {
        let started = Instant::now();
        let root = canonical_directory(raw_root)?;
        let root_key = root.to_string_lossy().into_owned();
        let formats = normalize_formats(formats);
        let format_signature = formats_signature(&formats);
        let needle = query.trim();
        if needle.is_empty() {
            return Ok(WorkspaceSearchResponse {
                results: Vec::new(), files_scanned: 0, cache_hits: 0, skipped_large_files: 0,
                duration_ms: started.elapsed().as_millis() as u64, truncated: false,
            });
        }

        let needs_refresh = {
            let guard = self.projects.lock().unwrap_or_else(|p| p.into_inner());
            guard.get(&root_key).map(|item| item.format_signature != format_signature).unwrap_or(true)
        };
        if needs_refresh {
            self.open_workspace(&root_key, true, formats.clone())?;
        }

        let needle_lower = needle.to_lowercase();
        let max_results = limit.unwrap_or(DEFAULT_SEARCH_LIMIT).clamp(1, MAX_SEARCH_LIMIT);
        let mut results = Vec::new();
        let mut files_scanned = 0usize;
        let mut cache_hits = 0usize;
        let mut skipped_large_files = 0usize;
        let mut truncated = false;

        let mut guard = self.projects.lock().unwrap_or_else(|p| p.into_inner());
        let index = guard.get_mut(&root_key).ok_or_else(|| WorkspaceError::NotFound(root_key.clone()))?;

        for file in &mut index.files {
            if results.len() >= max_results { truncated = true; break; }

            let current_meta = fs::metadata(&file.path).ok();
            let current_size = current_meta.as_ref().map(|m| m.len()).unwrap_or(file.size_bytes);
            let current_modified = current_meta.as_ref().map(modified_at_ms).unwrap_or(file.modified_at_ms);
            if current_size != file.size_bytes || current_modified != file.modified_at_ms {
                file.size_bytes = current_size;
                file.modified_at_ms = current_modified;
                file.decoded_content = None;
            }
            if file.size_bytes > MAX_SEARCH_FILE_BYTES { skipped_large_files += 1; continue; }
            files_scanned += 1;

            let content = if let Some(content) = file.decoded_content.as_ref() {
                cache_hits += 1;
                content.clone()
            } else {
                let bytes = match fs::read(&file.path) { Ok(value) => value, Err(_) => continue };
                let decoded = decode_text(&bytes).content;
                file.decoded_content = Some(decoded.clone());
                decoded
            };

            let lines = content.lines().collect::<Vec<_>>();
            for (line_index, line) in lines.iter().enumerate() {
                if results.len() >= max_results { truncated = true; break; }
                let lower = line.to_lowercase();
                let Some(byte_index) = lower.find(&needle_lower) else { continue; };
                let column = lower[..byte_index].chars().count() + 1;
                results.push(WorkspaceSearchResult {
                    path: file.path.to_string_lossy().into_owned(),
                    relative_path: file.relative_path.clone(),
                    file_name: file.file_name.clone(),
                    format: file.format.clone(),
                    line: line_index + 1,
                    column,
                    preview: compact_preview(line, needle, 180),
                    context_before: context_lines(&lines, line_index, true),
                    context_after: context_lines(&lines, line_index, false),
                });
            }
        }

        Ok(WorkspaceSearchResponse {
            results,
            files_scanned,
            cache_hits,
            skipped_large_files,
            duration_ms: started.elapsed().as_millis() as u64,
            truncated,
        })
    }
}

fn walk_directory(
    root: &Path,
    directory: &Path,
    depth: usize,
    formats: &[WorkspaceFormatSpec],
    entries: &mut Vec<WorkspaceEntry>,
    files: &mut Vec<IndexedFile>,
    readmes: &mut Vec<(usize, String)>,
    file_count: &mut usize,
    truncated: &mut bool,
) -> Result<(), WorkspaceError> {
    if depth > MAX_TREE_DEPTH || entries.len() >= MAX_TREE_ENTRIES {
        *truncated = true;
        return Ok(());
    }

    let mut children = fs::read_dir(directory)
        .map_err(|e| WorkspaceError::Io(e.to_string()))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    children.sort_by(|a, b| {
        let ad = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let bd = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        bd.cmp(&ad).then_with(|| a.file_name().to_string_lossy().to_lowercase().cmp(&b.file_name().to_string_lossy().to_lowercase()))
    });

    for child in children {
        if entries.len() >= MAX_TREE_ENTRIES { *truncated = true; break; }
        let name = child.file_name().to_string_lossy().into_owned();
        let path = child.path();
        let file_type = match child.file_type() { Ok(value) => value, Err(_) => continue };
        if file_type.is_symlink() { continue; }
        if file_type.is_dir() {
            if ignored_directory(&name) { continue; }
            let relative = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
            let insert_index = entries.len();
            entries.push(WorkspaceEntry { path: path.to_string_lossy().into_owned(), relative_path: relative, name, depth, directory: true, format: None, size_bytes: 0 });
            let before_children = entries.len();
            walk_directory(root, &path, depth + 1, formats, entries, files, readmes, file_count, truncated)?;
            if entries.len() == before_children { entries.remove(insert_index); }
        } else if file_type.is_file() {
            let Some(format) = file_format(&path, formats) else { continue; };
            *file_count += 1;
            let metadata = child.metadata().ok();
            let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified = metadata.as_ref().map(modified_at_ms).unwrap_or(0);
            let relative = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
            let canonical = path.canonicalize().unwrap_or(path.clone());
            if is_readme(&name) { readmes.push((depth, canonical.to_string_lossy().into_owned())); }
            entries.push(WorkspaceEntry {
                path: canonical.to_string_lossy().into_owned(),
                relative_path: relative.clone(),
                name: name.clone(),
                depth,
                directory: false,
                format: Some(format.clone()),
                size_bytes,
            });
            files.push(IndexedFile {
                path: canonical,
                relative_path: relative,
                file_name: name,
                format,
                size_bytes,
                modified_at_ms: modified,
                decoded_content: None,
            });
        }
    }
    Ok(())
}

fn normalize_formats(input: Vec<WorkspaceFormatSpec>) -> Vec<WorkspaceFormatSpec> {
    let mut claimed = HashSet::<String>::new();
    let mut result = vec![
        WorkspaceFormatSpec {
            id: "markdown".into(),
            extensions: vec!["md".into(), "markdown".into(), "mdown".into(), "mkd".into()],
        },
        WorkspaceFormatSpec { id: "text".into(), extensions: vec!["txt".into(), "text".into()] },
    ];
    for spec in &result {
        for extension in &spec.extensions { claimed.insert(extension.clone()); }
    }

    let mut plugin_formats = BTreeMap::<String, Vec<String>>::new();
    for spec in input.into_iter().take(MAX_FORMAT_SPECS) {
        let id = normalize_format_id(&spec.id);
        if id.is_empty() || id == "markdown" || id == "text" { continue; }
        let target = plugin_formats.entry(id).or_default();
        for extension in spec.extensions.into_iter().take(MAX_EXTENSIONS_PER_FORMAT) {
            let extension = normalize_extension(&extension);
            if extension.is_empty() || claimed.contains(&extension) || target.contains(&extension) { continue; }
            target.push(extension);
        }
    }

    for (id, mut extensions) in plugin_formats {
        extensions.retain(|extension| claimed.insert(extension.clone()));
        if extensions.is_empty() { continue; }
        extensions.sort();
        result.push(WorkspaceFormatSpec { id, extensions });
    }
    result
}

fn normalize_format_id(value: &str) -> String {
    value.trim().to_ascii_lowercase().chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        .take(80)
        .collect()
}

fn normalize_extension(value: &str) -> String {
    value.trim().trim_start_matches('.').to_ascii_lowercase().chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        .take(24)
        .collect()
}

fn formats_signature(formats: &[WorkspaceFormatSpec]) -> String {
    formats.iter()
        .map(|item| format!("{}:{}", item.id, item.extensions.join(",")))
        .collect::<Vec<_>>()
        .join("|")
}

fn canonical_directory(raw: &str) -> Result<PathBuf, WorkspaceError> {
    let path = Path::new(raw);
    if !path.is_dir() { return Err(WorkspaceError::NotFound(raw.to_string())); }
    path.canonicalize().map_err(|e| WorkspaceError::Io(e.to_string()))
}

fn ignored_directory(name: &str) -> bool {
    matches!(name.to_ascii_lowercase().as_str(),
        ".git" | ".svn" | ".hg" | "node_modules" | "target" | "dist" | "build" | ".next" | ".nuxt" | ".venv" | "venv" | "__pycache__" | ".idea" | ".vscode")
}

fn is_readme(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == "readme.md" || lower == "readme.markdown" || lower == "readme.mdown" || lower == "readme.mkd"
}

fn file_format(path: &Path, formats: &[WorkspaceFormatSpec]) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    formats.iter()
        .find(|spec| spec.extensions.iter().any(|item| item == &extension))
        .map(|spec| spec.id.clone())
}

fn modified_at_ms(metadata: &fs::Metadata) -> u64 {
    metadata.modified().ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn context_lines(lines: &[&str], index: usize, before: bool) -> Vec<WorkspaceSearchContextLine> {
    let range = if before {
        index.saturating_sub(CONTEXT_LINES)..index
    } else {
        (index + 1)..(index + 1 + CONTEXT_LINES).min(lines.len())
    };
    range.map(|line_index| WorkspaceSearchContextLine {
        line: line_index + 1,
        text: compact_line(lines[line_index], 180),
    }).collect()
}

fn compact_line(line: &str, max_chars: usize) -> String {
    let cleaned = line.trim_end().replace('\t', "  ");
    if cleaned.chars().count() <= max_chars { return cleaned; }
    let body = cleaned.chars().take(max_chars).collect::<String>();
    format!("{body}…")
}

fn compact_preview(line: &str, needle: &str, max_chars: usize) -> String {
    let cleaned = line.trim().replace('\t', " ");
    if cleaned.chars().count() <= max_chars { return cleaned; }
    let lower = cleaned.to_lowercase();
    let needle_lower = needle.to_lowercase();
    let char_pos = lower
        .find(&needle_lower)
        .map(|pos| lower[..pos].chars().count())
        .unwrap_or(0);
    let start = char_pos.saturating_sub(max_chars / 3);
    let end = (start + max_chars).min(cleaned.chars().count());
    let body = cleaned.chars().skip(start).take(end - start).collect::<String>();
    format!("{}{}{}", if start > 0 { "…" } else { "" }, body, if end < cleaned.chars().count() { "…" } else { "" })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_dependency_directories() {
        assert!(ignored_directory("node_modules"));
        assert!(ignored_directory(".git"));
        assert!(!ignored_directory("docs"));
    }

    #[test]
    fn recognizes_readme_names() {
        assert!(is_readme("README.md"));
        assert!(is_readme("readme.MARKDOWN"));
        assert!(!is_readme("guide.md"));
    }

    #[test]
    fn plugin_formats_drive_workspace_file_mapping() {
        let formats = normalize_formats(vec![WorkspaceFormatSpec { id: "json".into(), extensions: vec![".json".into()] }]);
        assert_eq!(file_format(Path::new("README.md"), &formats).as_deref(), Some("markdown"));
        assert_eq!(file_format(Path::new("data.json"), &formats).as_deref(), Some("json"));
        assert_eq!(file_format(Path::new("Cargo.toml"), &formats), None);
    }

    #[test]
    fn plugin_formats_cannot_override_core_extensions() {
        let formats = normalize_formats(vec![
            WorkspaceFormatSpec { id: "aaa".into(), extensions: vec!["md".into(), "json".into()] },
            WorkspaceFormatSpec { id: "bbb".into(), extensions: vec!["json".into(), "txt".into()] },
        ]);
        assert_eq!(file_format(Path::new("README.md"), &formats).as_deref(), Some("markdown"));
        assert_eq!(file_format(Path::new("notes.txt"), &formats).as_deref(), Some("text"));
        assert_eq!(file_format(Path::new("data.json"), &formats).as_deref(), Some("aaa"));
    }

    #[test]
    fn preview_uses_character_offsets_for_unicode_case_mapping() {
        let line = format!("{}TARGET{}", "İ".repeat(120), "x".repeat(120));
        let preview = compact_preview(&line, "target", 80);
        assert!(preview.contains("TARGET"));
    }
}

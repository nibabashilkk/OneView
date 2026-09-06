use percent_encoding::percent_decode_str;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceRequest {
    pub raw: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceResolution {
    pub raw: String,
    pub kind: String,
    pub path: String,
    pub fragment: Option<String>,
    pub exists: bool,
    pub markdown: bool,
}

pub fn resolve_document_resources(
    app: &AppHandle,
    document_path: &str,
    requests: Vec<ResourceRequest>,
) -> Vec<ResourceResolution> {
    requests
        .into_iter()
        .filter_map(|request| resolve_one(app, document_path, request))
        .collect()
}

fn resolve_one(
    app: &AppHandle,
    document_path: &str,
    request: ResourceRequest,
) -> Option<ResourceResolution> {
    let ResourceRequest { raw, kind } = request;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') || is_remote_or_virtual(trimmed) {
        return None;
    }

    let (without_fragment, fragment) = split_fragment(trimmed);
    let fragment = fragment.map(ToOwned::to_owned);
    let without_query = without_fragment.split('?').next().unwrap_or(without_fragment);
    if without_query.trim().is_empty() {
        return None;
    }

    let decoded = percent_decode_str(without_query)
        .decode_utf8_lossy()
        .replace('/', std::path::MAIN_SEPARATOR_STR);
    let candidate = PathBuf::from(decoded);
    let resolved = if candidate.is_absolute() {
        candidate
    } else {
        Path::new(document_path).parent()?.join(candidate)
    };

    let normalized = resolved.canonicalize().unwrap_or(resolved);
    let exists = normalized.is_file();
    let markdown = is_markdown_path(&normalized);

    if exists && kind == "image" && is_supported_image(&normalized) {
        // 只开放 Markdown 实际引用到的单个图片，而不是整个用户目录。
        let _ = app.asset_protocol_scope().allow_file(&normalized);
    }

    Some(ResourceResolution {
        raw,
        kind,
        path: normalized.to_string_lossy().into_owned(),
        fragment,
        exists,
        markdown,
    })
}

fn split_fragment(raw: &str) -> (&str, Option<&str>) {
    match raw.split_once('#') {
        Some((path, fragment)) => (path, Some(fragment)),
        None => (raw, None),
    }
}

fn is_remote_or_virtual(raw: &str) -> bool {
    let lower = raw.to_ascii_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
        || lower.starts_with("asset:")
        || lower.starts_with("javascript:")
        || raw.starts_with("//")
}

fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "md" | "markdown" | "mdown" | "mkd"
    )
}

fn is_supported_image(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif" | "bmp" | "ico"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_fragment_without_losing_path() {
        assert_eq!(split_fragment("guide/intro.md#install"), ("guide/intro.md", Some("install")));
    }

    #[test]
    fn recognizes_remote_urls() {
        assert!(is_remote_or_virtual("https://example.com/a.png"));
        assert!(is_remote_or_virtual("data:image/png;base64,AAAA"));
        assert!(!is_remote_or_virtual("./assets/a.png"));
    }
}

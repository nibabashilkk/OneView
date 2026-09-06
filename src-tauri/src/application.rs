use crate::encoding::{decode_text, encode_text};
use app_core::{CompatibilityLevel, CompatibilityReport, DocumentFormat, DocumentInput, RenderedDocument};
use markdown_core::MarkdownFormat;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DocumentError {
    #[error("文件不存在: {0}")]
    NotFound(String),
    #[error("不支持的文件格式: {0}")]
    Unsupported(String),
    #[error("读取文件失败: {0}")]
    Io(String),
    #[error("渲染失败: {0}")]
    Render(String),
}

/// Core document service deliberately owns only Markdown rendering.
///
/// Other text formats are decoded and returned as a safe plaintext fallback. Their
/// specialized renderers live in optional `.mdvplugin` packages and run in the
/// plugin Worker sandbox on the frontend.
pub struct DocumentService {
    markdown: MarkdownFormat,
}

impl Default for DocumentService {
    fn default() -> Self {
        Self { markdown: MarkdownFormat::new() }
    }
}

impl DocumentService {
    pub fn supports_path(&self, path: &Path) -> bool {
        is_markdown_path(path) || is_plain_text_path(path)
    }

    pub fn save(&self, raw_path: &str, content: &str, encoding: &str, line_ending: &str) -> Result<RenderedDocument, DocumentError> {
        let requested = Path::new(raw_path);
        if !requested.is_file() {
            return Err(DocumentError::NotFound(raw_path.to_string()));
        }
        if !is_markdown_path(requested) {
            return Err(DocumentError::Unsupported("只有 Markdown Core 支持直接编辑写回".into()));
        }
        let normalized = normalize_line_endings(content, line_ending);
        let bytes = encode_text(&normalized, encoding).map_err(DocumentError::Io)?;
        fs::write(requested, bytes).map_err(|e| DocumentError::Io(e.to_string()))?;
        self.open(raw_path)
    }

    pub fn open(&self, raw_path: &str) -> Result<RenderedDocument, DocumentError> {
        let requested = Path::new(raw_path);
        if !requested.is_file() {
            return Err(DocumentError::NotFound(raw_path.to_string()));
        }

        let path = canonical_or_original(requested);
        let metadata = fs::metadata(&path).map_err(|e| DocumentError::Io(e.to_string()))?;
        let bytes = fs::read(&path).map_err(|e| DocumentError::Io(e.to_string()))?;
        let decoded = decode_text(&bytes);
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Untitled.txt")
            .to_string();
        let modified_at_ms = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or_default();

        let input = DocumentInput {
            path: path.to_string_lossy().into_owned(),
            file_name,
            line_ending: detect_line_ending(&decoded.content).to_string(),
            content: decoded.content,
            encoding: decoded.encoding,
            modified_at_ms,
            size_bytes: metadata.len(),
        };

        if is_markdown_path(&path) {
            return self
                .markdown
                .render(&input)
                .map_err(|error| DocumentError::Render(error.to_string()));
        }

        Ok(render_plain_text(input))
    }
}

fn render_plain_text(input: DocumentInput) -> RenderedDocument {
    let line_count = input.content.lines().count().max(1);
    let character_count = input.content.chars().filter(|c| !c.is_whitespace()).count();
    let word_count = input.content.split_whitespace().count();
    let mut hasher = Sha256::new();
    hasher.update(input.path.as_bytes());
    let id = format!("doc-{:x}", hasher.finalize())[..20].to_string();
    let html = format!(
        "<div class=\"plugin-document-fallback\"><div class=\"structured-toolbar-hint\">Plain Text</div><pre class=\"structured-source-fallback\"><code>{}</code></pre></div>",
        escape_html(&input.content)
    );

    RenderedDocument {
        id,
        path: input.path,
        file_name: input.file_name,
        format: "text".into(),
        editable: false,
        encoding: input.encoding,
        line_ending: input.line_ending,
        source: input.content,
        html,
        outline: Vec::new(),
        compatibility: CompatibilityReport {
            level: CompatibilityLevel::SourceOnly,
            can_wysiwyg: false,
            semantic_safe: true,
            source_style_stable: true,
            issues: Vec::new(),
        },
        modified_at_ms: input.modified_at_ms,
        size_bytes: input.size_bytes,
        line_count,
        word_count,
        character_count,
        estimated_read_minutes: if word_count == 0 { 0 } else { ((word_count + 349) / 350).max(1) },
    }
}

fn is_markdown_path(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(),
        Some("md" | "markdown" | "mdown" | "mkd")
    )
}

fn is_plain_text_path(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(),
        Some("txt" | "text")
    )
}

fn canonical_or_original(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn detect_line_ending(content: &str) -> &'static str {
    if content.contains("\r\n") { "CRLF" }
    else if content.contains('\r') { "CR" }
    else { "LF" }
}

fn normalize_line_endings(content: &str, line_ending: &str) -> String {
    let lf = content.replace("\r\n", "\n").replace('\r', "\n");
    match line_ending {
        "CRLF" => lf.replace('\n', "\r\n"),
        "CR" => lf.replace('\n', "\r"),
        _ => lf,
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_and_restores_crlf() {
        assert_eq!(detect_line_ending("a\r\nb\r\n"), "CRLF");
        assert_eq!(normalize_line_endings("a\nb\n", "CRLF"), "a\r\nb\r\n");
    }

    #[test]
    fn markdown_is_the_only_core_rich_format() {
        assert!(is_markdown_path(Path::new("README.md")));
        assert!(!is_markdown_path(Path::new("data.json")));
        assert!(is_plain_text_path(Path::new("notes.txt")));
    }
}

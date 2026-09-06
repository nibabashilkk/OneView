use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct DocumentInput {
    pub path: String,
    pub file_name: String,
    pub content: String,
    pub encoding: String,
    pub line_ending: String,
    pub modified_at_ms: u64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineItem {
    pub id: String,
    pub level: u8,
    pub title: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompatibilityLevel {
    Safe,
    Guarded,
    SourceOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityIssue {
    pub code: String,
    pub level: CompatibilityLevel,
    pub count: usize,
    pub lines: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityReport {
    pub level: CompatibilityLevel,
    pub can_wysiwyg: bool,
    pub semantic_safe: bool,
    pub source_style_stable: bool,
    pub issues: Vec<CompatibilityIssue>,
}

impl CompatibilityReport {
    pub fn safe() -> Self {
        Self {
            level: CompatibilityLevel::Safe,
            can_wysiwyg: true,
            semantic_safe: true,
            source_style_stable: true,
            issues: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedDocument {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub format: String,
    pub editable: bool,
    pub encoding: String,
    pub line_ending: String,
    pub source: String,
    pub html: String,
    pub outline: Vec<OutlineItem>,
    pub compatibility: CompatibilityReport,
    pub modified_at_ms: u64,
    pub size_bytes: u64,
    pub line_count: usize,
    pub word_count: usize,
    pub character_count: usize,
    pub estimated_read_minutes: usize,
}

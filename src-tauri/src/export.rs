use std::{fs, path::Path};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("导出路径不能为空")]
    EmptyPath,
    #[error("创建导出目录失败: {0}")]
    CreateDirectory(String),
    #[error("写入导出文件失败: {0}")]
    Write(String),
}

pub fn write_text_file(path: &str, contents: &str) -> Result<(), ExportError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(ExportError::EmptyPath);
    }
    let path = Path::new(trimmed);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| ExportError::CreateDirectory(error.to_string()))?;
    }
    fs::write(path, contents.as_bytes()).map_err(|error| ExportError::Write(error.to_string()))
}

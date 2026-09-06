use serde::Serialize;
use std::{fs, io::{self, Read}, path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, Manager};
use thiserror::Error;

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedAsset {
    pub path: String,
    pub relative_path: String,
    pub file_name: String,
}

#[derive(Debug, Error)]
pub enum AssetImportError {
    #[error("无法确定 Markdown 所在目录")]
    MissingDocumentDirectory,
    #[error("图片文件不存在")]
    MissingSource,
    #[error("不支持的图片格式")]
    UnsupportedImage,
    #[error("图片过大，最大支持 25MB")]
    TooLarge,
    #[error("文件操作失败: {0}")]
    Io(#[from] io::Error),
}

pub fn import_image_path(app: &AppHandle, document_path: &str, source_path: &str) -> Result<ImportedAsset, AssetImportError> {
    let source = Path::new(source_path).canonicalize().map_err(|_| AssetImportError::MissingSource)?;
    if !source.is_file() { return Err(AssetImportError::MissingSource); }
    let metadata = fs::metadata(&source)?;
    if metadata.len() as usize > MAX_IMAGE_BYTES { return Err(AssetImportError::TooLarge); }
    let ext = normalized_extension(&source).ok_or(AssetImportError::UnsupportedImage)?;
    if !is_supported_extension(&ext) { return Err(AssetImportError::UnsupportedImage); }
    let mut prefix = vec![0u8; (metadata.len() as usize).min(512)];
    let mut file = fs::File::open(&source)?;
    let read = file.read(&mut prefix)?;
    prefix.truncate(read);
    let sniffed = sniff_extension(&prefix).ok_or(AssetImportError::UnsupportedImage)?;
    if !extensions_compatible(&ext, sniffed) { return Err(AssetImportError::UnsupportedImage); }

    let base = source.file_stem().and_then(|v| v.to_str()).unwrap_or("image");
    let destination = next_destination(document_path, base, &ext)?;
    fs::copy(&source, &destination)?;
    finalize(app, document_path, destination)
}

pub fn import_image_bytes(
    app: &AppHandle,
    document_path: &str,
    file_name: &str,
    bytes: Vec<u8>,
) -> Result<ImportedAsset, AssetImportError> {
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err(if bytes.len() > MAX_IMAGE_BYTES { AssetImportError::TooLarge } else { AssetImportError::UnsupportedImage });
    }
    let sniffed = sniff_extension(&bytes).ok_or(AssetImportError::UnsupportedImage)?;
    let requested_ext = Path::new(file_name).extension().and_then(|v| v.to_str()).map(|v| v.to_ascii_lowercase());
    if let Some(ext) = requested_ext.as_deref() {
        if is_supported_extension(ext) && !extensions_compatible(ext, sniffed) {
            return Err(AssetImportError::UnsupportedImage);
        }
    }
    let base = Path::new(file_name).file_stem().and_then(|v| v.to_str()).unwrap_or("pasted-image");
    let destination = next_destination(document_path, base, sniffed)?;
    fs::write(&destination, bytes)?;
    finalize(app, document_path, destination)
}

fn finalize(app: &AppHandle, document_path: &str, destination: PathBuf) -> Result<ImportedAsset, AssetImportError> {
    let normalized = destination.canonicalize().unwrap_or(destination);
    let _ = app.asset_protocol_scope().allow_file(&normalized);
    let parent = Path::new(document_path).parent().ok_or(AssetImportError::MissingDocumentDirectory)?;
    let relative = normalized.strip_prefix(parent).unwrap_or(&normalized);
    let relative_path = format!("./{}", relative.to_string_lossy().replace('\\', "/"));
    Ok(ImportedAsset {
        file_name: normalized.file_name().and_then(|v| v.to_str()).unwrap_or("image").to_string(),
        path: normalized.to_string_lossy().into_owned(),
        relative_path,
    })
}

fn next_destination(document_path: &str, raw_base: &str, ext: &str) -> Result<PathBuf, AssetImportError> {
    let parent = Path::new(document_path).parent().ok_or(AssetImportError::MissingDocumentDirectory)?;
    let assets = parent.join("assets");
    fs::create_dir_all(&assets)?;
    let base = sanitize_stem(raw_base);
    let mut candidate = assets.join(format!("{base}.{ext}"));
    if !candidate.exists() { return Ok(candidate); }
    for index in 2..=9999 {
        candidate = assets.join(format!("{base}-{index}.{ext}"));
        if !candidate.exists() { return Ok(candidate); }
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    Ok(assets.join(format!("{base}-{stamp}.{ext}")))
}

fn sanitize_stem(value: &str) -> String {
    let mut result = String::with_capacity(value.len().min(64));
    for ch in value.chars().take(64) {
        if ch.is_alphanumeric() || matches!(ch, '-' | '_' | '.') { result.push(ch); }
        else if !result.ends_with('-') { result.push('-'); }
    }
    let trimmed = result.trim_matches(|ch| ch == '-' || ch == '.').to_string();
    if trimmed.is_empty() { "image".to_string() } else { trimmed }
}

fn normalized_extension(path: &Path) -> Option<String> {
    path.extension().and_then(|v| v.to_str()).map(|v| v.to_ascii_lowercase())
}

fn is_supported_extension(ext: &str) -> bool {
    matches!(ext, "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" | "avif")
}

fn extensions_compatible(requested: &str, sniffed: &str) -> bool {
    requested == sniffed || (matches!(requested, "jpg" | "jpeg") && matches!(sniffed, "jpg" | "jpeg"))
}

fn sniff_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { return Some("png"); }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) { return Some("jpg"); }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { return Some("gif"); }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { return Some("webp"); }
    if bytes.starts_with(b"BM") { return Some("bmp"); }
    if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" && (&bytes[8..12] == b"avif" || &bytes[8..12] == b"avis") { return Some("avif"); }
    let prefix = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]).trim_start().to_ascii_lowercase();
    if prefix.starts_with("<svg") || (prefix.starts_with("<?xml") && prefix.contains("<svg")) { return Some("svg"); }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_asset_names() {
        assert_eq!(sanitize_stem("hello world/../../a"), "hello-world-..-..-a");
        assert_eq!(sanitize_stem("***"), "image");
    }

    #[test]
    fn detects_png_and_jpeg() {
        assert_eq!(sniff_extension(b"\x89PNG\r\n\x1a\nrest"), Some("png"));
        assert_eq!(sniff_extension(&[0xff, 0xd8, 0xff, 0xee]), Some("jpg"));
    }
}

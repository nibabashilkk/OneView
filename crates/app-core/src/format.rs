use crate::{DocumentInput, RenderedDocument};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("unsupported document format")]
    UnsupportedFormat,
    #[error("render failed: {0}")]
    Render(String),
}

pub trait DocumentFormat: Send + Sync {
    fn id(&self) -> &'static str;
    fn extensions(&self) -> &'static [&'static str];
    fn render(&self, input: &DocumentInput) -> Result<RenderedDocument, CoreError>;

    fn supports_extension(&self, extension: &str) -> bool {
        self.extensions().iter().any(|item| item.eq_ignore_ascii_case(extension))
    }
}

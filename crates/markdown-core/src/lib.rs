mod compatibility;

pub use compatibility::analyze_compatibility;

use app_core::{CoreError, DocumentFormat, DocumentInput, OutlineItem, RenderedDocument};
use pulldown_cmark::{html, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub struct MarkdownFormat;

impl MarkdownFormat {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MarkdownFormat {
    fn default() -> Self {
        Self::new()
    }
}

impl DocumentFormat for MarkdownFormat {
    fn id(&self) -> &'static str {
        "markdown"
    }

    fn extensions(&self) -> &'static [&'static str] {
        &["md", "markdown", "mdown", "mkd"]
    }

    fn render(&self, input: &DocumentInput) -> Result<RenderedDocument, CoreError> {
        let options = markdown_options();
        let outline = extract_outline(&input.content, options);
        let stats = document_stats(&input.content, options);
        let compatibility = analyze_compatibility(&input.content, options);
        let mut heading_index = 0usize;

        let parser = Parser::new_ext(&input.content, options).map(|event| {
            transform_event(event, &outline, &mut heading_index)
        });

        let mut rendered = String::with_capacity(input.content.len() + input.content.len() / 3);
        html::push_html(&mut rendered, parser);

        Ok(RenderedDocument {
            id: document_id(&input.path),
            path: input.path.clone(),
            file_name: input.file_name.clone(),
            format: self.id().to_string(),
            editable: true,
            encoding: input.encoding.clone(),
            line_ending: input.line_ending.clone(),
            source: input.content.clone(),
            html: rendered,
            outline,
            compatibility,
            modified_at_ms: input.modified_at_ms,
            size_bytes: input.size_bytes,
            line_count: input.content.lines().count().max(1),
            word_count: stats.word_count,
            character_count: stats.character_count,
            estimated_read_minutes: stats.estimated_read_minutes,
        })
    }
}


pub fn analyze_markdown_compatibility(content: &str) -> app_core::CompatibilityReport {
    analyze_compatibility(content, markdown_options())
}

pub fn extract_plain_text(content: &str) -> String {
    let options = markdown_options();
    let mut out = String::with_capacity(content.len());
    let mut last_newline = false;
    for event in Parser::new_ext(content, options) {
        match event {
            Event::Text(value) | Event::Code(value) | Event::InlineMath(value) | Event::DisplayMath(value) => {
                out.push_str(&value);
                last_newline = false;
            }
            Event::TaskListMarker(checked) => {
                out.push_str(if checked { "[x] " } else { "[ ] " });
                last_newline = false;
            }
            Event::SoftBreak | Event::HardBreak => {
                if !last_newline { out.push('\n'); last_newline = true; }
            }
            Event::End(TagEnd::Paragraph)
            | Event::End(TagEnd::Heading(_))
            | Event::End(TagEnd::CodeBlock)
            | Event::End(TagEnd::Item) => {
                if !last_newline { out.push('\n'); last_newline = true; }
            }
            _ => {}
        }
    }
    out.trim().to_string()
}

pub fn parse_markdown(content: &str) -> Parser<'_> {
    Parser::new_ext(content, markdown_options())
}

fn markdown_options() -> Options {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_SMART_PUNCTUATION);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    options.insert(Options::ENABLE_MATH);
    options.insert(Options::ENABLE_GFM);
    options
}

fn transform_event<'a>(
    event: Event<'a>,
    outline: &[OutlineItem],
    heading_index: &mut usize,
) -> Event<'a> {
    match event {
        // 本地文档默认不信任 raw HTML。Markdown 的常规结构仍由 pulldown-cmark 生成 HTML。
        Event::Html(value) | Event::InlineHtml(value) => Event::Text(value),
        Event::InlineMath(value) => Event::Html(
            format!(
                "<span class=\"math-inline\" data-math=\"inline\">{}</span>",
                escape_html(&value)
            )
            .into(),
        ),
        Event::DisplayMath(value) => Event::Html(
            format!(
                "<div class=\"math-display\" data-math=\"display\">{}</div>",
                escape_html(&value)
            )
            .into(),
        ),
        Event::Start(Tag::Heading {
            level,
            id: _,
            classes,
            attrs,
        }) => {
            let stable_id = outline.get(*heading_index).map(|item| item.id.clone());
            *heading_index += 1;
            Event::Start(Tag::Heading {
                level,
                id: stable_id.map(Into::into),
                classes,
                attrs,
            })
        }
        other => other,
    }
}

fn extract_outline(content: &str, options: Options) -> Vec<OutlineItem> {
    let mut result = Vec::new();
    let mut used = HashMap::<String, usize>::new();
    let mut current: Option<(HeadingLevel, Option<String>, String)> = None;

    for event in Parser::new_ext(content, options) {
        match event {
            Event::Start(Tag::Heading { level, id, .. }) => {
                current = Some((level, id.map(|value| value.to_string()), String::new()));
            }
            Event::Text(value) | Event::Code(value) | Event::InlineMath(value) => {
                if let Some((_, _, title)) = current.as_mut() {
                    title.push_str(&value);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if let Some((_, _, title)) = current.as_mut() {
                    title.push(' ');
                }
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some((level, explicit_id, title)) = current.take() {
                    let title = title.trim().to_string();
                    if title.is_empty() {
                        continue;
                    }

                    let base = explicit_id
                        .filter(|value| !value.trim().is_empty())
                        .unwrap_or_else(|| slugify(&title));
                    let id = dedupe_id(base, &mut used);
                    result.push(OutlineItem {
                        id,
                        level: heading_level(level),
                        title,
                    });
                }
            }
            _ => {}
        }
    }

    result
}


#[derive(Debug, Clone, Copy)]
struct DocumentStats {
    word_count: usize,
    character_count: usize,
    estimated_read_minutes: usize,
}

fn document_stats(content: &str, options: Options) -> DocumentStats {
    let mut visible = String::with_capacity(content.len());
    for event in Parser::new_ext(content, options) {
        match event {
            Event::Text(value) | Event::Code(value) | Event::InlineMath(value) | Event::DisplayMath(value) => {
                visible.push_str(&value);
                visible.push(' ');
            }
            Event::SoftBreak | Event::HardBreak => visible.push(' '),
            _ => {}
        }
    }

    let character_count = visible.chars().filter(|ch| !ch.is_whitespace()).count();
    let word_count = count_reading_units(&visible);
    let estimated_read_minutes = if word_count == 0 { 0 } else { ((word_count + 349) / 350).max(1) };
    DocumentStats { word_count, character_count, estimated_read_minutes }
}

fn count_reading_units(text: &str) -> usize {
    let mut count = 0usize;
    let mut in_word = false;
    for ch in text.chars() {
        if is_cjk(ch) {
            count += 1;
            in_word = false;
        } else if ch.is_alphanumeric() {
            if !in_word {
                count += 1;
                in_word = true;
            }
        } else {
            in_word = false;
        }
    }
    count
}

fn is_cjk(ch: char) -> bool {
    matches!(ch as u32,
        0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xF900..=0xFAFF |
        0x3040..=0x30FF | 0xAC00..=0xD7AF
    )
}

fn heading_level(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

fn dedupe_id(base: String, used: &mut HashMap<String, usize>) -> String {
    let count = used.entry(base.clone()).or_insert(0);
    let id = if *count == 0 {
        base
    } else {
        format!("{}-{}", base, *count)
    };
    *count += 1;
    id
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut dash = false;

    for ch in input.chars() {
        if ch.is_alphanumeric() || ch == '_' || ch > '\u{7f}' {
            out.push(ch.to_ascii_lowercase());
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }

    while out.ends_with('-') {
        out.pop();
    }

    if out.is_empty() {
        "section".to_string()
    } else {
        out
    }
}

fn escape_html(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            _ => output.push(ch),
        }
    }
    output
}

fn document_id(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let digest = hasher.finalize();
    format!("doc-{:x}", digest)[..20].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(content: &str) -> DocumentInput {
        DocumentInput {
            path: "x.md".into(),
            file_name: "x.md".into(),
            content: content.into(),
            encoding: "UTF-8".into(),
            line_ending: "LF".into(),
            modified_at_ms: 0,
            size_bytes: content.len() as u64,
        }
    }

    #[test]
    fn extracts_atx_and_setext_headings_with_stable_ids() {
        let result = MarkdownFormat.render(&input(
            "# Hello **world**\n\nSecond title\n------------\n\n# Hello world\n",
        ))
        .unwrap();

        assert_eq!(result.outline.len(), 3);
        assert_eq!(result.outline[0].title, "Hello world");
        assert_eq!(result.outline[0].id, "hello-world");
        assert_eq!(result.outline[1].level, 2);
        assert_eq!(result.outline[2].id, "hello-world-1");
        assert!(result.html.contains("id=\"hello-world\""));
    }

    #[test]
    fn raw_html_is_not_executed() {
        let result = MarkdownFormat
            .render(&input("<script>alert(1)</script>"))
            .unwrap();
        assert!(!result.html.contains("<script>"));
        assert!(result.html.contains("&lt;script&gt;"));
    }

    #[test]
    fn computes_mixed_language_document_stats() {
        let result = MarkdownFormat
            .render(&input("# 标题\n\n你好 world 123.\n"))
            .unwrap();
        assert!(result.word_count >= 5);
        assert!(result.character_count >= 10);
        assert_eq!(result.estimated_read_minutes, 1);
    }

    #[test]
    fn emits_math_placeholders_for_katex() {
        let result = MarkdownFormat
            .render(&input("Inline $a^2+b^2$\n\n$$\\int_0^1 x dx$$"))
            .unwrap();
        assert!(result.html.contains("class=\"math-inline\""));
        assert!(result.html.contains("class=\"math-display\""));
        assert!(result.html.contains("\\int_0^1 x dx"));
    }
}


#[cfg(test)]
mod plain_text_tests {
    use super::extract_plain_text;

    #[test]
    fn extract_plain_text_is_readable() {
        let value = extract_plain_text("# Hello **world**\n\n- one\n- two\n");
        assert!(value.contains("Hello world"));
        assert!(value.contains("one"));
        assert!(value.contains("two"));
    }
}

use app_core::{CompatibilityIssue, CompatibilityLevel, CompatibilityReport};
use pulldown_cmark::{Event, Options, Parser};
use std::collections::BTreeMap;

const MAX_REPORTED_LINES: usize = 8;

#[derive(Debug, Clone)]
struct Finding {
    level: CompatibilityLevel,
    lines: Vec<usize>,
    count: usize,
}

pub fn analyze_compatibility(source: &str, options: Options) -> CompatibilityReport {
    let mut findings = BTreeMap::<String, Finding>::new();
    let lines: Vec<&str> = source.lines().collect();

    detect_front_matter(&lines, &mut findings);
    detect_source_style(&lines, &mut findings);
    detect_parser_features(source, options, &mut findings);

    let issues: Vec<CompatibilityIssue> = findings
        .into_iter()
        .map(|(code, finding)| CompatibilityIssue {
            code,
            level: finding.level,
            count: finding.count,
            lines: finding.lines,
        })
        .collect();

    let has_source_only = issues
        .iter()
        .any(|issue| issue.level == CompatibilityLevel::SourceOnly);
    let has_guarded = issues
        .iter()
        .any(|issue| issue.level == CompatibilityLevel::Guarded);

    CompatibilityReport {
        level: if has_source_only {
            CompatibilityLevel::SourceOnly
        } else if has_guarded {
            CompatibilityLevel::Guarded
        } else {
            CompatibilityLevel::Safe
        },
        can_wysiwyg: !has_source_only,
        semantic_safe: !has_source_only,
        source_style_stable: !has_source_only && !has_guarded,
        issues,
    }
}

fn detect_parser_features(
    source: &str,
    options: Options,
    findings: &mut BTreeMap<String, Finding>,
) {
    for (event, range) in Parser::new_ext(source, options).into_offset_iter() {
        let line = line_for_offset(source, range.start);
        match event {
            Event::Html(_) | Event::InlineHtml(_) => {
                add(findings, "rawHtml", CompatibilityLevel::SourceOnly, line)
            }
            Event::FootnoteReference(_) => {
                add(findings, "footnotes", CompatibilityLevel::SourceOnly, line)
            }
            _ => {}
        }
    }
}

fn detect_front_matter(lines: &[&str], findings: &mut BTreeMap<String, Finding>) {
    let Some(first) = lines.first().map(|line| line.trim_start_matches('\u{feff}').trim()) else {
        return;
    };

    if first == "+++" {
        if lines.iter().skip(1).take(200).any(|line| line.trim() == "+++") {
            add(findings, "frontMatter", CompatibilityLevel::SourceOnly, 1);
        }
        return;
    }

    if first != "---" {
        return;
    }

    let closing = lines
        .iter()
        .enumerate()
        .skip(1)
        .take(200)
        .find(|(_, line)| line.trim() == "---")
        .map(|(index, _)| index);
    let Some(closing) = closing else { return };

    // 避免把“文件开头的一条水平线 + 后文另一条水平线”误判为 YAML Front Matter。
    let body = &lines[1..closing];
    let yaml_like = body.iter().any(|line| {
        let trimmed = line.trim();
        !trimmed.starts_with('#')
            && trimmed
                .split_once(':')
                .map(|(key, _)| {
                    !key.trim().is_empty()
                        && key
                            .chars()
                            .all(|ch| ch.is_alphanumeric() || ch == '_' || ch == '-' || ch == ' ')
                })
                .unwrap_or(false)
    });
    if yaml_like {
        add(findings, "frontMatter", CompatibilityLevel::SourceOnly, 1);
    }
}

fn detect_source_style(lines: &[&str], findings: &mut BTreeMap<String, Finding>) {
    let mut in_fence = false;
    let mut fence_char = '\0';
    let mut fence_len = 0usize;

    for (index, line) in lines.iter().enumerate() {
        let line_no = index + 1;
        let trimmed = line.trim_start();

        if let Some((ch, len)) = fence_start(trimmed) {
            if !in_fence {
                in_fence = true;
                fence_char = ch;
                fence_len = len;
                if ch == '~' {
                    add(findings, "tildeFence", CompatibilityLevel::Guarded, line_no);
                }
                if len > 3 {
                    add(findings, "longFence", CompatibilityLevel::Guarded, line_no);
                }
            } else if ch == fence_char && len >= fence_len {
                in_fence = false;
            }
            continue;
        }

        if in_fence {
            continue;
        }

        if index + 1 < lines.len()
            && !line.trim().is_empty()
            && is_setext_underline(lines[index + 1])
        {
            add(findings, "setextHeading", CompatibilityLevel::Guarded, line_no);
        }

        if is_reference_definition(line) {
            add(
                findings,
                "referenceLinks",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if is_gfm_table_separator(line) {
            add(
                findings,
                "tableFormatting",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if trimmed.starts_with("* ") || trimmed.starts_with("+ ") {
            add(
                findings,
                "listMarkerStyle",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }
        if starts_ordered_paren(trimmed) {
            add(
                findings,
                "orderedListDelimiter",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if line.starts_with("    ") && !line.trim().is_empty() {
            add(
                findings,
                "indentedCode",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if has_closing_heading_hashes(trimmed) {
            add(
                findings,
                "closingHeadingHashes",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if has_heading_attributes(trimmed) {
            add(
                findings,
                "headingAttributes",
                CompatibilityLevel::SourceOnly,
                line_no,
            );
        }

        if contains_autolink(line) {
            add(findings, "autolink", CompatibilityLevel::Guarded, line_no);
        }

        if contains_entity(line) {
            add(findings, "htmlEntity", CompatibilityLevel::Guarded, line_no);
        }

        if contains_escape_style(line) {
            add(
                findings,
                "escapedPunctuation",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if line.ends_with("  ") || line.ends_with('\\') {
            add(
                findings,
                "hardBreakStyle",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if is_noncanonical_rule(trimmed) {
            add(
                findings,
                "thematicBreakStyle",
                CompatibilityLevel::Guarded,
                line_no,
            );
        }

        if trimmed.starts_with("<!--") || trimmed.contains("<!--") {
            add(
                findings,
                "rawHtml",
                CompatibilityLevel::SourceOnly,
                line_no,
            );
        }

        if trimmed.starts_with("[^") && trimmed.contains("]:") {
            add(
                findings,
                "footnotes",
                CompatibilityLevel::SourceOnly,
                line_no,
            );
        }
    }
}

fn add(
    findings: &mut BTreeMap<String, Finding>,
    code: &str,
    level: CompatibilityLevel,
    line: usize,
) {
    let finding = findings.entry(code.to_string()).or_insert(Finding {
        level,
        lines: Vec::new(),
        count: 0,
    });
    if level_rank(level) > level_rank(finding.level) {
        finding.level = level;
    }
    finding.count += 1;
    if finding.lines.len() < MAX_REPORTED_LINES && !finding.lines.contains(&line) {
        finding.lines.push(line);
    }
}

fn level_rank(level: CompatibilityLevel) -> u8 {
    match level {
        CompatibilityLevel::Safe => 0,
        CompatibilityLevel::Guarded => 1,
        CompatibilityLevel::SourceOnly => 2,
    }
}

fn line_for_offset(source: &str, offset: usize) -> usize {
    source[..offset.min(source.len())]
        .bytes()
        .filter(|byte| *byte == b'\n')
        .count()
        + 1
}

fn fence_start(trimmed: &str) -> Option<(char, usize)> {
    let first = trimmed.chars().next()?;
    if first != '`' && first != '~' {
        return None;
    }
    let len = trimmed.chars().take_while(|ch| *ch == first).count();
    (len >= 3).then_some((first, len))
}

fn is_setext_underline(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.len() >= 3
        && (trimmed.chars().all(|ch| ch == '=') || trimmed.chars().all(|ch| ch == '-'))
}

fn is_reference_definition(line: &str) -> bool {
    let trimmed = line.trim_start();
    if !trimmed.starts_with('[') || trimmed.starts_with("[^") {
        return false;
    }
    let Some(close) = trimmed.find("]:") else { return false };
    close > 1 && !trimmed[1..close].contains(']')
}

fn is_gfm_table_separator(line: &str) -> bool {
    let trimmed = line.trim();
    if !trimmed.contains('-') || !trimmed.contains('|') {
        return false;
    }
    let cells: Vec<&str> = trimmed.trim_matches('|').split('|').collect();
    cells.len() >= 2
        && cells.iter().all(|cell| {
            let cell = cell.trim().trim_matches(':').trim();
            cell.len() >= 3 && cell.chars().all(|ch| ch == '-')
        })
}

fn starts_ordered_paren(trimmed: &str) -> bool {
    let digits = trimmed.chars().take_while(|ch| ch.is_ascii_digit()).count();
    digits > 0 && trimmed[digits..].starts_with(") ")
}

fn has_closing_heading_hashes(trimmed: &str) -> bool {
    if !trimmed.starts_with('#') {
        return false;
    }
    let hashes = trimmed.chars().take_while(|ch| *ch == '#').count();
    hashes <= 6 && trimmed[hashes..].starts_with(' ') && trimmed.trim_end().ends_with('#')
}

fn has_heading_attributes(trimmed: &str) -> bool {
    if !trimmed.starts_with('#') {
        return false;
    }
    let hashes = trimmed.chars().take_while(|ch| *ch == '#').count();
    if hashes == 0 || hashes > 6 || !trimmed[hashes..].starts_with(' ') {
        return false;
    }
    let line = trimmed.trim_end().trim_end_matches('#').trim_end();
    let Some(open) = line.rfind(" {") else { return false };
    let attrs = &line[open + 2..];
    attrs.ends_with('}')
        && attrs[..attrs.len().saturating_sub(1)]
            .split_whitespace()
            .any(|token| token.starts_with('#') || token.starts_with('.') || token.contains('='))
}

fn contains_autolink(line: &str) -> bool {
    line.contains("<http://")
        || line.contains("<https://")
        || line.contains("<mailto:")
        || (line.contains('<') && line.contains('@') && line.contains('>'))
}

fn contains_entity(line: &str) -> bool {
    let bytes = line.as_bytes();
    for amp in line.match_indices('&').map(|(index, _)| index) {
        let rest = &bytes[amp + 1..bytes.len().min(amp + 18)];
        if let Some(end) = rest.iter().position(|byte| *byte == b';') {
            let body = &rest[..end];
            if !body.is_empty()
                && (body[0] == b'#' || body.iter().all(|byte| byte.is_ascii_alphanumeric()))
            {
                return true;
            }
        }
    }
    false
}

fn contains_escape_style(line: &str) -> bool {
    const ESCAPABLE: &str = r#"\\`*{}[]()#+-.!_>~|"#;
    line.char_indices().any(|(index, ch)| {
        if ch != '\\' {
            return false;
        }
        line[index + ch.len_utf8()..]
            .chars()
            .next()
            .map(|next| ESCAPABLE.contains(next))
            .unwrap_or(false)
    })
}

fn is_noncanonical_rule(trimmed: &str) -> bool {
    if trimmed.len() < 3 {
        return false;
    }
    let compact: String = trimmed.chars().filter(|ch| !ch.is_whitespace()).collect();
    (compact.chars().all(|ch| ch == '*') || compact.chars().all(|ch| ch == '_'))
        && compact.len() >= 3
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Options {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
        options.insert(Options::ENABLE_MATH);
        options.insert(Options::ENABLE_GFM);
        options
    }

    #[test]
    fn plain_markdown_is_safe() {
        let report = analyze_compatibility("# Title\n\nA **bold** paragraph.\n", options());
        assert_eq!(report.level, CompatibilityLevel::Safe);
        assert!(report.can_wysiwyg);
    }

    #[test]
    fn style_variants_are_guarded() {
        let report = analyze_compatibility("Title\n=====\n\n~~~js\nalert(1)\n~~~\n", options());
        assert_eq!(report.level, CompatibilityLevel::Guarded);
        assert!(report.can_wysiwyg);
        assert!(!report.source_style_stable);
    }

    #[test]
    fn heading_attributes_require_source_mode() {
        let report = analyze_compatibility("## Install {#install .compact}\n", options());
        assert_eq!(report.level, CompatibilityLevel::SourceOnly);
        assert!(report.issues.iter().any(|issue| issue.code == "headingAttributes"));
    }

    #[test]
    fn raw_html_and_front_matter_require_source_mode() {
        let source = "---\ntitle: Demo\n---\n\n<div>hello</div>\n";
        let report = analyze_compatibility(source, options());
        assert_eq!(report.level, CompatibilityLevel::SourceOnly);
        assert!(!report.can_wysiwyg);
        assert!(report.issues.iter().any(|issue| issue.code == "frontMatter"));
        assert!(report.issues.iter().any(|issue| issue.code == "rawHtml"));
    }
}

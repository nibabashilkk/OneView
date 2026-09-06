use app_core::{DocumentFormat, DocumentInput};
use markdown_core::MarkdownFormat;
use std::time::{Duration, Instant};

const TARGETS: &[usize] = &[100 * 1024, 1024 * 1024, 10 * 1024 * 1024];
const RUNS: usize = 5;

fn main() {
    println!("Markdown Viewer core render benchmark");
    println!("runs per size: {RUNS}\n");
    println!("{:>10}  {:>10}  {:>10}  {:>10}  {:>10}", "source", "median", "best", "html", "headings");

    let format = MarkdownFormat::new();
    for &target in TARGETS {
        let source = generated_markdown(target);
        let input = DocumentInput {
            path: format!("benchmark-{target}.md"),
            file_name: "benchmark.md".into(),
            content: source.clone(),
            encoding: "UTF-8".into(),
            line_ending: "LF".into(),
            modified_at_ms: 0,
            size_bytes: source.len() as u64,
        };

        let mut durations = Vec::with_capacity(RUNS);
        let mut html_bytes = 0usize;
        let mut headings = 0usize;
        for _ in 0..RUNS {
            let started = Instant::now();
            let rendered = format.render(&input).expect("benchmark render must succeed");
            durations.push(started.elapsed());
            html_bytes = rendered.html.len();
            headings = rendered.outline.len();
        }
        durations.sort_unstable();
        let median = durations[RUNS / 2];
        let best = durations[0];
        println!(
            "{:>10}  {:>10}  {:>10}  {:>10}  {:>10}",
            human_bytes(source.len()),
            human_duration(median),
            human_duration(best),
            human_bytes(html_bytes),
            headings,
        );
    }
}

fn generated_markdown(target_bytes: usize) -> String {
    let section = r#"## Section {n}

This is a benchmark paragraph with **bold**, *italic*, `inline code`, [link](https://example.com), and 中文内容。

- item one
- item two
- [x] task complete

```rust
fn example(value: usize) -> usize {{ value + {n} }}
```

| Name | Value | Status |
| --- | ---: | :---: |
| row | {n} | ✅ |

> benchmark quote for markdown rendering.

"#;
    let mut out = String::with_capacity(target_bytes + 4096);
    out.push_str("# Benchmark Document\n\n");
    let mut n = 0usize;
    while out.len() < target_bytes {
        out.push_str(&section.replace("{n}", &n.to_string()));
        n += 1;
    }
    out
}

fn human_bytes(bytes: usize) -> String {
    if bytes >= 1024 * 1024 { format!("{:.1}MB", bytes as f64 / 1024.0 / 1024.0) }
    else { format!("{:.0}KB", bytes as f64 / 1024.0) }
}

fn human_duration(value: Duration) -> String {
    if value.as_millis() >= 1000 { format!("{:.2}s", value.as_secs_f64()) }
    else { format!("{:.1}ms", value.as_secs_f64() * 1000.0) }
}

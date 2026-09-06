# v0.17.9 Fixes

## WYSIWYG code highlighting

- Added token-level syntax highlighting inside editable ProseMirror code blocks.
- Reused the same Highlight.js language registry as the read-only Markdown renderer.
- Supported aliases include JS/TS, Python, Rust, Go, Java, C/C++, C#, HTML/XML, CSS, JSON, YAML, SQL, Bash and Markdown.
- Code highlighting is implemented with ProseMirror decorations instead of replacing `innerHTML`, so cursor/selection and undo history remain stable while typing.
- Added a compact language label and copy action to each fenced code block.
- Added separate light/dark syntax palettes and kept the code surface consistent with the active reader theme.
- Blocks above 40 KB intentionally stay plain-text in the editor to avoid blocking the WebView on every keystroke.

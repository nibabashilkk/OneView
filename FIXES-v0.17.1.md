# v0.17.1 — Pure WYSIWYG

- Removed the Markdown source toggle from the top bar.
- Removed the SourceEditor component and source-mode command palette entries.
- Editor modes are now only `wysiwyg` and `read` (safe preview).
- Legacy external `source` startup actions are mapped to visual editing where compatible.
- Source-only compatibility issues now explain that the document is preview-only.
- Unsafe WYSIWYG serialization is blocked without modifying the original file.

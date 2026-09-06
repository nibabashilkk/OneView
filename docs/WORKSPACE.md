# Workspace — Markdown Core + Plugin Formats

## Scope

v0.21 keeps the selected folder as a bounded text-document workspace without turning the WebView into a general-purpose filesystem browser. The frontend selects a root path; Rust owns traversal, filtering, README discovery, text indexing and cross-file search.

The important change is that Rust no longer owns a hard-coded developer-format registry.

## Format eligibility

Core always contributes:

| Format | Extensions | View | Edit |
|---|---|---|---|
| Markdown | `.md`, `.markdown`, `.mdown`, `.mkd` | Rich / visual editor | Yes |
| Plain Text | `.txt`, `.text` | Safe plaintext | No |

Every enabled compatible Document Worker (`runtime.role = "document"`) can additionally contribute:

```json
{
  "contributes": {
    "documentFormats": [
      { "id": "json", "label": "JSON", "extensions": ["json"] }
    ]
  }
}
```

The frontend passes only normalized `{ id, extensions }` specs into `open_workspace` / `search_workspace`. Rust uses them to decide which text files enter the bounded tree/index; it does **not** execute or import the plugin parser.

Official optional plugins currently provide JSON, YAML, CSV, TOML, LOG and DIFF/PATCH. Disabling one removes that format from the next Workspace refresh/search and from normal file-open discovery. An already-routed document still has the host plaintext DTO as a renderer-failure/disable fallback.

Core extensions cannot be overridden by plugin input, and duplicate plugin extensions are deterministically assigned to one format.

## Scan policy

The Rust workspace service canonicalizes the selected root and applies bounded traversal:

- maximum tree depth: 10
- maximum discovered entries: 5,000
- symlinks are ignored
- ignored directories include `.git`, `.svn`, `.hg`, `node_modules`, `target`, `dist`, `build`, `.next`, `.nuxt`, `.venv`, `venv`, `__pycache__`, `.idea`, `.vscode`
- directories with no currently eligible descendant documents are removed from the returned tree
- README discovery prefers the shallowest supported Markdown README path

The UI can collapse directories and filter the returned tree locally; filtering does not request broader filesystem access.

## Incremental in-memory index cache

`WorkspaceIndexCache` stores:

- the bounded eligible-file index
- relative path / format / size / modified time metadata
- decoded text after a file is first searched
- a normalized format signature for the active Core + plugin extension set

A repeated search can reuse decoded text. When the active plugin format signature changes, the cache rescans before search so stale plugin files do not remain in the index. Manual refresh still reuses decoded text for files whose `size + mtime` did not change.

## Global search

Workspace search is line-oriented and case-insensitive. It scans only the currently eligible formats and applies limits:

- files larger than 2 MiB are skipped
- default result limit: 200; hard maximum: 500
- text decoding reuses `text-core`
- each match returns one line of context before and after when available
- results are grouped by file in the UI

Each response reports files scanned, cache hits, skipped large files, elapsed time and truncation state.

## Persistence

The workspace snapshot schema remains v2 and persists current project root, recent projects, open tabs, active tab, scroll positions and recent files. Plugin format eligibility is not persisted into the workspace snapshot; it is derived from the currently installed/enabled plugin registry on startup.

# v0.17.6 — structured document open reliability

Structured documents no longer fail the whole `open_document` command merely because their parser rejects the payload. JSON/YAML/TOML/CSV render their normal structured view when valid and a safe escaped raw-source fallback with parser diagnostics when invalid.

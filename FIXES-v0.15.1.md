# v0.15.1 compile fixes

This patch fixes the Rust compile failures reported from v0.15.0:

- `updates.rs`: use `std::result::Result` in the Serde `Serialize` implementation so the local `Result<T>` alias does not shadow Serde's two-parameter result type.
- `updates.rs`: parse the runtime updater endpoint as `tauri::Url` before calling `UpdaterBuilder::endpoints`.
- `startup.rs`: explicitly type the path collection as `Vec<String>`.
- `resources.rs`: destructure `ResourceRequest` and own the fragment before moving `raw`/`kind` into the response.
- `updates.rs`: structure platform restart branches so non-Windows builds do not warn about unreachable `Ok(())`.
- `release.rs`: remove the unused `Manager` import.

Run locally:

```bash
npm install
npm run tauri dev
```

For a Rust-only check:

```bash
cargo check --workspace
```

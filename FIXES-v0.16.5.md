# v0.16.5 — Remove macOS Quick Look

The macOS Quick Look Preview Extension has been removed intentionally.

Removed:

- `platform/macos-quicklook/`
- Xcode Quick Look project and Swift bridge
- Quick Look entitlements and build/verification scripts
- Tauri macOS `beforeBundleCommand` for building the extension
- `.appex` embedding in `Contents/PlugIns`

Kept:

- macOS main-app file associations and normal file opening
- Windows Explorer Preview Handler
- shared `preview-core` used by Windows preview and diagnostics/CLI

Result: macOS `.app/.dmg` packaging is simpler and no longer compiles a Quick Look extension.

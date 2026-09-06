# v0.21.6 — Remove Windows Explorer Preview Handler

## Why

Explorer Preview Pane is outside the core Markdown Viewer workflow and carried a disproportionate maintenance/build cost: native COM DLL, CMake, registry lifecycle, Preview Host isolation and architecture-specific packaging.

## Removed

- `platform/windows-preview/`
- `crates/preview-core/`
- `tools/preview-renderer/`
- `docs/SYSTEM_PREVIEW.md`
- Preview DLL Tauri resource/before-bundle build
- Preview Handler CLSID / PreviewHandlers / shellex registration in NSIS

## Kept

- normal file open
- Windows Default Apps registration
- Explorer context-menu actions (`copy-rich`, `export-html`, `print`)
- macOS file associations / Open With

Windows packaging is now ordinary Tauri + NSIS plus lightweight registry hooks.

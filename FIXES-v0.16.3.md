# v0.16.4 macOS Quick Look / Xcode 26 build fix

## Root cause

Xcode 26.4.1 rejects `override func providePreview(...)` in the Quick Look data provider because `providePreview` is implemented as the `QLPreviewingController` protocol requirement; it is not a superclass method on `QLPreviewProvider` to override.

## Changes

- Removed the invalid `override` keyword from `PreviewProvider.providePreview`.
- Kept `PreviewProvider: QLPreviewProvider, QLPreviewingController` and the data-based Quick Look `Info.plist` configuration.
- Replaced `NSApp.effectiveAppearance` with `NSAppearance.currentDrawing()` so the extension does not depend on the host app singleton.
- Removed the unreachable wildcard branch in `preview-core`'s exhaustive `pulldown_cmark::Event` match.
- Bumped Quick Look extension build number to 14 and product version to 0.16.4.

## Build

```bash
npm install
npm run tauri build -- --config src-tauri/tauri.release.conf.json
```

The macOS-specific Tauri config still invokes `platform/macos-quicklook/build-extension.sh` and embeds the resulting `.appex` into the app bundle.

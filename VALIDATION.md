# oneView v0.21.10 Validation

## Branding / icon integration

- Product display name: `oneView`.
- `package.json`, Tauri config and Cargo package version are all `0.21.10`.
- System icon resources regenerated from the same 1024px Soft UI source: PNG / ICO / ICNS.
- Windows shell/default-app labels and executable references use `oneView`; installer cleanup removes legacy Markdown Viewer registry entries.
- Existing bundle identifier, `markdownViewer` plugin API and `com.markdownviewer.*` plugin IDs intentionally remain stable for compatibility.
- Home and About surfaces use `src/assets/oneview-icon.png`, matching the system application icon.

## Static regression

- TypeScript: 75 / 75, parser errors 0.
- Svelte: 25 / 25 TypeScript script parser errors 0.
- Relative imports: 272, broken 0.
- JavaScript / MJS: 18, `node --check` errors 0.
- JSON: 25, parse errors 0.
- `.mdvplugin`: 15 / 15, ZIP/CRC errors 0.
- Tauri icons: 32, 128, 256, 512 PNG + multi-resolution ICO + 1024 ICNS all readable.

> Environment note: the current container still does not contain project `node_modules` or a Rust toolchain, so `npm run check`, `npm run build`, `cargo check`, `cargo test` and full Tauri bundle builds are not claimed here.

---

# Validation — v0.21.8

v0.21.8 replaces the v0.21.7 CNB release topology with GitHub Actions hosted runners. The application code is otherwise based on the validated v0.21.7 tree; this release changes CI/release infrastructure, documentation and version metadata.

## Executed in this environment

| Check | Result |
| --- | --- |
| Project versions | `package.json` / Tauri / Cargo = `0.21.8` |
| GitHub workflow YAML | 2 / 2 parse successfully |
| Release tag verifier | `v0.21.8` accepted; mismatched `v0.21.7` rejected |
| TypeScript files | 75 present |
| Svelte components | 25 present |
| Relative frontend imports | 269 checked, 0 broken |
| JS / MJS | 18 / 18 pass `node --check` |
| JSON | 25 / 25 parse successfully |
| `.mdvplugin` | 15 / 15 ZIP CRC + root manifest checks pass |
| Live CNB config/helpers | 0 |

## GitHub Actions release topology checks

`.github/workflows/release.yml` was statically checked to contain all required release paths:

1. Tag trigger: `v*` plus optional manual dispatch.
2. Release preflight verifies the Git tag against the three project version sources.
3. `macos-latest` installs both Darwin Rust targets and builds `universal-apple-darwin` as DMG.
4. `windows-latest` builds `x86_64-pc-windows-msvc` as NSIS.
5. `ubuntu-22.04` installs Tauri v2 WebKitGTK dependencies and builds AppImage + deb.
6. `tauri-apps/tauri-action@v1` creates/updates the GitHub Release and uploads native bundles.
7. macOS uses ad-hoc signing when no certificate is configured; a Developer ID certificate can be supplied through Secrets.
8. The final checksum job downloads Release assets and uploads `SHA256SUMS.txt`.
9. Workflow-level `contents: write` is declared for GitHub Release creation/upload.

`.github/workflows/ci.yml` was checked to contain:

- Svelte/TypeScript check;
- Vite frontend build;
- Rust core crate check for `app-core`, `markdown-core`, and `text-core`;
- normal push / pull-request triggers while excluding release tags.

## CNB removal

The following v0.21.7 live release infrastructure is removed:

- `.cnb.yml`
- `docs/CNB_RELEASE.md`
- `scripts/cnb-verify-version.mjs`
- `scripts/cnb-release-notes.mjs`
- `scripts/cnb-collect-artifacts.mjs`
- `scripts/cnb-upload-release.mjs`

Historical v0.21.7 changelog/fix notes intentionally remain as release history.

## Environment limitation

This container does not contain the project's `node_modules`, `cargo`, or `rustc`, so it cannot truthfully claim a full Tauri build, NSIS build, DMG build, Linux bundle build, `npm run check`, or `cargo check` was executed here.

The GitHub workflow definitions follow the current Tauri v2 hosted-runner pattern, but the first pushed `v0.21.8` tag is still the required end-to-end validation of GitHub's real macOS/Windows/Linux runners.

## First real GitHub release checklist

1. Push the v0.21.8 source to GitHub.
2. Ensure GitHub Actions are enabled for the repository.
3. Push tag `v0.21.8`.
4. Confirm `verify` passes before native build jobs start.
5. Confirm Windows uploads an NSIS installer.
6. Confirm macOS uploads one Universal DMG and opens on both Apple Silicon and Intel hardware when practical.
7. Confirm Linux uploads AppImage and deb.
8. Confirm the Release is published and contains `SHA256SUMS.txt`.
9. If GitHub reports `Resource not accessible by integration`, review repository/organization Actions token policy and allow the workflow `contents: write` permission.
10. Before broad public distribution, add Apple Developer signing/notarization and Windows Authenticode as appropriate.


## v0.21.10 licensing checks

- Root `LICENSE` points to PolyForm Noncommercial License 1.0.0 and includes the required copyright notice.
- `package.json` license metadata: `PolyForm-Noncommercial-1.0.0`.
- All 5 internal Rust packages declare `license = "PolyForm-Noncommercial-1.0.0"`.
- README explains noncommercial/source-available status and separate commercial licensing.
- `CONTRIBUTING.md` includes a contribution license grant suitable for future dual/commercial licensing.

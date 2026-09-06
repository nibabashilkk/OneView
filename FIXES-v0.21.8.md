# v0.21.8 — GitHub Actions 多平台发布

- 撤销 v0.21.7 的 CNB 发布链路，不再要求自托管 Windows/macOS Runner。
- 新增正式 `.github/workflows/release.yml`，使用 GitHub 官方 macOS / Windows / Ubuntu Runner 原生构建。
- macOS 直接生成 Universal DMG；Windows 生成 x64 NSIS；Linux 生成 AppImage 与 deb。
- Release 由 `tauri-apps/tauri-action@v1` 自动创建和上传附件，Tag 与项目版本在发布前强校验。
- 无 Apple 证书时 macOS 使用 ad-hoc signing；配置 Developer ID Secrets 后可继续走正式签名/公证。
- 新增发布完成后的 `SHA256SUMS.txt` 生成与 GitHub Release 上传。
- 新增 `.github/workflows/ci.yml`，普通 push / PR 自动执行前端检查、前端构建和 Rust Core 检查。
- 删除 `.cnb.yml`、CNB OpenAPI 上传脚本及 CNB 专用文档，发布体系只保留 GitHub Actions。

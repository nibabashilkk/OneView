# GitHub Actions 多平台自动发布

项目使用 GitHub 官方托管 Runner 构建桌面安装包，不需要自托管 Windows/macOS 机器。

## 发布结果

推送 `v*` Tag 后，`.github/workflows/release.yml` 会并行构建：

- Windows x64：NSIS `.exe`
- macOS：Universal `.dmg`，同时支持 Apple Silicon 与 Intel
- Linux x64：`.AppImage` + `.deb`

Tauri Action 会把安装包直接上传到同一个 GitHub Release。所有平台结束后，流水线会下载 Release 附件并生成 `SHA256SUMS.txt` 再上传。

## 最简单的发布方式

项目版本必须在以下三处一致：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

例如版本为 `0.21.11`：

```bash
git add .
git commit -m "release: v0.21.11"
git push

git tag v0.21.11
git push origin v0.21.11
```

随后进入 GitHub 仓库的 **Actions** 页面查看 `Release desktop app`。成功后，在 **Releases** 中直接下载三个平台的安装包。

## 当前 macOS 签名策略

当前版本**不读取任何 Apple 证书 Secret**。GitHub Actions 在 macOS Runner 上固定设置：

```text
APPLE_SIGNING_IDENTITY=-
```

也就是使用 ad-hoc signing。流水线不会创建临时 keychain，也不会执行 `security import`，因此当前阶段不需要配置：

- Apple Developer `.p12` 证书
- 证书密码
- Apple ID / App-specific password
- Team ID

这样可以先稳定产出测试用 DMG。需要注意：ad-hoc signing **不等于 Developer ID 正式签名，也没有 notarization**。普通用户从互联网下载后仍可能看到 Gatekeeper 安全提示。

等 oneView 正式商业发行并取得 Apple Developer 证书后，再单独升级 Release workflow 接入 Developer ID Application 签名和 notarization；不要只在仓库里添加 Secret，当前 workflow 会明确忽略这些证书变量。

### Windows

基础 NSIS 可以直接构建，但未做 Authenticode 时 SmartScreen 可能提示“未知发布者”。正式商业发布建议后续加入 Windows 代码签名证书。

## Updater

应用仍支持运行时注入：

- `MDV_UPDATE_ENDPOINT`
- `MDV_UPDATE_PUBKEY`

它们是可选 GitHub Secrets。不配置时应用会明确显示 Updater disabled。

`src-tauri/tauri.release.conf.json` 保留给需要生成 Tauri updater artifacts 的正式更新流水线使用。当前默认 GitHub Release 流程优先保证零额外密钥也能完成三平台安装包构建，因此没有强制启用 updater artifact signing。

## CI

`.github/workflows/ci.yml` 会在普通 push / pull request 时执行：

- Svelte / TypeScript check
- Vite frontend build
- Rust core crates `cargo check`

版本 Tag 不会重复触发普通 CI；Tag 由 Release workflow 自己做发布前检查。

## 当前构建矩阵

```text
GitHub Actions
├─ macos-latest
│  └─ universal-apple-darwin → DMG
├─ windows-latest
│  └─ x86_64-pc-windows-msvc → NSIS
└─ ubuntu-22.04
   └─ AppImage + deb
```

这套流程不依赖 CNB、自托管 Runner、Docker-in-Docker 或平台专用上传脚本。

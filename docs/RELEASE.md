# 发布指南

> **v0.21.11 当前状态**：GitHub Actions 的 macOS 构建固定使用 ad-hoc signing，不读取 Apple Developer 证书，也不执行 notarization。下面的 Developer ID / notarization 内容仅作为未来商业发行清单。
## 1. 发布环境

需要：

- Node.js 22+
- Rust stable 与对应目标平台 toolchain
- 目标系统的 Tauri 构建依赖
- Windows：缺少 WebView2 时由安装包内嵌 bootstrapper 辅助安装
- macOS 公网分发：Apple Developer 签名证书 + notarization 凭据

## 2. Updater 签名

更新包必须使用长期保存的 Tauri updater 私钥签名。第一次发布前生成一次：

```bash
npm run tauri signer generate -- -w ~/.tauri/markdown-viewer.key
```

私钥不要提交到仓库，也不要丢失；已经安装旧版本的用户后续更新仍需要同一套签名体系。

发布构建使用这些环境变量：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD   # 私钥有密码时
MDV_UPDATE_ENDPOINT
MDV_UPDATE_PUBKEY
```

`MDV_UPDATE_ENDPOINT` 与 `MDV_UPDATE_PUBKEY` 只在 Release 编译时注入 Rust Updater。开发构建没有这两个值时，应用会明确显示“当前构建未配置更新源”，不会访问假的服务器。

`src-tauri/tauri.release.conf.json` 只负责打开 `createUpdaterArtifacts`，不保存 endpoint、公钥或私钥。

## 3. 本地发布构建

```bash
npm install
npm run tauri build -- --config src-tauri/tauri.release.conf.json
```

建议第一次成功安装依赖后提交 `package-lock.json`，后续 CI 改用 `npm ci` 保证依赖可复现。

## 4. GitHub Actions

项目现在直接启用正式流水线：

```text
.github/workflows/ci.yml
.github/workflows/release.yml
```

普通 push / PR 运行 CI；推送 `v*` Tag 后，GitHub 官方 Runner 自动构建并发布 Windows x64 NSIS、macOS Universal DMG、Linux AppImage/deb。无需自托管 Runner。

发布前会验证 Git Tag 与 `package.json`、`tauri.conf.json`、`Cargo.toml` 的版本一致。Release 完成后还会自动生成 `SHA256SUMS.txt`。

完整说明见 `docs/GITHUB_RELEASE.md`。

## 5. macOS

Tauri 可以直接生成 `.app` 与 `.dmg`，项目已经配置 DMG 图标位置。v0.16.5 已移除 Quick Look nested extension，因此 macOS bundle 不再需要额外的 Xcode 扩展构建步骤。

真正面向公网分发时仍需要 Apple Developer 代码签名与 notarization。源码没有内置任何 Apple 证书、Apple ID 或私钥。

CI 常见凭据包括：

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID
```

也可以使用 App Store Connect API Key 完成 notarization。

## 6. Windows

Windows 正式 bundle 使用 Tauri + NSIS。v0.21.6 已移除 Explorer Preview Handler，因此 bundle 前不再构建 CMake/COM DLL，也没有 Preview Handler 带来的 x64-only 发布约束。

当前 CI 仍显式构建：

```text
x86_64-pc-windows-msvc
```

如果后续需要 ARM64，可以单独增加标准 Tauri ARM64 构建矩阵并在真机验证；本版本没有宣称 ARM64 已验证。

当前 WebView2 配置：

```json
{
  "webviewInstallMode": {
    "type": "embedBootstrapper"
  }
}
```

它只携带 bootstrapper，而不是完整 fixed WebView2 Runtime。Windows 10/11 通常已有 WebView2；没有时 bootstrapper 可辅助安装。

正式商业分发仍建议给 NSIS `.exe` 和主程序做 Windows Authenticode 代码签名。签名证书不应进入源码仓库。

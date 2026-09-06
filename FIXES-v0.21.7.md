# v0.21.7 — CNB Multi-platform Release

## 目标

把桌面端发布收敛成一个动作：推送 `vX.Y.Z` Tag，CNB 自动构建 Windows、macOS、Linux 并上传到同一个 Release。

## 构建拓扑

```text
tag_push
  ├─ prepare-release (CNB Linux)
  │    ├─ verify version
  │    ├─ generate release notes
  │    └─ create Release + resolve release-ready
  │
  ├─ windows-x64 (self-hosted Windows)
  │    └─ NSIS -> OpenAPI upload
  ├─ macos-universal (self-hosted Mac)
  │    └─ Universal DMG -> OpenAPI upload
  └─ linux-x64 (CNB official amd64)
       └─ AppImage + deb -> OpenAPI upload
```

## 设计选择

- 不让 Windows/macOS Runner 依赖 Docker。
- 不保存长期 CNB Token，使用 tag_push 注入的临时 `CNB_TOKEN`。
- Tag 必须与 package / Tauri / Cargo 三处版本一致，否则发布立即失败。
- 构建产物统一改名并生成 SHA256，Release 页面跨平台命名一致。
- 第一版不强制签名；签名与 notarization 作为后续密钥配置。

# v0.21.3 — Adaptive UI Typography

## 问题

Settings 与 Plugin Center 为了追求紧凑，历史上大量使用 7.5–10px 固定字号。在普通 macOS 桌面窗口中，这会让说明、状态、插件元信息和内部诊断看起来明显偏小。

## 修复

- 新增六级桌面 UI 字号 token：`micro / caption / control / body / section / title`。
- 使用 `clamp() + vmin` 让字号随可用窗口尺寸做有限、平滑的自适应。
- 最小信息字号提高到 11px；常规说明约 12px；正文/控件约 12.5–14px；标题约 15.5–17px。
- Settings 的导航、搜索、区块标题、说明、主题卡片、滑杆、按钮全部接入该体系。
- Plugin Center 的标题、搜索、分类、插件说明、状态、权限、操作，以及插件展开后的设置/诊断/冲突信息全部接入该体系。
- 小窗口优先压缩间距与卡片高度，不再通过缩到 8–9px 保持密度。
- UI font stack 改为系统字体优先：macOS 使用 San Francisco / PingFang SC，Windows 使用 Segoe UI Variable Text。

## 未改动

Plugin Platform、Theme schema、Worker Runtime、Safe Mode、Rust 安全校验、Reader 用户字号设置均未改变。

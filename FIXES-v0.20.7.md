# v0.20.7 — Unified Motion System

本版把此前偏“瞬间切换”的应用界面统一成一套克制的桌面 Motion System。

## 动画层级

- Popover / Context Menu / Search：约 135ms。
- Tab / Status：约 140ms。
- Content / Sidebar：约 180ms。
- Settings / Plugin Center / Dialog：约 205ms。

## 原则

- 不使用弹簧、弹跳或大幅移动。
- 模态窗口进入/退出都由 Svelte transition 生命周期托管，不使用 setTimeout 模拟。
- Sidebar / Plugin Drawer 同时处理可见宽度和位移，减少 Flex 布局跳变。
- `prefers-reduced-motion` 时所有 Motion 自动关闭。

## 实现

统一入口：`src/lib/motion.ts`。组件不再自行决定 easing 和默认时长，只选择语义 primitive。

# WYSIWYG Advanced Demo

这份文件只使用 **v0.11 所见即所得安全子集**，用于测试 Markdown ↔ ProseMirror ↔ Markdown round-trip。

## 基础格式

普通段落支持 **粗体**、*斜体*、~~删除线~~、`inline code` 和 [链接](https://example.com)。

> 这是引用块。

## 列表与任务

- 第一项
- 第二项
  - 嵌套项

1. 第一步
2. 第二步

- [ ] 待完成任务
- [x] 已完成任务

## 可视化表格

| 功能 | 状态 | 备注 |
| :--- | :---: | ---: |
| 表格编辑 | ✅ | 直接改单元格 |
| Mermaid | ✅ | 双击编辑源码 |
| KaTeX | ✅ | 点击后编辑公式 |

## 图片

![Local fixture](./assets/local-demo.svg)

可以把 PNG/JPEG/WebP/SVG 等图片直接拖进编辑器，或从剪贴板粘贴。桌面版会自动复制到当前文档旁的 `assets/`。

## 行内公式

质能方程：$E = mc^2$。

## 块级公式

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## Mermaid

```mermaid
flowchart LR
  A[拖入图片] --> B[复制到 assets]
  B --> C[写入相对 Markdown]
  C --> D[可移植文档]
```

## 代码块

```rust
fn main() {
    println!("hello markdown");
}
```

---

## 输入规则

在空段落输入 `# `、`> `、`- `、`1. ` 或三个反引号后空格，可以快速切换块类型。

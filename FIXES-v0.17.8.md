# v0.17.8 Fixes

## structured-core 编译修复

`json_semantic_hints_are_rendered_safely` 测试样例中包含十六进制颜色 `#ff8800`。
Rust 的 `r#"..."#` raw string 会把值开头的 `"#` 识别成字符串结束符，导致后续 JSON 文本被当成 Rust 语法解析。

已将该测试字符串改为 `r##"..."##`，从而允许内容中安全出现 `"#`。

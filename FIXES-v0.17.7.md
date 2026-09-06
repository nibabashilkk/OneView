# v0.17.7 — JSON Explorer Polish

## Why

旧 JSON Tree 只是把 serde_json 结果递归输出成 `<details>`，层级、密度和对象/数组识别都比较弱。

## Changes

- compact JSON toolbar with root kind / node count / depth
- expand-all / collapse-all actions
- root + first level open by default
- custom chevrons, indentation guides, index pills, object/array count badges
- smart hints for URLs, ISO-like dates and hex colors
- search expands collapsed JSON nodes before highlighting
- structured documents use their own full document layout

## Reference direction

The interaction model borrows the useful parts of Firefox JSON Viewer (collapsible tree, filter/search, expand/collapse) and JSON Hero (clear hierarchy and semantic previews) without adding a heavy multi-pane inspector.

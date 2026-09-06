import type { CompatibilityIssue, CompatibilityLevel, CompatibilityReport } from "../../lib/contracts";

const issueLabels: Record<string, { title: string; detail: string }> = {
  frontMatter: { title: "Front Matter", detail: "当前可视编辑暂不改写文档元数据，因此此文档仅提供安全预览。" },
  footnotes: { title: "脚注", detail: "当前编辑 Schema 尚未提供脚注的无损 round-trip。" },
  rawHtml: { title: "原始 HTML", detail: "HTML 可能包含可视编辑器无法无损表达的结构或属性，因此当前仅提供安全预览。" },
  setextHeading: { title: "Setext 标题", detail: "编辑语义安全，但保存后可能规范化为 # 风格标题。" },
  tildeFence: { title: "~~~ 代码围栏", detail: "编辑语义安全，但保存后可能规范化为反引号围栏。" },
  longFence: { title: "扩展代码围栏", detail: "围栏长度可能在序列化时被规范化。" },
  referenceLinks: { title: "引用式链接", detail: "链接语义可保留，但引用定义的源码组织方式可能变化。" },
  tableFormatting: { title: "表格源码排版", detail: "单元格语义和对齐可保留，但列宽空格等源码排版可能变化。" },
  listMarkerStyle: { title: "列表标记样式", detail: "* / + 等列表符号可能被规范化。" },
  orderedListDelimiter: { title: "有序列表分隔符", detail: "1) 形式可能被规范化为 1.。" },
  indentedCode: { title: "缩进代码块", detail: "可能被规范化为 fenced code block。" },
  closingHeadingHashes: { title: "标题尾部 #", detail: "关闭式 # 可能在保存时移除。" },
  headingAttributes: { title: "标题属性", detail: "显式 ID、class 或自定义属性当前无法由可视编辑器无损保存，因此当前仅提供安全预览。" },
  autolink: { title: "自动链接", detail: "<https://…> 等源码形式可能被规范化。" },
  htmlEntity: { title: "HTML 实体", detail: "实体可能被解码成等价 Unicode 字符。" },
  escapedPunctuation: { title: "转义标点", detail: "不必要的 Markdown 转义可能被序列化器移除。" },
  hardBreakStyle: { title: "硬换行写法", detail: "双空格或反斜杠换行的源码形式可能变化。" },
  thematicBreakStyle: { title: "分割线样式", detail: "*** / ___ 可能被规范化为统一分割线。" },
};

export function compatibilityLabel(level: CompatibilityLevel) {
  if (level === "safe") return "无损";
  if (level === "guarded") return "受保护";
  return "仅预览";
}

export function compatibilityShortDescription(report: CompatibilityReport) {
  if (report.level === "safe") return "当前结构可直接进入所见即所得";
  if (report.level === "guarded") return "语义安全；部分 Markdown 源码风格可能被规范化";
  return "包含暂不能无损 round-trip 的结构，当前仅提供安全预览";
}

export function compatibilityIssueLabel(issue: CompatibilityIssue) {
  return issueLabels[issue.code] ?? {
    title: issue.code,
    detail: issue.level === "sourceOnly" ? "该结构当前不支持无损可视编辑，仅提供安全预览。" : "该源码写法可能在保存时规范化。",
  };
}

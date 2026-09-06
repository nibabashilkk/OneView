import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sections = Number.parseInt(process.argv[2] ?? "1200", 10);
const target = resolve("fixtures/large-demo.md");
const parts = [
  "# oneView 大文档性能样例\n",
  "> 由 `npm run fixture:large` 生成，用于测试目录跟随、阅读进度、搜索和视口渲染。\n",
];

for (let index = 1; index <= sections; index += 1) {
  parts.push(`\n## Section ${index}\n`);
  parts.push(`这是第 ${index} 个章节。用于模拟一个较大的 Markdown 文档，并验证滚动时不会持续阻塞 UI。\n\n`);
  parts.push("- 大文档视口渲染\n- 目录滚动跟随\n- 分批代码高亮与公式增强\n- 搜索时主动让出主线程\n\n");
  if (index % 20 === 0) {
    parts.push("```ts\nexport function sample(value: number) {\n  return value * 2;\n}\n```\n\n");
  }
}

await writeFile(target, parts.join(""), "utf8");
console.log(`generated ${target} with ${sections} sections`);

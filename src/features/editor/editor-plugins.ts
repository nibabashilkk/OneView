import { inputRules, textblockTypeInputRule, wrappingInputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, chainCommands, toggleMark } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { liftListItem, sinkListItem, splitListItem } from "prosemirror-schema-list";
import { goToNextCell, tableEditing } from "prosemirror-tables";
import { editorSchema } from "./editor-schema";
import { taskListPlugin } from "./task-list-plugin";
import { syntaxRevealPlugin } from "./syntax-reveal-plugin";
import { codeHighlightPlugin } from "./code-highlight-plugin";

export function editorPlugins() {
  const { nodes, marks } = editorSchema;
  return [
    inputRules({
      rules: [
        textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (match) => ({ level: match[1].length })),
        wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
        wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list),
        wrappingInputRule(/^(\d+)\.\s$/, nodes.ordered_list, (match) => ({ order: Number(match[1]) })),
        textblockTypeInputRule(/^```([\w+-]+)?\s$/, nodes.code_block, (match) => ({ params: match[1] || "" })),
      ],
    }),
    history(),
    taskListPlugin(),
    syntaxRevealPlugin(),
    codeHighlightPlugin(),
    keymap({
      "Mod-b": toggleMark(marks.strong),
      "Mod-i": toggleMark(marks.em),
      "Mod-Shift-x": toggleMark(marks.strike),
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
      Enter: splitListItem(nodes.list_item),
      Tab: chainCommands(sinkListItem(nodes.list_item), goToNextCell(1)),
      "Shift-Tab": chainCommands(liftListItem(nodes.list_item), goToNextCell(-1)),
    }),
    keymap(baseKeymap),
    // 官方建议 tableEditing 放在插件数组靠后，避免抢走更具体的事件处理。
    tableEditing(),
  ];
}

const MODIFIER_ORDER = ["Mod", "Ctrl", "Shift", "Alt"] as const;
const PLUGIN_KEY_PATTERN = /^(?:[A-Za-z0-9]|F(?:[1-9]|1[0-2])|[,.;/\\\-=`\[\]])$/;

function normalizeModifier(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["mod", "cmdorctrl", "commandorcontrol"].includes(normalized)) return "Mod";
  if (normalized === "ctrl" || normalized === "control") return "Ctrl";
  if (normalized === "shift") return "Shift";
  if (normalized === "alt" || normalized === "option") return "Alt";
  return null;
}

function canonicalKey(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const aliases: Record<string, string> = {
    comma: ",",
    period: ".",
    slash: "/",
    semicolon: ";",
    minus: "-",
    equal: "=",
    backquote: "`",
    bracketleft: "[",
    bracketright: "]",
    tab: "TAB",
    enter: "ENTER",
    escape: "ESCAPE",
    space: "SPACE",
  };
  const alias = aliases[trimmed.toLowerCase()];
  return alias ?? trimmed.toUpperCase();
}

/** Canonical identity for comparisons. It accepts host-only keys such as Ctrl+Tab. */
export function normalizeShortcutIdentity(shortcut: string) {
  const parts = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  const rawKey = parts.pop() ?? "";
  const modifiers = new Set<string>();
  for (const part of parts) {
    const normalized = normalizeModifier(part);
    if (normalized) modifiers.add(normalized);
    else modifiers.add(part);
  }
  const ordered = MODIFIER_ORDER.filter((part) => modifiers.has(part));
  const unknown = [...modifiers].filter((part) => !(MODIFIER_ORDER as readonly string[]).includes(part)).sort();
  const key = canonicalKey(rawKey);
  return [...ordered, ...unknown, key].filter(Boolean).join("+");
}

/**
 * Canonicalize a third-party/plugin shortcut. A modifier is mandatory so plugin commands
 * cannot accidentally consume normal text input. Keep this grammar stable as part of API v1.
 */
export function normalizePluginShortcut(shortcut: string) {
  const raw = shortcut.trim();
  if (!raw) throw new Error("快捷键不能为空");
  const parts = raw.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) throw new Error("快捷键至少需要一个修饰键，例如 Mod+Shift+U");
  const rawKey = parts.pop() ?? "";
  const modifiers: string[] = [];
  for (const part of parts) {
    const normalized = normalizeModifier(part);
    if (!normalized) throw new Error(`快捷键修饰键无效：${part}`);
    if (modifiers.includes(normalized)) throw new Error(`快捷键修饰键重复：${normalized}`);
    modifiers.push(normalized);
  }
  if (modifiers.includes("Mod") && modifiers.includes("Ctrl")) {
    throw new Error("不能同时使用 Mod 和 Ctrl；请只选择主快捷键或显式 Ctrl");
  }
  if (!PLUGIN_KEY_PATTERN.test(rawKey)) throw new Error(`快捷键按键无效：${rawKey}`);
  const ordered = MODIFIER_ORDER.filter((part) => modifiers.includes(part));
  return [...ordered, canonicalKey(rawKey)].join("+");
}

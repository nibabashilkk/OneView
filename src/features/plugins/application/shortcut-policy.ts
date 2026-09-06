import type { PluginCommandContribution, PluginShortcutConflict } from "../domain/plugin";
import { normalizeShortcutIdentity } from "../domain/shortcut";
import type { ReservedShortcut } from "./plugin-host-services";

export { normalizePluginShortcut, normalizeShortcutIdentity } from "../domain/shortcut";

/**
 * Built-in shortcuts always win. Plugin-vs-plugin collisions disable every colliding
 * plugin shortcut instead of making load order an invisible source of behavior.
 * Commands remain available through the command palette.
 */
export function resolvePluginShortcutConflicts(
  commands: readonly PluginCommandContribution[],
  reserved: readonly ReservedShortcut[],
): PluginShortcutConflict[] {
  const conflicts: PluginShortcutConflict[] = [];
  const reservedByShortcut = new Map<string, ReservedShortcut[]>();
  for (const item of reserved) {
    const key = normalizeShortcutIdentity(item.shortcut);
    if (!key) continue;
    const list = reservedByShortcut.get(key) ?? [];
    list.push(item);
    reservedByShortcut.set(key, list);
  }

  const pluginByShortcut = new Map<string, PluginCommandContribution[]>();
  for (const command of commands) {
    if (!command.shortcut) continue;
    const key = normalizeShortcutIdentity(command.shortcut);
    if (!key) continue;
    const list = pluginByShortcut.get(key) ?? [];
    list.push(command);
    pluginByShortcut.set(key, list);
  }

  for (const [normalizedShortcut, pluginCommands] of pluginByShortcut) {
    const builtins = reservedByShortcut.get(normalizedShortcut) ?? [];
    if (builtins.length > 0) {
      for (const command of pluginCommands) {
        conflicts.push({
          commandId: command.id,
          pluginId: command.pluginId,
          pluginName: command.pluginName,
          commandTitle: command.title,
          shortcut: command.shortcut!,
          normalizedShortcut,
          kind: "builtin",
          conflictsWith: builtins.map((item) => item.title),
        });
      }
      continue;
    }

    if (pluginCommands.length > 1) {
      const sorted = [...pluginCommands].sort((a, b) => a.pluginId.localeCompare(b.pluginId) || a.localId.localeCompare(b.localId));
      for (const command of sorted) {
        conflicts.push({
          commandId: command.id,
          pluginId: command.pluginId,
          pluginName: command.pluginName,
          commandTitle: command.title,
          shortcut: command.shortcut!,
          normalizedShortcut,
          kind: "plugin",
          conflictsWith: sorted.filter((item) => item.id !== command.id).map((item) => `${item.pluginName} · ${item.title}`),
        });
      }
    }
  }

  return conflicts.sort((a, b) => a.pluginName.localeCompare(b.pluginName) || a.commandTitle.localeCompare(b.commandTitle));
}

export function shortcutAssignmentConflicts(
  commandId: string,
  shortcut: string,
  commands: readonly PluginCommandContribution[],
  reserved: readonly ReservedShortcut[],
) {
  const normalized = normalizeShortcutIdentity(shortcut);
  const labels = reserved
    .filter((item) => normalizeShortcutIdentity(item.shortcut) === normalized)
    .map((item) => item.title);
  for (const command of commands) {
    if (command.id === commandId || !command.shortcut) continue;
    if (normalizeShortcutIdentity(command.shortcut) === normalized) labels.push(`${command.pluginName} · ${command.title}`);
  }
  return [...new Set(labels)];
}

export function isPluginShortcutBlocked(commandId: string, conflicts: readonly PluginShortcutConflict[]) {
  return conflicts.some((item) => item.commandId === commandId);
}

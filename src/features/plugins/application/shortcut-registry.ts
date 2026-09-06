import type {
  PluginCommandContribution,
  PluginShortcutBinding,
  PluginShortcutOverrides,
} from "../domain/plugin";
import { normalizePluginShortcut } from "../domain/shortcut";

/**
 * Owns host-level shortcut overrides. Runtime command registrations remain immutable;
 * this registry overlays user choices and produces an effective command view for the UI.
 */
export class PluginShortcutRegistry {
  private readonly overrides = new Map<string, string | null>();

  hydrate(overrides: PluginShortcutOverrides | undefined) {
    this.overrides.clear();
    for (const [commandId, value] of Object.entries(overrides ?? {})) {
      if (value === null) {
        this.overrides.set(commandId, null);
        continue;
      }
      try {
        this.overrides.set(commandId, normalizePluginShortcut(value));
      } catch {
        // Corrupt/legacy persisted shortcuts are ignored in-memory. The host never executes them.
      }
    }
  }

  set(commandId: string, shortcut: string | null) {
    this.overrides.set(commandId, shortcut === null ? null : normalizePluginShortcut(shortcut));
  }

  clear(commandId: string) {
    this.overrides.delete(commandId);
  }

  clearAll() {
    this.overrides.clear();
  }

  resolveCommands(commands: readonly PluginCommandContribution[]): PluginCommandContribution[] {
    return commands.map((command) => {
      const defaultShortcut = command.defaultShortcut ?? command.shortcut;
      if (!this.overrides.has(command.id)) return { ...command, defaultShortcut, shortcut: defaultShortcut };
      const override = this.overrides.get(command.id);
      return { ...command, defaultShortcut, shortcut: override ?? undefined };
    });
  }

  bindings(commands: readonly PluginCommandContribution[]): PluginShortcutBinding[] {
    const effective = this.resolveCommands(commands);
    return effective
      .map((command): PluginShortcutBinding => {
        const overridden = this.overrides.has(command.id);
        return {
          commandId: command.id,
          pluginId: command.pluginId,
          pluginName: command.pluginName,
          commandTitle: command.title,
          defaultShortcut: command.defaultShortcut,
          effectiveShortcut: command.shortcut,
          overridden,
          overrideShortcut: overridden ? (this.overrides.get(command.id) ?? null) : undefined,
        };
      })
      .sort((a, b) => a.pluginName.localeCompare(b.pluginName) || a.commandTitle.localeCompare(b.commandTitle));
  }
}

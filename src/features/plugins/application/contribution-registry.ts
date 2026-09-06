import type { PluginCommandContribution, PluginPanelContribution, PluginUiContribution } from "../domain/plugin";

/**
 * Owns all runtime contributions. PluginManager orchestrates lifecycle; this registry owns
 * registration/replacement/removal semantics so UI contribution policy is not spread across Svelte.
 */
export class PluginContributionRegistry {
  private readonly commands = new Map<string, PluginCommandContribution>();
  private readonly ui = new Map<string, PluginUiContribution>();
  private readonly panels = new Map<string, PluginPanelContribution>();

  registerCommand(command: PluginCommandContribution) {
    this.commands.set(command.id, command);
  }

  removeCommand(id: string) {
    this.commands.delete(id);
  }

  registerUi(contribution: PluginUiContribution) {
    this.ui.set(contribution.id, contribution);
  }

  removeUi(id: string) {
    this.ui.delete(id);
  }

  registerPanel(panel: PluginPanelContribution) {
    this.panels.set(panel.id, panel);
  }

  removePanel(id: string) {
    this.panels.delete(id);
  }

  clearPlugin(pluginId: string) {
    for (const [id, command] of this.commands) if (command.pluginId === pluginId) this.commands.delete(id);
    for (const [id, contribution] of this.ui) if (contribution.pluginId === pluginId) this.ui.delete(id);
    for (const [id, panel] of this.panels) if (panel.pluginId === pluginId) this.panels.delete(id);
  }

  retainPlugins(pluginIds: Set<string>) {
    for (const [id, command] of this.commands) if (!pluginIds.has(command.pluginId)) this.commands.delete(id);
    for (const [id, contribution] of this.ui) if (!pluginIds.has(contribution.pluginId)) this.ui.delete(id);
    for (const [id, panel] of this.panels) if (!pluginIds.has(panel.pluginId)) this.panels.delete(id);
  }

  snapshot() {
    return {
      commands: [...this.commands.values()],
      contributions: [...this.ui.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
      panels: [...this.panels.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    };
  }

  clear() {
    this.commands.clear();
    this.ui.clear();
    this.panels.clear();
  }
}

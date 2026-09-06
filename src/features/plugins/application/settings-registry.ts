import type { PluginSettingsContribution } from "../domain/plugin";

/**
 * Owns plugin-provided settings schemas. The manager controls lifecycle while this registry
 * keeps replacement/cleanup semantics independent from the settings UI.
 */
export class PluginSettingsRegistry {
  private readonly schemas = new Map<string, PluginSettingsContribution>();

  register(schema: PluginSettingsContribution) {
    this.schemas.set(schema.pluginId, schema);
  }

  remove(pluginId: string) {
    this.schemas.delete(pluginId);
  }

  get(pluginId: string) {
    return this.schemas.get(pluginId) ?? null;
  }

  retainPlugins(pluginIds: Set<string>) {
    for (const id of this.schemas.keys()) {
      if (!pluginIds.has(id)) this.schemas.delete(id);
    }
  }

  snapshot() {
    return [...this.schemas.values()].sort((a, b) => a.pluginName.localeCompare(b.pluginName));
  }

  clear() {
    this.schemas.clear();
  }
}

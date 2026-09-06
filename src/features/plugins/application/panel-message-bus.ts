export type PluginPanelMessageListener = (payload: unknown) => void;

/**
 * Small in-memory broker between the plugin Worker runtime and the host-rendered sandbox iframe.
 * It keeps ephemeral panel traffic out of Svelte stores and out of PluginManager's domain state.
 */
export class PluginPanelMessageBus {
  private readonly listeners = new Map<string, Set<PluginPanelMessageListener>>();

  subscribe(panelId: string, listener: PluginPanelMessageListener) {
    let set = this.listeners.get(panelId);
    if (!set) {
      set = new Set();
      this.listeners.set(panelId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(panelId);
      if (!current || !current.delete(listener)) return;
      if (current.size === 0) this.listeners.delete(panelId);
    };
  }

  publish(panelId: string, payload: unknown) {
    const set = this.listeners.get(panelId);
    if (!set) return;
    for (const listener of [...set]) listener(payload);
  }

  clearPanel(panelId: string) {
    this.listeners.delete(panelId);
  }

  clearPlugin(pluginId: string) {
    const prefix = `${pluginId}:`;
    for (const panelId of [...this.listeners.keys()]) {
      if (panelId.startsWith(prefix)) this.listeners.delete(panelId);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

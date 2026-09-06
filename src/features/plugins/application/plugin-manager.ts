import { get, writable, type Readable } from "svelte/store";
import type { PluginRepository } from "./plugin-repository";
import type {
  ActivePluginDocumentFormat,
  InstalledPlugin,
  PluginCommandContribution,
  PluginDiagnosticReport,
  PluginDocumentRenderInput,
  PluginDocumentRenderResult,
  PluginEvent,
  PluginManagerState,
  PluginPanelContribution,
  PluginSettingValue,
  PluginSettingsContribution,
  PluginUiContribution,
} from "../domain/plugin";
import { pluginHasWorkerRuntime } from "../domain/plugin";
import type { PluginHostServices } from "./plugin-host-services";
import type { PluginRuntime, PluginRuntimeFactory } from "./plugin-runtime";
import { PluginContributionRegistry } from "./contribution-registry";
import { PluginPanelMessageBus, type PluginPanelMessageListener } from "./panel-message-bus";
import { PluginSettingsRegistry } from "./settings-registry";
import { pluginSettingStorageKey, validatePluginSettingValue } from "./plugin-settings";
import { PluginDiagnosticsRegistry } from "./diagnostics-registry";
import { PluginShortcutRegistry } from "./shortcut-registry";
import { normalizePluginShortcut } from "../domain/shortcut";
import { resolvePluginShortcutConflicts, shortcutAssignmentConflicts } from "./shortcut-policy";
import { themeRegistry, themeRegistryState } from "../../themes";
import type { ThemeContributionManifest } from "../../themes";

const CORE_DOCUMENT_FORMAT_IDS = new Set(["markdown", "text", "plaintext", "plain-text"]);
const CORE_DOCUMENT_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd", "txt", "text"]);

const INITIAL_STATE: PluginManagerState = {
  plugins: [],
  warnings: [],
  runtimeById: {},
  themeFamilies: [],
  selectedThemeFamily: "default",
  commands: [],
  contributions: [],
  panels: [],
  settingsSchemas: [],
  healthById: {},
  diagnosticsById: {},
  shortcutBindings: [],
  shortcutConflicts: [],
  safeMode: false,
  startupRecovery: null,
  activePanelId: null,
  loading: false,
  error: null,
};

export class PluginManager {
  private readonly writable = writable<PluginManagerState>(INITIAL_STATE);
  readonly state: Readable<PluginManagerState> = { subscribe: this.writable.subscribe };
  private readonly runtimes = new Map<string, PluginRuntime>();
  private readonly contributions = new PluginContributionRegistry();
  private readonly panelMessages = new PluginPanelMessageBus();
  private readonly settings = new PluginSettingsRegistry();
  private readonly diagnostics = new PluginDiagnosticsRegistry();
  private readonly shortcuts = new PluginShortcutRegistry();
  private operation = Promise.resolve();

  constructor(
    private readonly repository: PluginRepository,
    private readonly runtimeFactory: PluginRuntimeFactory,
    private readonly services: PluginHostServices,
  ) {}

  async initialize() {
    await this.serialize(async () => {
      const recovery = await this.repository.beginStartupSession();
      this.patch({ safeMode: recovery.safeMode, startupRecovery: recovery });
      try {
        await this.refreshInternal();
        if (recovery.safeMode) {
          await this.reconcileRuntimes(false);
          if (recovery.previousStartupIncomplete) {
            const interrupted = recovery.interruptedPluginId ? `，可能停在 ${recovery.interruptedPluginId}` : "";
            this.services.showNotice(`检测到上次插件启动阶段未正常完成${interrupted}，已自动进入安全模式。`);
          } else {
            this.services.showNotice("插件安全模式已启用：第三方插件本次未自动启动。");
          }
        } else {
          await this.reconcileRuntimes(true, true);
        }
      } finally {
        await this.repository.completeStartupSession().catch((error) => {
          this.services.reportError("plugin-manager", `清理插件启动恢复标记失败：${String(error)}`);
        });
      }
    });
  }

  async refresh() {
    await this.serialize(async () => {
      this.patch({ error: null });
      try {
        await this.refreshInternal();
        await this.reconcileRuntimes(false);
      } catch (error) {
        this.fail(error);
      }
    });
  }

  async setSafeMode(enabled: boolean) {
    await this.serialize(async () => {
      this.patch({ error: null, loading: true });
      try {
        const recovery = await this.repository.setSafeMode(enabled);
        this.patch({ safeMode: recovery.safeMode, startupRecovery: recovery });
        if (enabled) {
          for (const id of [...this.runtimes.keys()]) await this.unloadRuntime(id);
          this.services.showNotice("已进入插件安全模式：第三方插件运行时已暂停，启用状态和数据保持不变。");
        } else {
          await this.reconcileRuntimes(false);
          this.services.showNotice("已退出插件安全模式，正在恢复已启用插件。");
        }
      } catch (error) {
        this.fail(error);
      } finally {
        this.patch({ loading: false });
      }
    });
  }

  async installFromPicker() {
    const path = await this.repository.choosePackage();
    if (!path) return;
    await this.serialize(async () => {
      this.patch({ loading: true, error: null });
      try {
        const installed = await this.repository.install(path);
        if (this.runtimes.has(installed.manifest.id)) {
          await this.unloadRuntime(installed.manifest.id);
        }
        await this.refreshInternal();
        if (installed.enabled && installed.compatible && !get(this.writable).safeMode) {
          try {
            await this.loadRuntime(installed);
          } catch (error) {
            await this.repository.setEnabled(installed.manifest.id, false).catch(() => undefined);
            await this.refreshInternal();
            throw new Error(`插件已更新，但新版启动失败并已自动禁用：${error instanceof Error ? error.message : String(error)}`);
          }
        }
        const safeMode = get(this.writable).safeMode;
        this.services.showNotice(
          installed.enabled
            ? safeMode
              ? `已更新插件：${installed.manifest.name}（安全模式下暂不启动）`
              : `已更新并重新加载插件：${installed.manifest.name}`
            : installed.permissionReviewRequired
              ? `已更新插件：${installed.manifest.name}（权限需要重新确认）`
              : `已安装插件：${installed.manifest.name}（默认未启用）`,
        );
      } catch (error) {
        this.fail(error);
        throw error;
      } finally {
        this.patch({ loading: false });
      }
    });
  }


  async linkDevelopmentFromPicker() {
    const path = await this.repository.chooseDevelopmentDirectory();
    if (!path) return;
    await this.serialize(async () => {
      this.patch({ loading: true, error: null });
      try {
        const linked = await this.repository.linkDevelopment(path);
        if (this.runtimes.has(linked.manifest.id)) {
          await this.unloadRuntime(linked.manifest.id);
        }
        await this.refreshInternal();
        const current = get(this.writable).plugins.find((item) => item.manifest.id === linked.manifest.id) ?? linked;
        if (current.enabled && current.compatible && !get(this.writable).safeMode) {
          await this.loadRuntime(current);
        }
        this.services.showNotice(
          linked.permissionReviewRequired
            ? `已加载开发插件：${linked.manifest.name}（启用前需要确认权限）`
            : `已加载开发插件目录：${linked.manifest.name}`,
        );
      } catch (error) {
        this.fail(error);
        throw error;
      } finally {
        this.patch({ loading: false });
      }
    });
  }

  async reload(id: string) {
    await this.serialize(async () => {
      this.patch({ error: null });
      const before = get(this.writable).plugins.find((item) => item.manifest.id === id);
      if (!before) return;
      try {
        await this.unloadRuntime(id);
        await this.refreshInternal();
        const current = get(this.writable).plugins.find((item) => item.manifest.id === id);
        if (!current) throw new Error("插件已不存在");
        if (current.enabled && current.compatible && !get(this.writable).safeMode) {
          await this.loadRuntime(current);
        }
        this.services.showNotice(get(this.writable).safeMode
          ? `已刷新插件：${current.manifest.name}（安全模式下暂不启动）`
          : `已重新加载插件：${current.manifest.name}`);
      } catch (error) {
        this.setRuntime(id, "error", error instanceof Error ? error.message : String(error));
        this.fail(error);
      }
    });
  }

  async setEnabled(id: string, enabled: boolean) {
    await this.serialize(async () => {
      this.patch({ error: null });
      if (!enabled) {
        await this.repository.setEnabled(id, false);
        await this.unloadRuntime(id);
        await this.refreshInternal();
        return;
      }

      const updated = await this.repository.setEnabled(id, true);
      await this.refreshInternal();
      const current = get(this.writable).plugins.find((item) => item.manifest.id === id) ?? updated;
      if (get(this.writable).safeMode) {
        this.services.showNotice(pluginHasWorkerRuntime(current.manifest)
          ? `已记录启用状态：${current.manifest.name}（安全模式下 Worker 暂不启动，声明式贡献仍有效）`
          : `已启用插件：${current.manifest.name}`);
        return;
      }
      try {
        if (pluginHasWorkerRuntime(current.manifest)) await this.loadRuntime(current);
        this.services.showNotice(`已启用插件：${current.manifest.name}`);
      } catch (error) {
        await this.repository.setEnabled(id, false).catch(() => undefined);
        this.setRuntime(id, "error", error instanceof Error ? error.message : String(error));
        await this.refreshInternal();
        throw error;
      }
    }).catch((error) => this.fail(error));
  }

  async uninstall(id: string, removeData: boolean) {
    await this.serialize(async () => {
      const plugin = get(this.writable).plugins.find((item) => item.manifest.id === id);
      await this.unloadRuntime(id);
      await this.repository.uninstall(id, removeData);
      await this.refreshInternal();
      if (plugin) {
        this.services.showNotice(
          plugin.source.kind === "development"
            ? `已移除开发插件引用：${plugin.manifest.name}`
            : `已卸载插件：${plugin.manifest.name}`,
        );
      }
    }).catch((error) => this.fail(error));
  }

  selectThemeFamily(family: string) {
    themeRegistry.selectFamily(family);
    const snapshot = get(themeRegistryState);
    this.patch({ themeFamilies: snapshot.families, selectedThemeFamily: snapshot.selectedFamily });
  }

  async runContribution(contributionId: string) {
    const contribution = get(this.writable).contributions.find((item) => item.id === contributionId);
    if (!contribution) return;
    const runtime = this.runtimes.get(contribution.pluginId);
    if (!runtime) throw new Error(`插件 ${contribution.pluginName} 当前未运行`);
    if (runtime.kind !== "extension") throw new Error(`插件 ${contribution.pluginName} 不是 Extension Runtime`);
    runtime.invokeCommand(contribution.commandId);
  }

  async runCommand(commandId: string) {
    const contribution = get(this.writable).commands.find((item) => item.id === commandId);
    if (!contribution) return;
    const runtime = this.runtimes.get(contribution.pluginId);
    if (!runtime) throw new Error(`插件 ${contribution.pluginName} 当前未运行`);
    if (runtime.kind !== "extension") throw new Error(`插件 ${contribution.pluginName} 不是 Extension Runtime`);
    runtime.invokeCommand(contribution.localId);
  }

  supportedDocumentFormats(): ActivePluginDocumentFormat[] {
    const formats: ActivePluginDocumentFormat[] = [];
    const claimedExtensions = new Set<string>();
    const plugins = get(this.writable).plugins
      .filter((plugin) => plugin.enabled && plugin.compatible && this.runtimes.has(plugin.manifest.id))
      .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));

    for (const plugin of plugins) {
      for (const format of plugin.manifest.contributes?.documentFormats ?? []) {
        if (CORE_DOCUMENT_FORMAT_IDS.has(format.id.trim().toLowerCase())) continue;
        const extensions = format.extensions
          .map(normalizeDocumentExtension)
          .filter((extension) => extension && !CORE_DOCUMENT_EXTENSIONS.has(extension) && !claimedExtensions.has(extension));
        if (extensions.length === 0) continue;
        for (const extension of extensions) claimedExtensions.add(extension);
        formats.push({
          id: format.id,
          label: format.label,
          extensions,
          pluginId: plugin.manifest.id,
          pluginName: plugin.manifest.name,
        });
      }
    }
    return formats;
  }

  supportedDocumentExtensions(): string[] {
    return this.supportedDocumentFormats().flatMap((format) => format.extensions);
  }

  workspaceDocumentFormats(): Array<{ id: string; extensions: string[] }> {
    return this.supportedDocumentFormats().map((format) => ({ id: format.id, extensions: format.extensions }));
  }

  canRenderDocumentPath(path: string): boolean {
    const extension = documentExtension(path);
    return Boolean(extension && this.supportedDocumentFormats().some((format) => format.extensions.includes(extension)));
  }

  async renderDocument(document: PluginDocumentRenderInput): Promise<{ format: ActivePluginDocumentFormat; result: PluginDocumentRenderResult } | null> {
    const extension = documentExtension(document.path);
    if (!extension) return null;
    const format = this.supportedDocumentFormats().find((item) => item.extensions.includes(extension));
    if (!format) return null;
    const runtime = this.runtimes.get(format.pluginId);
    if (!runtime) return null;
    if (runtime.kind !== "document") return null;
    const result = await runtime.renderDocument(format.id, document);
    return { format, result };
  }

  openPanel(panelId: string) {
    const panel = get(this.writable).panels.find((item) => item.id === panelId);
    if (!panel) return;
    this.writable.update((state) => ({ ...state, activePanelId: panel.id }));
  }

  closePanel(panelId?: string) {
    this.writable.update((state) => {
      if (panelId && state.activePanelId !== panelId) return state;
      return { ...state, activePanelId: null };
    });
  }

  sendPanelMessage(panelId: string, payload: unknown) {
    const panel = get(this.writable).panels.find((item) => item.id === panelId);
    if (!panel) return;
    const runtime = this.runtimes.get(panel.pluginId);
    if (!runtime) throw new Error(`插件 ${panel.pluginName} 当前未运行`);
    if (runtime.kind !== "extension") throw new Error(`插件 ${panel.pluginName} 不是 Extension Runtime`);
    runtime.emitPanelMessage(panel.localId, payload);
  }

  subscribePanelMessages(panelId: string, listener: PluginPanelMessageListener) {
    return this.panelMessages.subscribe(panelId, listener);
  }

  async getPluginSettingValues(pluginId: string): Promise<Record<string, PluginSettingValue>> {
    const schema = this.settings.get(pluginId);
    if (!schema) return {};
    const entries = await Promise.all(schema.fields.map(async (field) => {
      const stored = await this.repository.storageGet<PluginSettingValue>(pluginId, pluginSettingStorageKey(field.key));
      if (stored === null) return [field.key, field.defaultValue] as const;
      try {
        return [field.key, validatePluginSettingValue(field, stored)] as const;
      } catch (error) {
        const message = `设置 ${field.key} 的已保存值无效，已使用默认值：${error instanceof Error ? error.message : String(error)}`;
        this.services.reportError(pluginId, message);
        this.recordDiagnostic(pluginId, { level: "warning", kind: "settings", message });
        return [field.key, field.defaultValue] as const;
      }
    }));
    return Object.fromEntries(entries);
  }

  async setPluginSetting(pluginId: string, key: string, value: PluginSettingValue): Promise<PluginSettingValue> {
    const schema = this.settings.get(pluginId);
    if (!schema) throw new Error("插件当前没有注册设置 schema");
    const field = schema.fields.find((item) => item.key === key);
    if (!field) throw new Error(`未知插件设置：${key}`);
    const normalized = validatePluginSettingValue(field, value);
    await this.repository.storageSet(pluginId, pluginSettingStorageKey(key), normalized);
    const runtime = this.runtimes.get(pluginId);
    if (runtime?.kind === "extension") runtime.emitSettingChanged(key, normalized);
    return normalized;
  }

  async setShortcutOverride(commandId: string, shortcut: string | null) {
    await this.serialize(async () => {
      const rawCommands = this.contributions.snapshot().commands;
      const command = rawCommands.find((item) => item.id === commandId);
      if (!command) throw new Error("插件命令当前不可用；请先启用并加载插件");

      if (shortcut === null) {
        await this.repository.setShortcutOverride(commandId, null);
        this.shortcuts.set(commandId, null);
        this.syncContributionState();
        return;
      }

      const normalized = normalizePluginShortcut(shortcut);
      const defaultShortcut = command.defaultShortcut ?? command.shortcut;
      if (defaultShortcut && normalizePluginShortcut(defaultShortcut) === normalized) {
        await this.repository.clearShortcutOverride(commandId);
        this.shortcuts.clear(commandId);
        this.syncContributionState();
        return;
      }

      const effectiveCommands = this.shortcuts.resolveCommands(rawCommands);
      const conflicts = shortcutAssignmentConflicts(
        commandId,
        normalized,
        effectiveCommands,
        this.services.getReservedShortcuts(),
      );
      if (conflicts.length > 0) {
        throw new Error(`快捷键 ${normalized} 已被占用：${conflicts.join("、")}`);
      }

      await this.repository.setShortcutOverride(commandId, normalized);
      this.shortcuts.set(commandId, normalized);
      this.syncContributionState();
    });
  }

  async resetShortcutOverride(commandId: string) {
    await this.serialize(async () => {
      await this.repository.clearShortcutOverride(commandId);
      this.shortcuts.clear(commandId);
      this.syncContributionState();
    });
  }

  clearPluginDiagnostics(pluginId: string) {
    this.diagnostics.clear(pluginId);
    this.syncDiagnosticsState();
  }

  publishEvent(event: PluginEvent) {
    for (const runtime of this.runtimes.values()) {
      try {
        if (runtime.kind === "extension") runtime.emitEvent(event);
      } catch (error) {
        const message = `派发插件事件 ${event.name} 失败：${error instanceof Error ? error.message : String(error)}`;
        this.services.reportError(runtime.pluginId, message);
        this.recordDiagnostic(runtime.pluginId, { level: "error", kind: "event", message });
      }
    }
  }

  async destroy() {
    const runtimes = [...this.runtimes.values()];
    this.runtimes.clear();
    await Promise.allSettled(runtimes.map((runtime) => runtime.stop()));
    this.contributions.clear();
    this.panelMessages.clear();
    this.settings.clear();
    this.diagnostics.retainPlugins(new Set());
    this.shortcuts.clearAll();
    themeRegistry.replacePluginThemes([]);
    this.writable.set({ ...INITIAL_STATE, themeFamilies: get(themeRegistryState).families, selectedThemeFamily: get(themeRegistryState).selectedFamily });
  }

  private async syncThemeRegistry(plugins: InstalledPlugin[]) {
    const sources: Array<{ pluginId: string; pluginName: string; definitions: Array<{ manifest: ThemeContributionManifest; raw: string }> }> = [];
    for (const plugin of plugins) {
      const themes = plugin.manifest.contributes?.themes ?? [];
      if (!plugin.enabled || !plugin.compatible || themes.length === 0) continue;
      try {
        const bundle = await this.repository.readBundle(plugin.manifest.id);
        sources.push({
          pluginId: plugin.manifest.id,
          pluginName: plugin.manifest.name,
          definitions: themes.map((manifest) => {
            const raw = bundle.themeFiles[manifest.path];
            if (typeof raw !== "string") throw new Error(`主题文件不存在：${manifest.path}`);
            return { manifest, raw };
          }),
        });
      } catch (error) {
        this.services.reportError(plugin.manifest.id, `加载主题贡献失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    themeRegistry.replacePluginThemes(sources);
  }

  private async refreshInternal() {
    const inventory = await this.repository.list();
    await this.syncThemeRegistry(inventory.plugins);
    const themeSnapshot = get(themeRegistryState);
    const current = get(this.writable);
    const installedIds = new Set(inventory.plugins.map((plugin) => plugin.manifest.id));
    const runtimeById = Object.fromEntries(
      Object.entries(current.runtimeById).filter(([id]) => installedIds.has(id)),
    );
    this.contributions.retainPlugins(installedIds);
    this.settings.retainPlugins(installedIds);
    this.diagnostics.retainPlugins(installedIds);
    this.shortcuts.hydrate(inventory.shortcutOverrides);
    const rawContributionSnapshot = this.contributions.snapshot();
    const resolvedCommands = this.shortcuts.resolveCommands(rawContributionSnapshot.commands);
    const contributionSnapshot = { ...rawContributionSnapshot, commands: resolvedCommands };
    const shortcutBindings = this.shortcuts.bindings(rawContributionSnapshot.commands);
    const shortcutConflicts = resolvePluginShortcutConflicts(resolvedCommands, this.services.getReservedShortcuts());
    const diagnosticsSnapshot = this.diagnostics.snapshot(installedIds);
    const activePanelId = current.activePanelId && contributionSnapshot.panels.some((panel) => panel.id === current.activePanelId)
      ? current.activePanelId
      : null;
    this.writable.set({
      ...current,
      plugins: inventory.plugins,
      warnings: inventory.warnings,
      runtimeById,
      themeFamilies: themeSnapshot.families,
      selectedThemeFamily: themeSnapshot.selectedFamily,
      ...contributionSnapshot,
      shortcutBindings,
      shortcutConflicts,
      settingsSchemas: this.settings.snapshot(),
      ...diagnosticsSnapshot,
      activePanelId,
      error: null,
    });
  }

  private async reconcileRuntimes(disableOnFailure: boolean, startupGuard = false) {
    const state = get(this.writable);
    const byId = new Map(state.plugins.map((plugin) => [plugin.manifest.id, plugin]));

    if (state.safeMode) {
      for (const id of [...this.runtimes.keys()]) await this.unloadRuntime(id);
      return;
    }

    for (const id of [...this.runtimes.keys()]) {
      const plugin = byId.get(id);
      if (!plugin || !plugin.enabled || !plugin.compatible) {
        await this.unloadRuntime(id);
      }
    }

    for (const plugin of get(this.writable).plugins) {
      if (!plugin.enabled || !plugin.compatible || this.runtimes.has(plugin.manifest.id) || !pluginHasWorkerRuntime(plugin.manifest)) continue;
      try {
        if (startupGuard) await this.repository.markStartupPlugin(plugin.manifest.id);
        await this.loadRuntime(plugin);
        if (startupGuard) await this.repository.markStartupPlugin(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (startupGuard) await this.repository.markStartupPlugin(null).catch(() => undefined);
        this.services.reportError(plugin.manifest.id, `插件启动失败：${message}`);
        if (disableOnFailure) {
          await this.repository.setEnabled(plugin.manifest.id, false).catch(() => undefined);
          this.upsertPlugin({ ...plugin, enabled: false });
        }
      }
    }
  }

  private async loadRuntime(plugin: InstalledPlugin) {
    if (!pluginHasWorkerRuntime(plugin.manifest)) return;
    const id = plugin.manifest.id;
    if (this.runtimes.has(id)) return;
    this.setRuntime(id, "loading", null);
    this.removePluginContributions(id);
    try {
      const bundle = await this.repository.readBundle(id);
      const runtime = this.runtimeFactory.create(bundle, {
        onCommand: (command) => this.registerCommand(command),
        onCommandRemoved: (commandId) => this.removeCommand(commandId),
        onContribution: (contribution) => this.registerUiContribution(contribution),
        onContributionRemoved: (contributionId) => this.removeUiContribution(contributionId),
        onPanel: (panel) => this.registerPanel(panel),
        onPanelRemoved: (panelId) => this.removePanel(panelId),
        onPanelPostMessage: (panelId, payload) => this.panelMessages.publish(panelId, payload),
        onPanelOpenRequested: (panelId) => this.openPanel(panelId),
        onPanelCloseRequested: (panelId) => this.closePanel(panelId),
        onSettings: (settings) => this.registerSettings(settings),
        onSettingsRemoved: (pluginId) => this.removeSettings(pluginId),
        onDiagnostic: (report) => this.recordDiagnostic(id, report),
        onFatal: (message, reason) => {
          this.runtimes.delete(id);
          this.removePluginContributions(id);
          this.diagnostics.markFaulted(id, message, reason);
          this.syncDiagnosticsState();
          this.setRuntime(id, "error", message);
          void this.repository.setEnabled(id, false)
            .then((updated) => this.upsertPlugin(updated))
            .catch((error) => this.services.reportError(id, `自动禁用失败：${String(error)}`));
        },
      });
      this.runtimes.set(id, runtime);
      await runtime.start();
      this.diagnostics.markActive(id);
      this.syncDiagnosticsState();
      this.setRuntime(id, "active", null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.runtimes.delete(id);
      this.removePluginContributions(id);
      this.diagnostics.markFaulted(id, message, "runtime");
      this.syncDiagnosticsState();
      this.setRuntime(id, "error", message);
      throw error;
    }
  }

  private async unloadRuntime(id: string) {
    const runtime = this.runtimes.get(id);
    this.runtimes.delete(id);
    if (runtime) await runtime.stop();
    this.removePluginContributions(id);
    this.diagnostics.markDisabled(id);
    this.syncDiagnosticsState();
    this.setRuntime(id, "disabled", null);
  }

  private registerCommand(command: PluginCommandContribution) {
    this.contributions.registerCommand(command);
    this.syncContributionState();
  }

  private removeCommand(commandId: string) {
    this.contributions.removeCommand(commandId);
    this.syncContributionState();
  }

  private registerUiContribution(contribution: PluginUiContribution) {
    this.contributions.registerUi(contribution);
    this.syncContributionState();
  }

  private removeUiContribution(contributionId: string) {
    this.contributions.removeUi(contributionId);
    this.syncContributionState();
  }

  private registerPanel(panel: PluginPanelContribution) {
    this.contributions.registerPanel(panel);
    this.syncContributionState();
  }

  private removePanel(panelId: string) {
    this.contributions.removePanel(panelId);
    this.panelMessages.clearPanel(panelId);
    this.syncContributionState();
  }

  private registerSettings(settings: PluginSettingsContribution) {
    this.settings.register(settings);
    this.syncSettingsState();
  }

  private removeSettings(pluginId: string) {
    this.settings.remove(pluginId);
    this.syncSettingsState();
  }

  private removePluginContributions(pluginId: string) {
    this.contributions.clearPlugin(pluginId);
    this.panelMessages.clearPlugin(pluginId);
    this.settings.remove(pluginId);
    this.syncContributionState();
    this.syncSettingsState();
  }

  private syncContributionState() {
    const rawSnapshot = this.contributions.snapshot();
    const commands = this.shortcuts.resolveCommands(rawSnapshot.commands);
    const snapshot = { ...rawSnapshot, commands };
    const shortcutBindings = this.shortcuts.bindings(rawSnapshot.commands);
    const shortcutConflicts = resolvePluginShortcutConflicts(commands, this.services.getReservedShortcuts());
    this.writable.update((state) => ({
      ...state,
      ...snapshot,
      shortcutBindings,
      shortcutConflicts,
      activePanelId: state.activePanelId && snapshot.panels.some((panel) => panel.id === state.activePanelId)
        ? state.activePanelId
        : null,
    }));
  }

  private syncSettingsState() {
    this.writable.update((state) => ({ ...state, settingsSchemas: this.settings.snapshot() }));
  }

  private recordDiagnostic(pluginId: string, report: PluginDiagnosticReport) {
    this.diagnostics.record(pluginId, report);
    this.syncDiagnosticsState();
  }

  private syncDiagnosticsState() {
    const ids = get(this.writable).plugins.map((plugin) => plugin.manifest.id);
    this.writable.update((state) => ({ ...state, ...this.diagnostics.snapshot(ids) }));
  }

  private setRuntime(id: string, status: "disabled" | "loading" | "active" | "error", error: string | null) {
    this.writable.update((state) => ({
      ...state,
      runtimeById: { ...state.runtimeById, [id]: { status, error } },
    }));
  }

  private upsertPlugin(plugin: InstalledPlugin) {
    this.writable.update((state) => ({
      ...state,
      plugins: state.plugins.some((item) => item.manifest.id === plugin.manifest.id)
        ? state.plugins.map((item) => item.manifest.id === plugin.manifest.id ? plugin : item)
        : [...state.plugins, plugin],
    }));
  }

  private patch(partial: Partial<PluginManagerState>) {
    this.writable.update((state) => ({ ...state, ...partial }));
  }

  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.patch({ error: message });
    this.services.reportError("plugin-manager", message);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation);
    this.operation = next.then(() => undefined, () => undefined);
    return next;
  }
}

function normalizeDocumentExtension(value: string): string {
  return String(value ?? "").trim().replace(/^\./, "").toLowerCase();
}

function documentExtension(path: string): string {
  const fileName = String(path ?? "").split(/[\\/]/).pop() ?? "";
  const index = fileName.lastIndexOf(".");
  return index > 0 && index < fileName.length - 1 ? normalizeDocumentExtension(fileName.slice(index + 1)) : "";
}

import { normalizePluginShortcut } from "../domain/shortcut";
import type { PluginRepository } from "../application/plugin-repository";
import { effectivePluginWorkerDescriptor } from "../domain/plugin";
import { isPluginEventName, type PluginBundle, type PluginDiagnosticKind, type PluginDocumentRenderInput, type PluginDocumentRenderResult, type PluginEvent, type PluginPanelContribution, type PluginRuntimeFaultReason, type PluginSettingField, type PluginSettingValue, type PluginSettingsContribution, type PluginUiContribution } from "../domain/plugin";
import type { PluginHostServices } from "../application/plugin-host-services";
import type { DocumentPluginRuntime, ExtensionPluginRuntime, PluginRuntime, PluginRuntimeCallbacks, PluginRuntimeFactory } from "../application/plugin-runtime";
import type { HostToPluginMessage, PluginCommandDefinition, PluginPanelDefinition, PluginSettingsDefinition, PluginToHostMessage, PluginUiContributionDefinition } from "./plugin-protocol";
import { WorkerRuntimeTransport, type WorkerRuntimeTransportHandlers } from "./worker-runtime-transport";
import { PluginPermissionGuard } from "./plugin-permission-guard";
import { PluginHostApiRouter } from "./plugin-host-api-router";
import { clampOrder, normalizeLocalId, normalizeSettingField, validateDocumentRenderResult } from "./runtime-validation";

const START_TIMEOUT_MS = 5_000;
const STOP_GRACE_MS = 160;
const DOCUMENT_RENDER_TIMEOUT_MS = 5_000;
const MAX_DOCUMENT_SOURCE_CHARS = 8_000_000;
const MAX_COMMANDS = 64;
const MAX_EVENT_SUBSCRIPTIONS = 16;
const MAX_UI_CONTRIBUTIONS = 24;
const MAX_PANELS = 8;
const MAX_PANEL_HTML_CHARS = 256_000;
const MAX_PANEL_CSS_CHARS = 128_000;
const MAX_SETTINGS_FIELDS = 32;
const SOFT_ERROR_WINDOW_MS = 60_000;
const MAX_SOFT_ERRORS_PER_WINDOW = 5;

/**
 * Runs third-party plugin logic in a dedicated Web Worker.
 *
 * The Worker is a capability boundary, not a mirror of the app environment:
 * - no DOM / Svelte / ProseMirror / Tauri globals;
 * - network primitives are disabled before plugin code runs;
 * - all host access crosses a typed postMessage RPC boundary;
 * - a stuck onLoad can be terminated without freezing the main UI thread.
 */
class WorkerPluginRuntimeCore {
  readonly pluginId: string;
  readonly kind: "document" | "extension";
  private readonly transport: WorkerRuntimeTransport;
  private readonly transportHandlers: WorkerRuntimeTransportHandlers;
  private readonly permissionGuard: PluginPermissionGuard;
  private readonly hostApiRouter: PluginHostApiRouter;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private resolveUnloaded: (() => void) | null = null;
  private readonly registeredCommands = new Set<string>();
  private readonly registeredContributions = new Map<string, string>();
  private readonly registeredPanels = new Set<string>();
  private readonly subscribedEvents = new Set<string>();
  private settingsRegistered = false;
  private settingsFields = new Map<string, PluginSettingField>();
  private softErrorTimestamps: number[] = [];
  private renderRequestCounter = 0;
  private readonly pendingDocumentRenders = new Map<string, { resolve: (value: PluginDocumentRenderResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly bundle: PluginBundle,
    private readonly repository: PluginRepository,
    private readonly services: PluginHostServices,
    private readonly callbacks: PluginRuntimeCallbacks,
  ) {
    this.pluginId = bundle.manifest.id;
    const descriptor = effectivePluginWorkerDescriptor(bundle.manifest);
    if (!descriptor || !bundle.mainJs) throw new Error("插件没有可启动的 Worker runtime");
    this.kind = descriptor.role;
    this.transport = new WorkerRuntimeTransport(this.pluginId);
    this.transportHandlers = {
      onMessage: (event) => this.handleMessage(event),
      onError: (event) => this.handleWorkerError(event),
      onMessageError: () => this.handleMessageError(),
    };
    this.permissionGuard = new PluginPermissionGuard(bundle.manifest);
    this.hostApiRouter = new PluginHostApiRouter({
      pluginId: this.pluginId,
      repository: this.repository,
      services: this.services,
      guard: this.permissionGuard,
      getSettingField: (key) => this.settingsFields.get(key),
      post: (message) => this.post(message),
      diagnostic: (report) => this.callbacks.onDiagnostic(report),
    });
  }

  async start(): Promise<void> {
    if (this.transport.active) return this.readyPromise ?? Promise.resolve();

    if (!this.bundle.mainJs) throw new Error("插件 Worker runtime 缺少 main.js");
    this.transport.start(this.kind, this.bundle.mainJs, this.transportHandlers);

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
      this.readyTimeout = setTimeout(() => reject(new Error("插件启动超时，已终止运行")), START_TIMEOUT_MS);
    });

    try {
      await this.readyPromise;
    } catch (error) {
      this.terminate();
      throw error;
    }
  }

  invokeCommand(localId: string) {
    if (!this.registeredCommands.has(localId)) {
      throw new Error(`插件命令不存在：${localId}`);
    }
    this.post({ channel: "mdv-host", type: "invoke-command", commandId: localId });
  }

  renderDocument(formatId: string, document: PluginDocumentRenderInput): Promise<PluginDocumentRenderResult> {
    if (!this.transport.active) return Promise.reject(new Error("插件当前未运行"));
    const format = this.bundle.manifest.contributes?.documentFormats?.find((item) => item.id === formatId);
    if (!format) return Promise.reject(new Error(`插件未声明文档格式：${formatId}`));
    if (document.source.length > MAX_DOCUMENT_SOURCE_CHARS) {
      return Promise.reject(new Error("文档超过插件渲染 8,000,000 字符限制，已保留纯文本模式"));
    }
    const requestId = `${this.pluginId}:render:${++this.renderRequestCounter}`;
    return new Promise<PluginDocumentRenderResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingDocumentRenders.delete(requestId);
        const message = `插件文档渲染超时：${format.label}`;
        reject(new Error(message));
        // A renderer can loop forever inside its Worker. A host-side Promise timeout alone would
        // leave that Worker wedged, so terminate the runtime just like a startup timeout.
        this.failRuntime(message, "runtime");
      }, DOCUMENT_RENDER_TIMEOUT_MS);
      this.pendingDocumentRenders.set(requestId, { resolve, reject, timer });
      this.post({ channel: "mdv-host", type: "render-document", requestId, formatId, document });
    });
  }

  emitEvent(event: PluginEvent) {
    if (!this.transport.active || !this.subscribedEvents.has(event.name)) return;
    this.post({ channel: "mdv-host", type: "event", eventName: event.name, payload: event.payload });
  }

  emitPanelMessage(localId: string, payload: unknown) {
    if (!this.transport.active || !this.registeredPanels.has(localId)) return;
    this.post({ channel: "mdv-host", type: "panel-message", panelId: localId, payload });
  }

  emitSettingChanged(key: string, value: PluginSettingValue) {
    if (!this.transport.active || !this.settingsRegistered || !this.settingsFields.has(key)) return;
    this.post({ channel: "mdv-host", type: "settings-changed", key, value });
  }

  async stop(): Promise<void> {
    if (!this.transport.active) return;
    const unloaded = new Promise<void>((resolve) => {
      this.resolveUnloaded = resolve;
      setTimeout(resolve, STOP_GRACE_MS);
    });
    this.post({ channel: "mdv-host", type: "unload" });
    await unloaded;
    this.terminate();
  }

  private readonly handleMessage = (event: MessageEvent<PluginToHostMessage>) => {
    const message = event.data;
    if (!message || message.channel !== "mdv-plugin" || message.pluginId !== this.pluginId) return;

    if (message.type === "ready") {
      if (this.readyTimeout) clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }
    if (message.type === "unloaded") {
      this.resolveUnloaded?.();
      this.resolveUnloaded = null;
      return;
    }
    if (message.type === "fatal") {
      this.failRuntime(message.error || "插件运行失败", "runtime");
      return;
    }
    if (message.type === "register-command") {
      try {
        this.registerCommand(message.command);
      } catch (error) {
        this.failRuntime(error instanceof Error ? error.message : String(error), "runtime");
      }
      return;
    }
    if (message.type === "unregister-command") {
      const localId = normalizeLocalId(message.commandId);
      this.registeredCommands.delete(localId);
      this.callbacks.onCommandRemoved(`${this.pluginId}:${localId}`);
      for (const [contributionId, commandId] of [...this.registeredContributions]) {
        if (commandId !== localId) continue;
        this.registeredContributions.delete(contributionId);
        this.callbacks.onContributionRemoved(`${this.pluginId}:${contributionId}`);
      }
      return;
    }
    if (message.type === "register-contribution") {
      try {
        this.registerContribution(message.contribution);
      } catch (error) {
        this.failRuntime(error instanceof Error ? error.message : String(error), "runtime");
      }
      return;
    }
    if (message.type === "unregister-contribution") {
      const localId = normalizeLocalId(message.contributionId);
      this.registeredContributions.delete(localId);
      this.callbacks.onContributionRemoved(`${this.pluginId}:${localId}`);
      return;
    }
    if (message.type === "register-panel") {
      try {
        this.registerPanel(message.panel);
      } catch (error) {
        this.failRuntime(error instanceof Error ? error.message : String(error), "runtime");
      }
      return;
    }
    if (message.type === "unregister-panel") {
      const localId = normalizeLocalId(message.panelId);
      this.registeredPanels.delete(localId);
      this.callbacks.onPanelRemoved(`${this.pluginId}:${localId}`);
      return;
    }
    if (message.type === "open-panel") {
      const localId = normalizeLocalId(message.panelId);
      if (this.registeredPanels.has(localId)) this.callbacks.onPanelOpenRequested(`${this.pluginId}:${localId}`);
      return;
    }
    if (message.type === "close-panel") {
      const localId = normalizeLocalId(message.panelId);
      if (this.registeredPanels.has(localId)) this.callbacks.onPanelCloseRequested(`${this.pluginId}:${localId}`);
      return;
    }
    if (message.type === "panel-post-message") {
      const localId = normalizeLocalId(message.panelId);
      if (this.registeredPanels.has(localId)) this.callbacks.onPanelPostMessage(`${this.pluginId}:${localId}`, message.payload);
      return;
    }
    if (message.type === "panel-error") {
      this.recordRecoverableError("panel", `面板 ${message.panelId} 处理失败：${message.error}`);
      return;
    }
    if (message.type === "register-settings") {
      try {
        this.registerSettings(message.settings);
      } catch (error) {
        this.failRuntime(error instanceof Error ? error.message : String(error), "runtime");
      }
      return;
    }
    if (message.type === "unregister-settings") {
      this.settingsRegistered = false;
      this.settingsFields.clear();
      this.callbacks.onSettingsRemoved(this.pluginId);
      return;
    }
    if (message.type === "subscribe-event") {
      try {
        this.subscribeEvent(message.eventName);
      } catch (error) {
        this.failRuntime(error instanceof Error ? error.message : String(error), "runtime");
      }
      return;
    }
    if (message.type === "unsubscribe-event") {
      if (isPluginEventName(message.eventName)) this.subscribedEvents.delete(message.eventName);
      return;
    }
    if (message.type === "render-document-result") {
      const pending = this.pendingDocumentRenders.get(message.requestId);
      if (!pending) return;
      this.pendingDocumentRenders.delete(message.requestId);
      clearTimeout(pending.timer);
      if (!message.ok) {
        const errorMessage = message.error || "插件文档渲染失败";
        pending.reject(new Error(errorMessage));
        this.recordRecoverableError("runtime", `文档 renderer 失败：${errorMessage}`);
        return;
      }
      try {
        pending.resolve(validateDocumentRenderResult(message.result));
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    if (message.type === "command-error") {
      this.recordRecoverableError("command", `命令 ${message.commandId} 执行失败：${message.error}`);
      return;
    }
    if (message.type === "event-error") {
      this.recordRecoverableError("event", `事件 ${message.eventName} 处理失败：${message.error}`);
      return;
    }
    if (message.type === "request") {
      void this.hostApiRouter.handle(message.requestId, message.method, message.args);
    }
  };

  private readonly handleWorkerError = (event: ErrorEvent) => {
    const detail = event.error instanceof Error ? event.error.stack || event.error.message : event.message || "插件 Worker 运行异常";
    const location = [
      event.filename,
      event.lineno ? `line ${event.lineno}` : "",
      event.colno ? `column ${event.colno}` : "",
    ].filter(Boolean).join(":");
    this.failRuntime(location && !detail.includes(location) ? `${detail}\n${location}` : detail, "runtime");
  };

  private readonly handleMessageError = () => {
    this.failRuntime("插件发送了无法序列化的数据", "runtime");
  };

  private registerCommand(command: PluginCommandDefinition) {
    this.permissionGuard.require("commands");
    const localId = normalizeLocalId(command.id);
    if (!command.title?.trim()) throw new Error("插件命令缺少 title");
    if (!this.registeredCommands.has(localId) && this.registeredCommands.size >= MAX_COMMANDS) {
      throw new Error(`单个插件最多注册 ${MAX_COMMANDS} 个命令`);
    }
    this.registeredCommands.add(localId);
    const defaultShortcut = command.shortcut ? normalizePluginShortcut(command.shortcut) : undefined;
    this.callbacks.onCommand({
      id: `${this.pluginId}:${localId}`,
      pluginId: this.pluginId,
      pluginName: this.bundle.manifest.name,
      localId,
      title: command.title.trim().slice(0, 100),
      description: command.description?.trim().slice(0, 180),
      keywords: (command.keywords ?? []).filter((item): item is string => typeof item === "string").slice(0, 12),
      shortcut: defaultShortcut,
      defaultShortcut,
    });
  }

  private registerContribution(definition: PluginUiContributionDefinition) {
    this.permissionGuard.require("ui.contribute");
    const localId = normalizeLocalId(definition.id);
    const commandId = normalizeLocalId(definition.command);
    if (!definition.label?.trim()) throw new Error("UI contribution 缺少 label");
    if (!this.registeredCommands.has(commandId)) {
      throw new Error(`UI contribution 必须引用已注册命令：${commandId}`);
    }
    if (!(["statusbar", "context-menu", "toolbar"] as const).includes(definition.placement)) {
      throw new Error(`不支持的 UI contribution placement：${String(definition.placement)}`);
    }
    if (!this.registeredContributions.has(localId) && this.registeredContributions.size >= MAX_UI_CONTRIBUTIONS) {
      throw new Error(`单个插件最多注册 ${MAX_UI_CONTRIBUTIONS} 个 UI contribution`);
    }
    const when = definition.when ?? "always";
    if (!(["always", "document", "editable", "selection", "link"] as const).includes(when)) {
      throw new Error(`不支持的 contribution when：${String(when)}`);
    }
    const side = definition.side ?? "right";
    if (side !== "left" && side !== "right") throw new Error("statusbar side 只能是 left 或 right");
    const icon = definition.icon;
    if (icon && !(["code", "document", "search", "refresh", "plus", "more"] as const).includes(icon)) {
      throw new Error(`不支持的 contribution icon：${String(icon)}`);
    }
    this.registeredContributions.set(localId, commandId);
    const contribution: PluginUiContribution = {
      id: `${this.pluginId}:${localId}`,
      pluginId: this.pluginId,
      pluginName: this.bundle.manifest.name,
      localId,
      placement: definition.placement,
      label: definition.label.trim().slice(0, 60),
      commandId,
      tooltip: definition.tooltip?.trim().slice(0, 140),
      icon,
      order: clampOrder(definition.order),
      when,
      side,
    };
    this.callbacks.onContribution(contribution);
  }

  private registerPanel(definition: PluginPanelDefinition) {
    this.permissionGuard.require("ui.panel");
    const localId = normalizeLocalId(definition.id);
    if (!definition.title?.trim()) throw new Error("插件面板缺少 title");
    if (typeof definition.html !== "string") throw new Error("插件面板 html 必须是字符串");
    if (definition.html.length > MAX_PANEL_HTML_CHARS) throw new Error("插件面板 HTML 超过 256,000 字符限制");
    if ((definition.css?.length ?? 0) > MAX_PANEL_CSS_CHARS) throw new Error("插件面板 CSS 超过 128,000 字符限制");
    if (!this.registeredPanels.has(localId) && this.registeredPanels.size >= MAX_PANELS) {
      throw new Error(`单个插件最多注册 ${MAX_PANELS} 个面板`);
    }
    const when = definition.when ?? "always";
    if (!(["always", "document", "editable", "selection", "link"] as const).includes(when)) {
      throw new Error(`不支持的 panel when：${String(when)}`);
    }
    const icon = definition.icon;
    if (icon && !(["code", "document", "search", "refresh", "plus", "more"] as const).includes(icon)) {
      throw new Error(`不支持的 panel icon：${String(icon)}`);
    }
    this.registeredPanels.add(localId);
    const panel: PluginPanelContribution = {
      id: `${this.pluginId}:${localId}`,
      pluginId: this.pluginId,
      pluginName: this.bundle.manifest.name,
      localId,
      title: definition.title.trim().slice(0, 80),
      html: definition.html,
      css: definition.css,
      icon,
      order: clampOrder(definition.order),
      when,
    };
    this.callbacks.onPanel(panel);
  }

  private registerSettings(definition: PluginSettingsDefinition) {
    this.permissionGuard.require("settings");
    if (this.settingsRegistered) throw new Error("一个插件只能注册一个 settings schema");
    if (!definition || !Array.isArray(definition.fields)) throw new Error("settings.register 需要 fields 数组");
    if (definition.fields.length === 0) throw new Error("插件设置至少需要一个字段");
    if (definition.fields.length > MAX_SETTINGS_FIELDS) throw new Error(`单个插件最多注册 ${MAX_SETTINGS_FIELDS} 个设置项`);

    const fields = definition.fields.map((field) => normalizeSettingField(field));
    const keys = new Set<string>();
    for (const field of fields) {
      if (keys.has(field.key)) throw new Error(`插件设置 key 重复：${field.key}`);
      keys.add(field.key);
    }
    this.settingsRegistered = true;
    this.settingsFields = new Map(fields.map((field) => [field.key, field]));
    const settings: PluginSettingsContribution = {
      pluginId: this.pluginId,
      pluginName: this.bundle.manifest.name,
      title: String(definition.title ?? "插件设置").trim().slice(0, 80) || "插件设置",
      fields,
    };
    this.callbacks.onSettings(settings);
  }

  private subscribeEvent(eventName: string) {
    this.permissionGuard.require("events");
    if (!isPluginEventName(eventName)) throw new Error(`不支持的插件事件：${eventName}`);
    if (!this.subscribedEvents.has(eventName) && this.subscribedEvents.size >= MAX_EVENT_SUBSCRIPTIONS) {
      throw new Error(`单个插件最多订阅 ${MAX_EVENT_SUBSCRIPTIONS} 类事件`);
    }
    this.subscribedEvents.add(eventName);
  }

  private recordRecoverableError(kind: PluginDiagnosticKind, message: string) {
    this.services.reportError(this.pluginId, message);
    this.callbacks.onDiagnostic({ level: "error", kind, message });
    const now = Date.now();
    this.softErrorTimestamps = this.softErrorTimestamps.filter((time) => now - time <= SOFT_ERROR_WINDOW_MS);
    this.softErrorTimestamps.push(now);
    if (this.softErrorTimestamps.length >= MAX_SOFT_ERRORS_PER_WINDOW) {
      this.failRuntime(
        `插件在 60 秒内发生 ${MAX_SOFT_ERRORS_PER_WINDOW} 次处理异常，已自动熔断并禁用。最后错误：${message}`,
        "circuit-breaker",
      );
    }
  }

  private failRuntime(message: string, reason: PluginRuntimeFaultReason) {
    this.callbacks.onFatal(message, reason);
    this.services.reportError(this.pluginId, message);
    if (this.rejectReady) {
      const reject = this.rejectReady;
      this.rejectReady = null;
      reject(new Error(message));
      return;
    }
    this.terminate();
  }

  private post(message: HostToPluginMessage) {
    if (!this.transport.active) return;
    this.transport.post(message);
  }

  private terminate() {
    if (this.readyTimeout) clearTimeout(this.readyTimeout);
    this.readyTimeout = null;
    this.transport.terminate(this.transportHandlers);
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
    this.resolveUnloaded = null;
    this.registeredCommands.clear();
    this.registeredContributions.clear();
    this.registeredPanels.clear();
    this.subscribedEvents.clear();
    this.settingsRegistered = false;
    this.settingsFields.clear();
    this.softErrorTimestamps = [];
    for (const pending of this.pendingDocumentRenders.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("插件运行时已停止"));
    }
    this.pendingDocumentRenders.clear();
  }

}

export class WorkerPluginRuntimeFactory implements PluginRuntimeFactory {
  constructor(
    private readonly repository: PluginRepository,
    private readonly services: PluginHostServices,
  ) {}

  create(bundle: PluginBundle, callbacks: PluginRuntimeCallbacks): PluginRuntime {
    const core = new WorkerPluginRuntimeCore(bundle, this.repository, this.services, callbacks);
    return core.kind === "document"
      ? new DocumentWorkerPluginRuntime(core)
      : new ExtensionWorkerPluginRuntime(core);
  }
}

class DocumentWorkerPluginRuntime implements DocumentPluginRuntime {
  readonly kind = "document" as const;
  constructor(private readonly core: WorkerPluginRuntimeCore) {}
  get pluginId() { return this.core.pluginId; }
  start() { return this.core.start(); }
  stop() { return this.core.stop(); }
  renderDocument(formatId: string, document: PluginDocumentRenderInput) {
    return this.core.renderDocument(formatId, document);
  }
}

class ExtensionWorkerPluginRuntime implements ExtensionPluginRuntime {
  readonly kind = "extension" as const;
  constructor(private readonly core: WorkerPluginRuntimeCore) {}
  get pluginId() { return this.core.pluginId; }
  start() { return this.core.start(); }
  stop() { return this.core.stop(); }
  invokeCommand(localId: string) { this.core.invokeCommand(localId); }
  emitEvent(event: PluginEvent) { this.core.emitEvent(event); }
  emitPanelMessage(localId: string, payload: unknown) { this.core.emitPanelMessage(localId, payload); }
  emitSettingChanged(key: string, value: PluginSettingValue) { this.core.emitSettingChanged(key, value); }
}

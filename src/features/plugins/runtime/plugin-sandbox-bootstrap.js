// @ts-nocheck
(() => {
  "use strict";

  const init = globalThis.__MDV_PLUGIN_INIT__;
  if (!init || typeof init.pluginId !== "string" || !["document", "extension"].includes(init.runtime)) {
    throw new Error("Plugin sandbox bootstrap 缺少有效初始化参数");
  }

  const pluginId = init.pluginId;
  const runtimeKind = init.runtime;
  try { delete globalThis.__MDV_PLUGIN_INIT__; } catch (_) {}

  const nativePostMessage = globalThis.postMessage.bind(globalThis);
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const nativeSetInterval = globalThis.setInterval.bind(globalThis);
  let definition = null;
  let requestCounter = 0;
  const pending = new Map();
  const commandHandlers = new Map();
  const eventHandlers = new Map();
  const panelHandlers = new Map();
  const registeredPanels = new Set();
  const settingsHandlers = new Set();
  let settingsRegistered = false;
  let fatalSent = false;

  const send = (payload) => nativePostMessage({ channel: "mdv-plugin", pluginId, ...payload });
  const errorText = (error, fallback = "插件运行失败") => {
    if (error instanceof Error) return error.stack || error.message || fallback;
    if (error && typeof error === "object" && "message" in error) return String(error.message || fallback);
    return error == null ? fallback : String(error);
  };
  const fatal = (error) => {
    if (fatalSent) return;
    fatalSent = true;
    send({ type: "fatal", error: errorText(error) });
  };

  const blocked = (name) => () => { throw new Error(`Plugin Runtime 不允许 ${name}`); };
  const deniedNetwork = () => Promise.reject(new Error("Plugin Runtime 不允许直接网络访问"));
  const defineLocked = (target, name, value) => {
    try { Object.defineProperty(target, name, { value, configurable: false, writable: false }); } catch (_) {}
  };

  // Browser-level capability reduction. This is not presented as an OS security sandbox.
  for (const [name, value] of [
    ["fetch", deniedNetwork],
    ["WebSocket", undefined],
    ["EventSource", undefined],
    ["XMLHttpRequest", undefined],
    ["WebTransport", undefined],
    ["Worker", undefined],
    ["SharedWorker", undefined],
    ["BroadcastChannel", undefined],
    ["indexedDB", undefined],
    ["caches", undefined],
    ["importScripts", blocked("importScripts")],
    ["close", blocked("close")],
    ["postMessage", undefined],
  ]) defineLocked(globalThis, name, value);
  try { defineLocked(navigator, "storage", undefined); } catch (_) {}

  // Keep strict CSP and close the common dynamic-code constructors inside the plugin realm.
  const blockedDynamicCode = blocked("动态代码执行");
  const NativeFunction = globalThis.Function;
  defineLocked(globalThis, "eval", blockedDynamicCode);
  defineLocked(globalThis, "Function", blockedDynamicCode);
  try { Object.defineProperty(NativeFunction.prototype, "constructor", { value: blockedDynamicCode, configurable: false, writable: false }); } catch (_) {}
  for (const fn of [async function(){}, function*(){}, async function*(){}]) {
    try {
      const proto = Object.getPrototypeOf(fn);
      if (proto) Object.defineProperty(proto, "constructor", { value: blockedDynamicCode, configurable: false, writable: false });
    } catch (_) {}
  }
  defineLocked(globalThis, "setTimeout", (handler, timeout, ...args) => {
    if (typeof handler !== "function") throw new Error("Plugin Runtime 不允许字符串 setTimeout");
    return nativeSetTimeout(handler, timeout, ...args);
  });
  defineLocked(globalThis, "setInterval", (handler, timeout, ...args) => {
    if (typeof handler !== "function") throw new Error("Plugin Runtime 不允许字符串 setInterval");
    return nativeSetInterval(handler, timeout, ...args);
  });

  const request = (method, ...args) => {
    if (runtimeKind !== "extension") return Promise.reject(new Error("Document Runtime 不开放 Host API"));
    return new Promise((resolve, reject) => {
      const requestId = `${pluginId}:${++requestCounter}`;
      pending.set(requestId, { resolve, reject });
      send({ type: "request", requestId, method, args });
    });
  };

  const extensionContext = Object.freeze({
    commands: Object.freeze({
      register(command) {
        if (!command || typeof command.id !== "string" || typeof command.title !== "string" || typeof command.run !== "function") {
          throw new Error("commands.register 需要 id、title 和 run");
        }
        commandHandlers.set(command.id, command.run);
        send({
          type: "register-command",
          command: {
            id: command.id,
            title: command.title,
            description: command.description || "",
            keywords: Array.isArray(command.keywords) ? command.keywords : [],
            shortcut: typeof command.shortcut === "string" ? command.shortcut : undefined,
          },
        });
        return () => {
          if (!commandHandlers.delete(command.id)) return;
          send({ type: "unregister-command", commandId: command.id });
        };
      },
    }),
    ui: Object.freeze({
      notice: (message) => request("ui.notice", message),
      contribute(contribution) {
        if (!contribution || typeof contribution.id !== "string" || typeof contribution.placement !== "string" || typeof contribution.label !== "string" || typeof contribution.command !== "string") {
          throw new Error("ui.contribute 需要 id、placement、label 和 command");
        }
        send({ type: "register-contribution", contribution });
        return () => send({ type: "unregister-contribution", contributionId: contribution.id });
      },
      registerPanel(panel) {
        if (!panel || typeof panel.id !== "string" || typeof panel.title !== "string" || typeof panel.html !== "string") {
          throw new Error("ui.registerPanel 需要 id、title 和 html");
        }
        const panelId = panel.id;
        registeredPanels.add(panelId);
        send({ type: "register-panel", panel });
        return Object.freeze({
          open() { if (registeredPanels.has(panelId)) send({ type: "open-panel", panelId }); },
          close() { if (registeredPanels.has(panelId)) send({ type: "close-panel", panelId }); },
          postMessage(payload) { if (registeredPanels.has(panelId)) send({ type: "panel-post-message", panelId, payload }); },
          onMessage(handler) {
            if (typeof handler !== "function") throw new Error("panel.onMessage 需要处理函数");
            let handlers = panelHandlers.get(panelId);
            if (!handlers) { handlers = new Set(); panelHandlers.set(panelId, handlers); }
            handlers.add(handler);
            return () => {
              const current = panelHandlers.get(panelId);
              if (!current || !current.delete(handler)) return;
              if (current.size === 0) panelHandlers.delete(panelId);
            };
          },
          dispose() {
            if (!registeredPanels.delete(panelId)) return;
            panelHandlers.delete(panelId);
            send({ type: "unregister-panel", panelId });
          },
        });
      },
    }),
    workspace: Object.freeze({ getActiveFile: () => request("workspace.getActiveFile") }),
    editor: Object.freeze({
      getDocument: () => request("editor.getDocument"),
      getSelection: () => request("editor.getSelection"),
      replaceSelection: (text) => request("editor.replaceSelection", text),
      insertText: (text) => request("editor.insertText", text),
    }),
    events: Object.freeze({
      on(eventName, handler) {
        if (typeof eventName !== "string" || typeof handler !== "function") throw new Error("events.on 需要事件名和处理函数");
        let handlers = eventHandlers.get(eventName);
        if (!handlers) {
          handlers = new Set();
          eventHandlers.set(eventName, handlers);
          send({ type: "subscribe-event", eventName });
        }
        handlers.add(handler);
        return () => {
          const current = eventHandlers.get(eventName);
          if (!current || !current.delete(handler)) return;
          if (current.size === 0) {
            eventHandlers.delete(eventName);
            send({ type: "unsubscribe-event", eventName });
          }
        };
      },
    }),
    clipboard: Object.freeze({ writeText: (text) => request("clipboard.writeText", text) }),
    storage: Object.freeze({
      get: (key) => request("storage.get", key),
      set: (key, value) => request("storage.set", key, value),
      delete: (key) => request("storage.delete", key),
    }),
    settings: Object.freeze({
      register(settings) {
        if (settingsRegistered) throw new Error("一个插件只能注册一个 settings schema");
        if (!settings || !Array.isArray(settings.fields)) throw new Error("settings.register 需要 fields 数组");
        settingsRegistered = true;
        send({ type: "register-settings", settings });
        return () => {
          if (!settingsRegistered) return;
          settingsRegistered = false;
          send({ type: "unregister-settings" });
        };
      },
      get: (key) => request("settings.get", key),
      set: (key, value) => request("settings.set", key, value),
      onChanged(handler) {
        if (typeof handler !== "function") throw new Error("settings.onChanged 需要处理函数");
        settingsHandlers.add(handler);
        return () => settingsHandlers.delete(handler);
      },
    }),
  });
  const documentContext = Object.freeze({});

  Object.defineProperty(globalThis, "markdownViewer", {
    value: Object.freeze({
      definePlugin(value) {
        if (definition) throw new Error("一个插件只能调用一次 definePlugin");
        if (!value || typeof value !== "object") throw new Error("definePlugin 参数无效");
        definition = value;
      },
    }),
    configurable: false,
    writable: false,
  });

  self.addEventListener("message", async (event) => {
    const message = event.data;
    if (!message || message.channel !== "mdv-host") return;

    if (message.type === "response") {
      const item = pending.get(message.requestId);
      if (!item) return;
      pending.delete(message.requestId);
      message.ok ? item.resolve(message.value) : item.reject(new Error(message.error));
      return;
    }
    if (message.type === "render-document") {
      if (runtimeKind !== "document") return;
      const formats = definition && definition.documentFormats;
      const rendererDefinition = formats && formats[message.formatId];
      const renderer = typeof rendererDefinition === "function" ? rendererDefinition : rendererDefinition && rendererDefinition.render;
      if (typeof renderer !== "function") {
        send({ type: "render-document-result", requestId: message.requestId, ok: false, error: `插件未实现 documentFormats.${message.formatId}` });
        return;
      }
      try {
        const result = await renderer(message.document);
        send({ type: "render-document-result", requestId: message.requestId, ok: true, result });
      } catch (error) {
        send({ type: "render-document-result", requestId: message.requestId, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (runtimeKind !== "extension") {
      if (message.type === "unload") {
        try { if (definition && typeof definition.onUnload === "function") await definition.onUnload(); } catch (_) {}
        pending.clear();
        send({ type: "unloaded" });
      }
      return;
    }
    if (message.type === "invoke-command") {
      const handler = commandHandlers.get(message.commandId);
      if (!handler) return;
      try { await handler(); } catch (error) { send({ type: "command-error", commandId: message.commandId, error: error instanceof Error ? error.message : String(error) }); }
      return;
    }
    if (message.type === "event") {
      const handlers = eventHandlers.get(message.eventName);
      if (!handlers || handlers.size === 0) return;
      for (const handler of [...handlers]) {
        try { await handler(message.payload); }
        catch (error) { send({ type: "event-error", eventName: message.eventName, error: error instanceof Error ? error.message : String(error) }); }
      }
      return;
    }
    if (message.type === "panel-message") {
      const handlers = panelHandlers.get(message.panelId);
      if (!handlers || handlers.size === 0) return;
      for (const handler of [...handlers]) {
        try { await handler(message.payload); }
        catch (error) { send({ type: "panel-error", panelId: message.panelId, error: error instanceof Error ? error.message : String(error) }); }
      }
      return;
    }
    if (message.type === "settings-changed") {
      for (const handler of [...settingsHandlers]) {
        try { await handler({ key: message.key, value: message.value }); }
        catch (error) { send({ type: "event-error", eventName: "settings.changed", error: error instanceof Error ? error.message : String(error) }); }
      }
      return;
    }
    if (message.type === "unload") {
      try { if (definition && typeof definition.onUnload === "function") await definition.onUnload(); } catch (_) {}
      commandHandlers.clear();
      eventHandlers.clear();
      panelHandlers.clear();
      registeredPanels.clear();
      settingsHandlers.clear();
      settingsRegistered = false;
      pending.clear();
      send({ type: "unloaded" });
    }
  });

  self.addEventListener("error", (event) => {
    const location = [event.filename, event.lineno ? `line ${event.lineno}` : "", event.colno ? `column ${event.colno}` : ""].filter(Boolean).join(":");
    const detail = event.error ? errorText(event.error, event.message) : String(event.message || "插件脚本异常");
    fatal(location ? `${detail}\n${location}` : detail);
    event.preventDefault?.();
  });
  self.addEventListener("unhandledrejection", (event) => {
    fatal(event.reason instanceof Error ? event.reason : new Error(String(event.reason ?? "插件 Promise 未处理异常")));
    event.preventDefault?.();
  });

  Promise.resolve().then(async () => {
    if (!definition) throw new Error("main.js 必须调用 markdownViewer.definePlugin(...)");
    if (runtimeKind === "document" && (!definition.documentFormats || typeof definition.documentFormats !== "object")) {
      throw new Error("Document Runtime 必须实现 documentFormats");
    }
    if (runtimeKind === "extension" && definition.documentFormats) {
      throw new Error("Extension Runtime 不允许实现 documentFormats");
    }
    if (typeof definition.onLoad === "function") {
      await definition.onLoad(runtimeKind === "document" ? documentContext : extensionContext);
    }
    send({ type: "ready" });
  }).catch(fatal);
})();

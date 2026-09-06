import type { HostToPluginMessage, PluginToHostMessage, RuntimeHostInitMessage } from "./plugin-protocol";

let sandbox: Worker | null = null;
let pluginId = "";
let runtimeKind: "document" | "extension" | null = null;
let sandboxUrl: string | null = null;

const DOCUMENT_MESSAGES = new Set(["ready", "unloaded", "fatal", "render-document-result"]);

function sendFatal(message: string) {
  if (!pluginId) return;
  self.postMessage({ channel: "mdv-plugin", pluginId, type: "fatal", error: message } satisfies PluginToHostMessage);
}

function cleanup() {
  sandbox?.terminate();
  sandbox = null;
  if (sandboxUrl) URL.revokeObjectURL(sandboxUrl);
  sandboxUrl = null;
}

function initialize(message: RuntimeHostInitMessage) {
  if (sandbox) throw new Error("Plugin Host 已初始化");
  pluginId = message.pluginId;
  runtimeKind = message.runtime;
  const bootstrapUrl = new URL("./plugin-sandbox-bootstrap.js", import.meta.url).href;
  const source = [
    `self.__MDV_PLUGIN_INIT__=${JSON.stringify({ pluginId, runtime: runtimeKind })};`,
    `importScripts(${JSON.stringify(bootstrapUrl)});`,
    message.mainJs,
    `\n//# sourceURL=mdv-plugin-${pluginId}.js`,
  ].join("\n");
  const blob = new Blob([source], { type: "text/javascript" });
  sandboxUrl = URL.createObjectURL(blob);
  sandbox = new Worker(sandboxUrl, { name: `mdv-plugin-sandbox:${pluginId}` });
  sandbox.addEventListener("message", (event: MessageEvent<PluginToHostMessage>) => {
    const payload = event.data;
    if (!payload || payload.channel !== "mdv-plugin" || payload.pluginId !== pluginId) return;
    if (runtimeKind === "document" && !DOCUMENT_MESSAGES.has(payload.type)) {
      sendFatal(`Document Runtime 发送了不允许的消息：${payload.type}`);
      cleanup();
      return;
    }
    self.postMessage(payload);
  });
  sandbox.addEventListener("error", (event) => {
    const location = [event.filename, event.lineno ? `line ${event.lineno}` : "", event.colno ? `column ${event.colno}` : ""].filter(Boolean).join(":");
    sendFatal(`${event.message || "插件 Sandbox 异常"}${location ? `\n${location}` : ""}`);
    cleanup();
  });
  sandbox.addEventListener("messageerror", () => {
    sendFatal("插件 Sandbox 返回了无法反序列化的消息");
    cleanup();
  });
}

self.addEventListener("message", (event: MessageEvent<RuntimeHostInitMessage | HostToPluginMessage>) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  try {
    if (message.channel === "mdv-runtime-host" && message.type === "initialize") {
      initialize(message);
      return;
    }
    if (message.channel !== "mdv-host" || !sandbox) return;
    if (runtimeKind === "document" && !["render-document", "unload"].includes(message.type)) {
      sendFatal(`Document Runtime 收到了不允许的 Host 消息：${message.type}`);
      cleanup();
      return;
    }
    sandbox.postMessage(message);
  } catch (error) {
    sendFatal(error instanceof Error ? error.stack || error.message : String(error));
    cleanup();
  }
});

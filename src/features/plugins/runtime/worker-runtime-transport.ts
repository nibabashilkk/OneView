import type { PluginRuntimeKind } from "../domain/plugin";
import type { HostToPluginMessage, PluginToHostMessage, RuntimeHostInitMessage } from "./plugin-protocol";

export type WorkerRuntimeTransportHandlers = {
  onMessage: (event: MessageEvent<PluginToHostMessage>) => void;
  onError: (event: ErrorEvent) => void;
  onMessageError: (event: MessageEvent) => void;
};

/** Owns the trusted static Worker Host. Third-party source never becomes this Worker's source. */
export class WorkerRuntimeTransport {
  private worker: Worker | null = null;

  constructor(private readonly pluginId: string) {}

  start(runtime: PluginRuntimeKind, mainJs: string, handlers: WorkerRuntimeTransportHandlers) {
    if (this.worker) return;
    const worker = new Worker(new URL("./plugin-host.worker.ts", import.meta.url), {
      type: "module",
      name: `mdv-plugin-host:${this.pluginId}`,
    });
    this.worker = worker;
    worker.addEventListener("message", handlers.onMessage);
    worker.addEventListener("error", handlers.onError);
    worker.addEventListener("messageerror", handlers.onMessageError);
    worker.postMessage({
      channel: "mdv-runtime-host",
      type: "initialize",
      pluginId: this.pluginId,
      runtime,
      mainJs,
    } satisfies RuntimeHostInitMessage);
  }

  post(message: HostToPluginMessage) {
    if (!this.worker) throw new Error("插件 Worker Host 尚未启动");
    this.worker.postMessage(message);
  }

  terminate(handlers: WorkerRuntimeTransportHandlers) {
    if (!this.worker) return;
    this.worker.removeEventListener("message", handlers.onMessage);
    this.worker.removeEventListener("error", handlers.onError);
    this.worker.removeEventListener("messageerror", handlers.onMessageError);
    this.worker.terminate();
    this.worker = null;
  }

  get active() {
    return this.worker !== null;
  }
}

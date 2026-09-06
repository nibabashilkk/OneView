import type { StartupSystemAction } from "../lib/contracts";

export type ExternalOpenCoordinatorOptions = {
  takeFiles: () => Promise<string[]>;
  takeActions: () => Promise<StartupSystemAction[]>;
  openFiles: (paths: string[]) => Promise<void>;
  handleActions: (actions: StartupSystemAction[]) => Promise<void>;
  reportError?: (message: string) => void;
};

/**
 * Serializes every OS-originated open request through the Rust startup queues.
 *
 * Rust is the source of truth: both cold-start RunEvent::Opened and warm
 * single-instance events enqueue before emitting their wake-up event. The
 * frontend therefore never trusts event timing or payload delivery. During
 * bootstrap, events only mark the coordinator dirty; after workspace restore
 * completes, markReadyAndDrain() consumes everything exactly once.
 */
export class ExternalOpenCoordinator {
  private ready = false;
  private disposed = false;
  private drainRequested = false;
  private drainPromise: Promise<void> | null = null;

  constructor(private readonly options: ExternalOpenCoordinatorOptions) {}

  /** Wake-up signal from app://open-files or app://system-actions. */
  notify() {
    if (this.disposed) return;
    this.drainRequested = true;
    if (this.ready) void this.ensureDrain();
  }

  /**
   * Opens the bootstrap barrier and waits until all requests queued so far are
   * consumed. Call only after settings/plugins/workspace restoration finishes.
   */
  async markReadyAndDrain() {
    if (this.disposed) return;
    this.ready = true;
    this.drainRequested = true;
    await this.ensureDrain();
  }

  dispose() {
    this.disposed = true;
    this.drainRequested = false;
  }

  private ensureDrain(): Promise<void> {
    if (!this.ready || this.disposed) return Promise.resolve();
    if (this.drainPromise) return this.drainPromise;

    this.drainPromise = this.drainLoop()
      .catch((error) => {
        this.options.reportError?.(`处理系统打开请求失败：${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        this.drainPromise = null;
        // An event can arrive while document opening awaits Rust/plugin work.
        // If so, schedule one more serialized pass instead of racing a second drain.
        if (this.ready && !this.disposed && this.drainRequested) void this.ensureDrain();
      });

    return this.drainPromise;
  }

  private async drainLoop() {
    while (this.ready && !this.disposed && this.drainRequested) {
      this.drainRequested = false;

      const [paths, actions] = await Promise.all([
        this.options.takeFiles(),
        this.options.takeActions(),
      ]);
      if (this.disposed) return;

      if (paths.length > 0) await this.options.openFiles(paths);
      if (actions.length > 0) await this.options.handleActions(actions);

      // A non-empty drain may have taken long enough for another native open
      // request to be queued without its JS event being observed yet. Probe once
      // more so the Rust queue, not event delivery, remains authoritative.
      if (paths.length > 0 || actions.length > 0) this.drainRequested = true;
    }
  }
}

import type {
  PluginDiagnosticEntry,
  PluginDiagnosticReport,
  PluginHealthSnapshot,
  PluginRuntimeFaultReason,
} from "../domain/plugin";

const RECENT_ERROR_WINDOW_MS = 60_000;
const MAX_ENTRIES_PER_PLUGIN = 32;

const EMPTY_HEALTH: PluginHealthSnapshot = {
  status: "disabled",
  recentErrorCount: 0,
  totalErrorCount: 0,
  circuitBreakerTrips: 0,
  lastError: null,
  lastErrorAt: null,
  lastStartedAt: null,
  lastStoppedAt: null,
};

type MutableHealth = PluginHealthSnapshot & { recentErrorTimestamps: number[] };

/**
 * Session-scoped plugin diagnostics and health model.
 *
 * It intentionally lives outside PluginManager so runtime telemetry can evolve without
 * turning the lifecycle coordinator into a logging/metrics god object.
 */
export class PluginDiagnosticsRegistry {
  private readonly entriesById = new Map<string, PluginDiagnosticEntry[]>();
  private readonly healthById = new Map<string, MutableHealth>();
  private sequence = 0;

  record(pluginId: string, report: PluginDiagnosticReport, at = Date.now()) {
    const entry = this.append(pluginId, report, at);
    if (report.level === "error") {
      const health = this.health(pluginId);
      health.recentErrorTimestamps = health.recentErrorTimestamps.filter((time) => at - time <= RECENT_ERROR_WINDOW_MS);
      health.recentErrorTimestamps.push(at);
      health.recentErrorCount = health.recentErrorTimestamps.length;
      health.totalErrorCount += 1;
      health.lastError = report.message;
      health.lastErrorAt = at;
      if (health.status === "healthy") health.status = "degraded";
    }
    return entry;
  }

  markActive(pluginId: string, at = Date.now()) {
    const health = this.health(pluginId);
    health.status = "healthy";
    health.recentErrorTimestamps = [];
    health.recentErrorCount = 0;
    health.lastStartedAt = at;
  }

  markDisabled(pluginId: string, at = Date.now()) {
    const health = this.health(pluginId);
    health.status = "disabled";
    health.recentErrorTimestamps = [];
    health.recentErrorCount = 0;
    health.lastStoppedAt = at;
  }

  markFaulted(pluginId: string, message: string, reason: PluginRuntimeFaultReason, at = Date.now()) {
    const health = this.health(pluginId);
    health.status = "faulted";
    health.lastError = message;
    health.lastErrorAt = at;
    if (reason === "circuit-breaker") health.circuitBreakerTrips += 1;
    // Startup faults can surface once through the Worker callback and once through start()
    // rejection. Keep one human-readable incident instead of duplicating the same line.
    const newest = this.entriesById.get(pluginId)?.[0];
    const duplicateFault = Boolean(newest && newest.kind === "runtime" && newest.message === message && at - newest.at <= 250);
    if (!duplicateFault) {
      this.append(pluginId, { level: "error", kind: "runtime", message }, at);
      if (reason === "runtime") {
        health.recentErrorTimestamps = health.recentErrorTimestamps.filter((time) => at - time <= RECENT_ERROR_WINDOW_MS);
        health.recentErrorTimestamps.push(at);
        health.recentErrorCount = health.recentErrorTimestamps.length;
        health.totalErrorCount += 1;
      }
    }
  }

  clear(pluginId: string) {
    this.entriesById.delete(pluginId);
    const current = this.healthById.get(pluginId);
    if (!current) return;
    this.healthById.set(pluginId, {
      ...EMPTY_HEALTH,
      status: current.status,
      lastStartedAt: current.lastStartedAt ?? null,
      lastStoppedAt: current.lastStoppedAt ?? null,
      recentErrorTimestamps: [],
    });
  }

  retainPlugins(pluginIds: Set<string>) {
    for (const id of [...this.entriesById.keys()]) if (!pluginIds.has(id)) this.entriesById.delete(id);
    for (const id of [...this.healthById.keys()]) if (!pluginIds.has(id)) this.healthById.delete(id);
  }

  snapshot(pluginIds?: Iterable<string>) {
    const ids = pluginIds ? [...pluginIds] : [...new Set([...this.healthById.keys(), ...this.entriesById.keys()])];
    const healthById: Record<string, PluginHealthSnapshot> = {};
    const diagnosticsById: Record<string, PluginDiagnosticEntry[]> = {};
    for (const id of ids) {
      const health = this.healthById.get(id);
      healthById[id] = health ? this.toSnapshot(health) : { ...EMPTY_HEALTH };
      diagnosticsById[id] = [...(this.entriesById.get(id) ?? [])];
    }
    return { healthById, diagnosticsById };
  }

  private append(pluginId: string, report: PluginDiagnosticReport, at: number) {
    const entry: PluginDiagnosticEntry = {
      id: `${at.toString(36)}-${(++this.sequence).toString(36)}`,
      pluginId,
      at,
      level: report.level,
      kind: report.kind,
      message: report.message.slice(0, 4_000),
    };
    const entries = this.entriesById.get(pluginId) ?? [];
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES_PER_PLUGIN) entries.length = MAX_ENTRIES_PER_PLUGIN;
    this.entriesById.set(pluginId, entries);
    return entry;
  }

  private health(pluginId: string) {
    const existing = this.healthById.get(pluginId);
    if (existing) return existing;
    const created: MutableHealth = { ...EMPTY_HEALTH, recentErrorTimestamps: [] };
    this.healthById.set(pluginId, created);
    return created;
  }

  private toSnapshot(health: MutableHealth): PluginHealthSnapshot {
    const { recentErrorTimestamps: _timestamps, ...snapshot } = health;
    return { ...snapshot };
  }
}

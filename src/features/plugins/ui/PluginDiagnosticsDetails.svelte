<script lang="ts">
  import type { PluginDiagnosticEntry, PluginHealthSnapshot } from "../domain/plugin";

  export let health: PluginHealthSnapshot;
  export let entries: PluginDiagnosticEntry[] = [];
  export let onClear: () => void;

  const kindLabels: Record<PluginDiagnosticEntry["kind"], string> = {
    lifecycle: "生命周期",
    runtime: "运行时",
    command: "命令",
    event: "事件",
    panel: "面板",
    settings: "设置",
  };

  function statusLabel(status: PluginHealthSnapshot["status"]) {
    if (status === "healthy") return "正常";
    if (status === "degraded") return "有异常";
    if (status === "faulted") return "已熔断 / 异常";
    return "未运行";
  }

  function formatTime(at: number) {
    return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
</script>

<section class="plugin-diagnostics-box">
  <div class="plugin-diagnostics-head">
    <div>
      <div class="plugin-diagnostics-title">插件诊断</div>
      <div class="plugin-diagnostics-subtitle">当前会话内的结构化运行记录，不包含文档正文。</div>
    </div>
    <span class:disabled={health.status === "disabled"} class:degraded={health.status === "degraded"} class:faulted={health.status === "faulted"} class="plugin-health-badge">
      {statusLabel(health.status)}
    </span>
  </div>

  <div class="plugin-health-grid">
    <div><span>熔断窗口</span><strong>{health.recentErrorCount}</strong></div>
    <div><span>会话异常</span><strong>{health.totalErrorCount}</strong></div>
    <div><span>熔断次数</span><strong>{health.circuitBreakerTrips}</strong></div>
  </div>

  {#if health.lastError}
    <div class="plugin-last-error">
      <span>最近异常{health.lastErrorAt ? ` · ${formatTime(health.lastErrorAt)}` : ""}</span>
      <div>{health.lastError}</div>
    </div>
  {/if}

  <div class="plugin-diagnostics-list-head">
    <span>最近记录</span>
    {#if entries.length > 0}<button on:click={onClear}>清空</button>{/if}
  </div>

  {#if entries.length === 0}
    <div class="plugin-diagnostics-empty">当前会话没有记录到插件异常。</div>
  {:else}
    <div class="plugin-diagnostics-list">
      {#each entries.slice(0, 8) as entry (entry.id)}
        <div class:error={entry.level === "error"} class:warning={entry.level === "warning"} class="plugin-diagnostic-entry">
          <div class="plugin-diagnostic-meta">
            <span>{kindLabels[entry.kind]}</span>
            <time>{formatTime(entry.at)}</time>
          </div>
          <div class="plugin-diagnostic-message">{entry.message}</div>
        </div>
      {/each}
    </div>
  {/if}
</section>

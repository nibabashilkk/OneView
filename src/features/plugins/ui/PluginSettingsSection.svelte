<script lang="ts">
  import type { PluginManager } from "../application/plugin-manager";
  import { effectivePluginRuntimeKind, permissionLabels, pluginHasWorkerRuntime, type InstalledPlugin, type PluginPermission } from "../domain/plugin";
  import PluginSettingForm from "./PluginSettingForm.svelte";
  import PluginDiagnosticsDetails from "./PluginDiagnosticsDetails.svelte";
  import PluginShortcutEditor from "./PluginShortcutEditor.svelte";

  export let manager: PluginManager;
  export let standalone = false;
  export let filter: "all" | "document" | "theme" | "extension" = "all";
  export let query = "";

  const pluginState = manager.state;
  let busyId: string | null = null;
  let expandedSettingsId: string | null = null;
  let expandedDiagnosticsId: string | null = null;
  let expandedShortcutsId: string | null = null;

  $: normalizedQuery = query.trim().toLocaleLowerCase();
  $: visiblePlugins = $pluginState.plugins.filter((plugin) => {
    const categoryMatches = filter === "all"
      || (filter === "document" && (plugin.manifest.contributes?.documentFormats?.length ?? 0) > 0)
      || (filter === "theme" && (plugin.manifest.contributes?.themes?.length ?? 0) > 0)
      || (filter === "extension" && effectivePluginRuntimeKind(plugin.manifest) === "extension");
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;
    const formats = (plugin.manifest.contributes?.documentFormats ?? []).flatMap((item) => [item.label, ...item.extensions]).join(" ");
    const themes = (plugin.manifest.contributes?.themes ?? []).map((item) => `${item.label} ${item.family}`).join(" ");
    return `${plugin.manifest.name} ${plugin.manifest.description ?? ""} ${plugin.manifest.id} ${plugin.manifest.author ?? ""} ${formats} ${themes}`
      .toLocaleLowerCase().includes(normalizedQuery);
  });

  function pluginKindLabel(plugin: InstalledPlugin) {
    if ((plugin.manifest.contributes?.themes?.length ?? 0) > 0 && !pluginHasWorkerRuntime(plugin.manifest)) return "主题 · 无代码";
    if ((plugin.manifest.contributes?.documentFormats?.length ?? 0) > 0) return "文档查看器";
    return "扩展";
  }

  async function install() {
    try { await manager.installFromPicker(); } catch { /* state already contains the error */ }
  }

  async function linkDevelopment() {
    try { await manager.linkDevelopmentFromPicker(); } catch { /* state already contains the error */ }
  }

  async function toggle(id: string, enabled: boolean, control?: HTMLInputElement) {
    if (busyId) return;
    const plugin = $pluginState.plugins.find((item) => item.manifest.id === id);
    if (enabled && plugin) {
      const permissions = plugin.manifest.permissions.map(permissionLabel);
      const detail = permissions.length > 0
        ? `\n\n此插件请求：\n• ${permissions.join("\n• ")}`
        : "\n\n此插件没有请求额外权限。";
      if (!window.confirm(`启用“${plugin.manifest.name}”吗？${detail}`)) {
        if (control) control.checked = false;
        return;
      }
    }
    busyId = id;
    try { await manager.setEnabled(id, enabled); } finally { busyId = null; }
  }

  async function remove(id: string, name: string, development: boolean) {
    if (busyId) return;
    const prompt = development
      ? `确定移除“${name}”的开发目录引用吗？\n\n不会删除你的插件源码。`
      : `确定卸载“${name}”吗？`;
    if (!window.confirm(prompt)) return;
    const removeData = window.confirm("是否同时删除这个插件保存的设置和数据？\n\n选择“取消”会保留插件数据。 ");
    busyId = id;
    try { await manager.uninstall(id, removeData); } finally { busyId = null; }
  }

  async function reload(id: string) {
    if (busyId) return;
    busyId = id;
    try { await manager.reload(id); } finally { busyId = null; }
  }

  function permissionLabel(permission: string) {
    return permissionLabels[permission as PluginPermission] ?? permission;
  }

  function runtimeLabel(id: string, enabled: boolean) {
    const plugin = $pluginState.plugins.find((item) => item.manifest.id === id);
    const runtime = $pluginState.runtimeById[id];
    if (!enabled) return "未启用";
    if (plugin && !pluginHasWorkerRuntime(plugin.manifest)) return "声明式 · 无 Worker";
    if ($pluginState.safeMode) return "Worker 已暂停";
    if (!runtime) return "等待加载";
    if (runtime.status === "active") return "运行中";
    if (runtime.status === "loading") return "加载中…";
    if (runtime.status === "error") return "运行异常";
    return "未启用";
  }

  function settingsSchema(id: string) {
    return $pluginState.settingsSchemas.find((item) => item.pluginId === id) ?? null;
  }

  function diagnosticsFor(id: string) {
    return $pluginState.diagnosticsById[id] ?? [];
  }

  function shortcutConflictsFor(id: string) {
    return $pluginState.shortcutConflicts.filter((item) => item.pluginId === id);
  }

  function shortcutBindingsFor(id: string) {
    return $pluginState.shortcutBindings.filter((item) => item.pluginId === id);
  }

  async function toggleSafeMode(enabled: boolean) {
    if ($pluginState.loading) return;
    const message = enabled
      ? "进入安全模式后，第三方 Worker runtime 会立即暂停；声明式主题仍继续工作，启用状态和数据不会改变。继续吗？"
      : "退出安全模式后，会重新启动所有已启用且兼容的 Worker runtime。继续吗？";
    if (!window.confirm(message)) return;
    await manager.setSafeMode(enabled);
  }

  function healthFor(id: string) {
    return $pluginState.healthById[id] ?? {
      status: "disabled" as const,
      recentErrorCount: 0,
      totalErrorCount: 0,
      circuitBreakerTrips: 0,
      lastError: null,
      lastErrorAt: null,
      lastStartedAt: null,
      lastStoppedAt: null,
    };
  }

  function healthLabel(id: string) {
    const health = healthFor(id);
    if (health.status === "faulted") return "已熔断";
    if (health.status === "degraded") return `异常 ${health.recentErrorCount}`;
    if (health.status === "healthy") return "健康";
    return "";
  }
</script>

<section class="plugin-settings-section">
  <div class="settings-label flex items-center justify-between gap-3">
    <span>{standalone ? "已安装" : "插件"}</span>
    <div class="flex items-center gap-2">
      <button class="settings-inline-action" disabled={$pluginState.loading} on:click={() => void manager.refresh()}>刷新</button>
      <button class="plugin-install-button" disabled={$pluginState.loading} on:click={() => void install()}>
        {$pluginState.loading ? "处理中…" : "从本地安装"}
      </button>
    </div>
  </div>

  <div class="plugin-center-helper-row">
    <span>安装本地 <code>.mdvplugin</code> 后即可启用；主题插件不会运行 JavaScript。</span>
    <details class="plugin-security-details"><summary>安全说明</summary><p>需要执行逻辑的文档插件与扩展运行在隔离 Worker 中；安全模式只暂停 Worker，声明式主题继续工作。</p></details>
  </div>

  <div class:safe={$pluginState.safeMode} class:compact={!$pluginState.safeMode} class="plugin-safe-mode-card">
    <div class="plugin-safe-mode-copy">
      <div class="plugin-safe-mode-title">{$pluginState.safeMode ? "插件安全模式已开启" : "插件安全模式"}</div>
      <div class="plugin-safe-mode-description">
        {#if $pluginState.safeMode}
          第三方 Worker runtime 暂不启动；声明式主题继续工作，启用状态、权限和数据保持不变。
          {#if $pluginState.startupRecovery?.previousStartupIncomplete}
            <span>上次插件启动阶段未正常完成</span>
            {#if $pluginState.startupRecovery.interruptedPluginId}
              <span>，可能停在 <code>{$pluginState.startupRecovery.interruptedPluginId}</code></span>
            {/if}
            <span>。</span>
          {/if}
        {:else}
          插件异常时，可暂时暂停全部第三方 Worker；主题不会被安全模式关闭。
        {/if}
      </div>
    </div>
    <button class="plugin-safe-mode-action" disabled={$pluginState.loading} on:click={() => void toggleSafeMode(!$pluginState.safeMode)}>
      {$pluginState.safeMode ? "退出安全模式" : "进入安全模式"}
    </button>
  </div>

  <details class="plugin-developer-box">
    <summary>插件开发</summary>
    <div class="plugin-developer-content">
      <p>直接引用源码目录，修改后可“重新加载”验证，不复制插件源码。</p>
      <button class="plugin-install-button" disabled={$pluginState.loading} on:click={() => void linkDevelopment()}>
        加载未打包插件目录
      </button>
    </div>
  </details>

  {#if $pluginState.error}<div class="plugin-error">{$pluginState.error}</div>{/if}

  {#if $pluginState.warnings.length > 0}
    <div class="plugin-warning">
      <div class="font-medium">发现 {$pluginState.warnings.length} 个插件目录问题</div>
      <div class="mt-1 line-clamp-3">{$pluginState.warnings.join("；")}</div>
    </div>
  {/if}

  {#if visiblePlugins.length === 0}
    <div class="plugin-empty plugin-empty-friendly">
      <div class="plugin-empty-icon">{query.trim() ? "⌕" : "+"}</div>
      <div class="text-xs font-medium">{query.trim() ? `没有找到“${query.trim()}”` : "这里还没有插件"}</div>
      <div class="mt-1 text-[10px] leading-4 text-zinc-400">{query.trim() ? "换个关键词，或切换上面的分类。" : "从本地安装 .mdvplugin，安装后会显示在这里。"}</div>
    </div>
  {:else}
    <div class="plugin-list">
      {#each visiblePlugins as plugin (plugin.manifest.id)}
        {@const schema = settingsSchema(plugin.manifest.id)}
        {@const shortcutConflicts = shortcutConflictsFor(plugin.manifest.id)}
        {@const shortcutBindings = shortcutBindingsFor(plugin.manifest.id)}
        <article class="plugin-card">
          <div class="plugin-card-head">
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-xs font-semibold">{plugin.manifest.name}</span>
                <span class="plugin-kind-badge">{pluginKindLabel(plugin)}</span>
                {#if plugin.source.kind === "development"}<span class="plugin-source-badge">开发</span>{/if}
              </div>
              <div class="plugin-card-subline"><span>v{plugin.manifest.version}</span><span>·</span><span>{plugin.manifest.author || "未知作者"}</span></div>
              <div class="mt-1 text-[10px] leading-4 text-zinc-400">{plugin.manifest.description || "暂无描述"}</div>
            </div>
            <label class="plugin-switch" title={plugin.compatible ? (plugin.enabled ? "禁用插件" : "启用插件") : "当前版本不兼容"}>
              <input
                type="checkbox"
                checked={plugin.enabled}
                disabled={busyId === plugin.manifest.id || !plugin.compatible}
                on:change={(event) => void toggle(plugin.manifest.id, event.currentTarget.checked, event.currentTarget)}
              />
              <span></span>
            </label>
          </div>

          <div class="plugin-meta-row">
            <span class="plugin-status-pill" class:plugin-runtime-error={$pluginState.runtimeById[plugin.manifest.id]?.status === "error"}>{runtimeLabel(plugin.manifest.id, plugin.enabled)}</span>
            {#if healthLabel(plugin.manifest.id)}
              <span>·</span>
              <span
                class:plugin-health-inline-warning={healthFor(plugin.manifest.id).status === "degraded"}
                class:plugin-health-inline-error={healthFor(plugin.manifest.id).status === "faulted"}
              >{healthLabel(plugin.manifest.id)}</span>
            {/if}
          </div>

          {#if plugin.source.kind === "development"}
            <div class="plugin-dev-path" title={plugin.source.path}>{plugin.source.path}</div>
          {/if}

          {#if !plugin.compatible && plugin.compatibilityIssue}
            <div class="plugin-compatibility-error">{plugin.compatibilityIssue}</div>
          {:else if plugin.permissionReviewRequired}
            <div class="plugin-permission-review">插件权限与上次授权不一致，重新启用前会再次确认。</div>
          {:else if $pluginState.runtimeById[plugin.manifest.id]?.error}
            <div class="plugin-compatibility-error">{$pluginState.runtimeById[plugin.manifest.id]?.error}</div>
          {/if}

          {#if (plugin.manifest.contributes?.documentFormats ?? []).length > 0}
            <div class="plugin-permissions" aria-label="插件文档格式">
              {#each plugin.manifest.contributes.documentFormats as format}
                <span title={`由插件提供的文档查看器：${format.label}`}>{format.label} · {format.extensions.map((extension) => `.${extension.replace(/^\./, "")}`).join(" / ")}</span>
              {/each}
            </div>
          {/if}

          {#if (plugin.manifest.contributes?.themes ?? []).length > 0}
            <div class="plugin-permissions" aria-label="插件主题">
              {#each plugin.manifest.contributes.themes as theme}
                <span>{theme.label} · {theme.variant === "dark" ? "Dark" : "Light"} · {theme.scope.join(" / ")}</span>
              {/each}
            </div>
          {/if}

          {#if plugin.manifest.permissions.length > 0}
            <div class="plugin-permissions">
              {#each plugin.manifest.permissions as permission}<span>{permissionLabel(permission)}</span>{/each}
            </div>
          {/if}

          {#if shortcutConflicts.length > 0}
            <div class="plugin-shortcut-conflicts">
              <div class="plugin-shortcut-conflicts-title">{shortcutConflicts.length} 个快捷键冲突，已自动停用冲突快捷键</div>
              {#each shortcutConflicts.slice(0, 3) as conflict}
                <div><code>{conflict.shortcut}</code> · {conflict.commandTitle} ↔ {conflict.conflictsWith.join("、")}</div>
              {/each}
              {#if shortcutConflicts.length > 3}<div>还有 {shortcutConflicts.length - 3} 个冲突；命令仍可从命令面板执行。</div>{/if}
            </div>
          {/if}

          {#if expandedShortcutsId === plugin.manifest.id && shortcutBindings.length > 0}
            <PluginShortcutEditor manager={manager} pluginId={plugin.manifest.id} />
          {/if}

          {#if expandedSettingsId === plugin.manifest.id && schema}
            <PluginSettingForm manager={manager} {schema} />
          {/if}

          {#if expandedDiagnosticsId === plugin.manifest.id}
            <PluginDiagnosticsDetails
              health={healthFor(plugin.manifest.id)}
              entries={diagnosticsFor(plugin.manifest.id)}
              onClear={() => manager.clearPluginDiagnostics(plugin.manifest.id)}
            />
          {/if}

          <div class="plugin-card-actions" title={plugin.manifest.id}>
            <span class="plugin-card-id">{plugin.manifest.id}</span>
            <div class="plugin-card-action-buttons">
              {#if shortcutBindings.length > 0}
                <button
                  class="plugin-neutral-action"
                  disabled={busyId === plugin.manifest.id}
                  on:click={() => expandedShortcutsId = expandedShortcutsId === plugin.manifest.id ? null : plugin.manifest.id}
                >{expandedShortcutsId === plugin.manifest.id ? "收起快捷键" : "快捷键"}</button>
              {/if}
              {#if schema}
                <button
                  class="plugin-neutral-action"
                  disabled={busyId === plugin.manifest.id}
                  on:click={() => expandedSettingsId = expandedSettingsId === plugin.manifest.id ? null : plugin.manifest.id}
                >{expandedSettingsId === plugin.manifest.id ? "收起设置" : "设置"}</button>
              {/if}
              {#if diagnosticsFor(plugin.manifest.id).length > 0 || healthFor(plugin.manifest.id).status === "faulted" || healthFor(plugin.manifest.id).totalErrorCount > 0}
                <button
                  class="plugin-neutral-action"
                  disabled={busyId === plugin.manifest.id}
                  on:click={() => expandedDiagnosticsId = expandedDiagnosticsId === plugin.manifest.id ? null : plugin.manifest.id}
                >{expandedDiagnosticsId === plugin.manifest.id ? "收起诊断" : "诊断"}</button>
              {/if}
              {#if plugin.source.kind === "development"}
                <button class="plugin-neutral-action" disabled={busyId === plugin.manifest.id} on:click={() => void reload(plugin.manifest.id)}>重新加载</button>
              {/if}
              <button class="plugin-danger-action" disabled={busyId === plugin.manifest.id} on:click={() => void remove(plugin.manifest.id, plugin.manifest.name, plugin.source.kind === "development")}>
                {plugin.source.kind === "development" ? "移除引用" : "卸载"}
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

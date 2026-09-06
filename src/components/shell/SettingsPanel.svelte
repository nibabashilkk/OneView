<script lang="ts">
  import { settings, defaultSettings, readerStyle } from "../../stores/settings";
  import type { AppTheme, DefaultAppGroupKey, ReaderFont } from "../../lib/contracts";
  import { defaultApp } from "../../stores/default-app";
  import { notice } from "../../stores/notice";
  import Icon from "../ui/Icon.svelte";
  import { primaryContentMotion } from "../../lib/motion";
  import type { PluginManager } from "../../features/plugins/application/plugin-manager";
  import type { ThemeFamily } from "../../features/themes/domain/theme";
  import { DEFAULT_THEMES } from "../../features/themes/builtin/default-theme";

  export let open = false;
  export let onClose: () => void;
  export let pluginManager: PluginManager;
  const pluginState = pluginManager.state;

  type SettingsSection = "general" | "reading" | "editor" | "system";
  let activeSection: SettingsSection = "general";
  let defaultAppPanelWasOpen = false;
  let settingsQuery = "";

  const sections: Array<{ id: SettingsSection; label: string; icon: "settings" | "document" | "save" | "reveal"; description: string; keywords: string }> = [
    { id: "general", label: "通用", icon: "settings", description: "明暗模式、完整主题和更新偏好", keywords: "外观 主题 深色 浅色 插件主题 阅读 正文 语法高亮 更新" },
    { id: "reading", label: "阅读", icon: "document", description: "排版、字号、行高和正文宽度", keywords: "阅读 排版 字体 字号 行高 正文 宽度 代码 主题" },
    { id: "editor", label: "编辑", icon: "save", description: "保存行为与编辑体验", keywords: "编辑 自动保存 保存 草稿" },
    { id: "system", label: "系统", icon: "reveal", description: "默认打开方式和系统集成", keywords: "系统 默认 打开方式 文件关联 mac windows" },
  ];

  $: normalizedSettingsQuery = settingsQuery.trim().toLocaleLowerCase();
  $: visibleSections = normalizedSettingsQuery
    ? sections.filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(normalizedSettingsQuery))
    : sections;
  $: if (normalizedSettingsQuery && visibleSections.length > 0 && !visibleSections.some((item) => item.id === activeSection)) {
    activeSection = visibleSections[0].id;
  }
  $: activeSectionMeta = sections.find((item) => item.id === activeSection) ?? sections[0];

  function previewTheme(family: ThemeFamily) {
    const variant = family.variants.light ?? family.variants.dark;
    const fallback = DEFAULT_THEMES[variant?.variant === "dark" ? 1 : 0].tokens;
    const tokens = { ...fallback, ...(variant?.tokens ?? {}) };
    return {
      background: tokens["app.background"],
      surface: tokens["app.surface"],
      reader: tokens["reader.background"],
      text: tokens["reader.heading"],
      accent: tokens["reader.link"],
    };
  }

  const appThemes: Array<{ value: AppTheme; label: string }> = [
    { value: "system", label: "系统" },
    { value: "light", label: "浅色" },
    { value: "dark", label: "深色" },
  ];

  const fonts: Array<{ value: ReaderFont; label: string }> = [
    { value: "system", label: "系统无衬线" },
    { value: "serif", label: "衬线阅读" },
    { value: "mono", label: "等宽字体" },
  ];

  function numberValue(event: Event) {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (open && event.key === "Escape") onClose();
  }

  $: if (open && !defaultAppPanelWasOpen) {
    defaultAppPanelWasOpen = true;
    void defaultApp.refresh().catch(() => undefined);
  }
  $: if (!open && defaultAppPanelWasOpen) defaultAppPanelWasOpen = false;

  async function setDefaultGroup(group: DefaultAppGroupKey) {
    try {
      const result = await defaultApp.request(group);
      notice.show(result.message);
      if (result.mode === "direct") {
        window.setTimeout(() => void defaultApp.refresh().catch(() => undefined), 900);
      }
    } catch (error) {
      notice.show(`设置默认打开方式失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="settings-backdrop modern-modal-backdrop persistent-modal-layer"
  class:is-open={open}
  role="presentation"
  aria-hidden={open ? undefined : "true"}
  inert={!open}
  on:click={closeOnBackdrop}
>
  <div class="settings-window" role="dialog" aria-modal={open ? "true" : undefined} aria-label="设置">
      <aside class="settings-nav" aria-label="设置分类">
        <div class="settings-nav-brand">
          <div class="settings-nav-icon"><Icon name="settings" size={17} /></div>
          <div>
            <div class="settings-nav-title">设置</div>
            <div class="settings-nav-caption">oneView</div>
          </div>
        </div>

        <div class="settings-search-shell">
          <Icon name="search" size={13} />
          <input bind:value={settingsQuery} placeholder="搜索设置…" aria-label="搜索设置" />
          {#if settingsQuery}
            <button aria-label="清除搜索" on:click={() => settingsQuery = ""}><Icon name="close" size={11} /></button>
          {/if}
        </div>

        <nav class="settings-nav-list">
          {#each visibleSections as item}
            <button
              class:active={activeSection === item.id}
              class="settings-nav-item"
              on:click={() => activeSection = item.id}
            >
              <Icon name={item.icon} size={15} />
              <span class="settings-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          {/each}
          {#if visibleSections.length === 0}
            <div class="settings-search-empty">没有找到“{settingsQuery}”</div>
          {/if}
        </nav>

        <button class="settings-reset" on:click={() => settings.set(defaultSettings)}>恢复默认设置</button>
      </aside>

      <div class="settings-main">
        <header class="settings-main-header">
          <div class="settings-header-copy">
            <h2>{activeSectionMeta.label}</h2>
            <p>{activeSectionMeta.description}</p>
          </div>
          <button class="modal-close-button" aria-label="关闭设置" on:click={onClose}><Icon name="close" size={15} /></button>
        </header>

        <div class="settings-main-scroll">
          {#key activeSection}
          <div class="settings-section-motion" in:primaryContentMotion={{ y: 2, duration: 110 }}>
          {#if activeSection === "general"}
            <div class="settings-page">
              <section class="settings-card settings-card-flat">
                <div class="settings-row-copy">
                  <div class="settings-row-title">明暗模式</div>
                  <div class="settings-row-note">跟随系统，或固定使用浅色 / 深色界面。</div>
                </div>
                <div class="settings-segmented" aria-label="界面外观">
                  {#each appThemes as item}
                    <button class:active={$settings.appTheme === item.value} on:click={() => settings.setAppTheme(item.value)}>{item.label}</button>
                  {/each}
                </div>
              </section>

              <section>
                <div class="settings-section-title">主题</div>
                <div class="settings-section-subtitle">一套主题统一控制应用界面、Markdown 正文和语法高亮。安装的新主题会自动出现在这里；纯主题不会运行代码。</div>
                <div class="settings-theme-grid mt-3">
                  {#each $pluginState.themeFamilies as family}
                    {@const preview = previewTheme(family)}
                    <button
                      class:active={$pluginState.selectedThemeFamily === family.id}
                      class="settings-modern-theme-card"
                      on:click={() => pluginManager.selectThemeFamily(family.id)}
                    >
                      <span class="settings-theme-visual" style={`--theme-preview-bg:${preview.background};--theme-preview-surface:${preview.surface};--theme-preview-reader:${preview.reader};--theme-preview-text:${preview.text};--theme-preview-accent:${preview.accent}`}>
                        <i></i><i></i><i></i>
                      </span>
                      <span class="settings-theme-copy">
                        <strong>{family.label}</strong>
                        <small>{family.builtin ? "内置" : family.pluginName} · {family.variants.light && family.variants.dark ? "自动适配明暗" : family.variants.light ? "浅色" : "深色"}</small>
                      </span>
                      {#if $pluginState.selectedThemeFamily === family.id}<span class="settings-selected-mark">已使用</span>{/if}
                    </button>
                  {/each}
                </div>
              </section>

              <section class="settings-card settings-card-flat">
                <div class="settings-row-copy">
                  <div class="settings-row-title">启动后检查更新</div>
                  <div class="settings-row-note">只检查，不会自动安装。</div>
                </div>
                <label class="modern-switch" title="启动后检查更新">
                  <input type="checkbox" checked={$settings.autoCheckUpdates} on:change={(event) => settings.setAutoCheckUpdates(event.currentTarget.checked)} />
                  <span></span>
                </label>
              </section>
            </div>

          {:else if activeSection === "reading"}
            <div class="settings-page">
              <section class="settings-reader-theme-note">
                <div class="settings-reader-theme-note-icon"><Icon name="theme" size={15} /></div>
                <div class="settings-reader-theme-note-copy">
                  <div class="settings-row-title">阅读视觉由「{selectedThemeFamily?.label ?? "Default"}」控制</div>
                  <div class="settings-row-note">正文、标题、链接、引用、代码块和语法高亮统一跟随当前主题。这里仅调整个人排版偏好。</div>
                </div>
                <button class="settings-text-button settings-reader-theme-note-action" on:click={() => activeSection = "general"}>更换主题</button>
              </section>

              <section class="settings-card settings-control-stack">
                <label class="settings-field-row">
                  <span>正文字体</span>
                  <select class="settings-compact-select" value={$settings.fontFamily} on:change={(event) => settings.setFontFamily(event.currentTarget.value as ReaderFont)}>
                    {#each fonts as item}<option value={item.value}>{item.label}</option>{/each}
                  </select>
                </label>

                <label class="settings-slider-row">
                  <div><span>正文字号</span><strong>{$settings.fontSize.toFixed(0)} px</strong></div>
                  <input type="range" min="12" max="24" step="1" value={$settings.fontSize} on:input={(event) => settings.setFontSize(numberValue(event))} />
                </label>
                <label class="settings-slider-row">
                  <div><span>行高</span><strong>{$settings.lineHeight.toFixed(2)}</strong></div>
                  <input type="range" min="1.35" max="2.2" step="0.05" value={$settings.lineHeight} on:input={(event) => settings.setLineHeight(numberValue(event))} />
                </label>
                <label class="settings-slider-row">
                  <div><span>正文宽度</span><strong>{$settings.contentWidth} px</strong></div>
                  <input type="range" min="560" max="1240" step="20" value={$settings.contentWidth} on:input={(event) => settings.setContentWidth(numberValue(event))} />
                </label>
                <label class="settings-slider-row">
                  <div><span>代码字号</span><strong>{$settings.codeFontSize.toFixed(0)} px</strong></div>
                  <input type="range" min="11" max="18" step="1" value={$settings.codeFontSize} on:input={(event) => settings.setCodeFontSize(numberValue(event))} />
                </label>
              </section>

              <section class="settings-preview-card">
                <div class="settings-preview-label">预览</div>
                <div class="reader-preview" style={`${readerStyle($settings)};font-size:${Math.max(12, $settings.fontSize - 2)}px`}>
                  <div class="text-base font-semibold">阅读应该安静一点</div>
                  <p class="mt-2">调整会立即应用到当前 Markdown。</p>
                  <code>const focus = true;</code>
                </div>
              </section>
            </div>

          {:else if activeSection === "editor"}
            <div class="settings-page">
              <section class="settings-card settings-card-flat">
                <div class="settings-row-copy">
                  <div class="settings-row-title">无感自动保存</div>
                  <div class="settings-row-note">停止输入约 0.9 秒后写回文件。</div>
                </div>
                <label class="modern-switch" title="无感自动保存">
                  <input type="checkbox" checked={$settings.autoSave} on:change={(event) => settings.setAutoSave(event.currentTarget.checked)} />
                  <span></span>
                </label>
              </section>

              <div class="settings-inline-tip">⌘S / Ctrl+S 始终可以手动保存。</div>
            </div>

          {:else}
            <div class="settings-page">
              <section>
                <div class="settings-section-heading-row">
                  <div>
                    <div class="settings-section-title">默认打开方式</div>
                    <div class="settings-section-subtitle">
                      {#if $defaultApp.status?.platform === "macos"}
                        Markdown 与常见开发文本格式都可在 Finder“打开方式”中选择；这里只在你主动点击时更改默认应用。
                      {:else}
                        让 Markdown 文件直接用 oneView 打开。
                      {/if}
                    </div>
                  </div>
                  <button class="settings-text-button" disabled={$defaultApp.loading} on:click={() => void defaultApp.refresh()}>
                    {$defaultApp.loading ? "检查中…" : "刷新"}
                  </button>
                </div>

                <div class="default-app-modern-card">
                  {#if !$defaultApp.status && $defaultApp.loading}
                    <div class="default-app-modern-message">正在检查系统设置…</div>
                  {:else if $defaultApp.status?.platform === "macos" && !$defaultApp.status.appInstalled}
                    <div class="default-app-modern-message">请先将 App 放入“应用程序”目录。</div>
                  {:else if $defaultApp.status?.platform === "windows"}
                    <div class="default-app-modern-message">Windows 会跳转到系统默认应用页面完成选择。</div>
                  {:else if $defaultApp.status?.platform === "macos"}
                    <div class="default-app-modern-message">这些格式以 Alternate handler 注册：安装应用不会抢默认；未安装对应文档插件时仍会安全回退为纯文本。</div>
                  {/if}

                  {#if $defaultApp.error}<div class="default-app-modern-error">{$defaultApp.error}</div>{/if}

                  {#each $defaultApp.status?.associations ?? [] as association}
                    <div class="default-app-modern-row">
                      <div class="min-w-0">
                        <div class="default-app-modern-name">{association.label}</div>
                        <div class="default-app-modern-ext">{association.extensions.join("  ")}</div>
                        {#if association.isDefault === true}
                          <div class="default-app-modern-state is-default">已设为默认</div>
                        {:else if association.currentAppName}
                          <div class="default-app-modern-state">当前：{association.currentAppName}</div>
                        {/if}
                      </div>
                      <button
                        class="settings-secondary-button"
                        disabled={$defaultApp.actionGroup === association.key || association.isDefault === true || ($defaultApp.status?.platform === "macos" && !$defaultApp.status.appInstalled)}
                        on:click={() => void setDefaultGroup(association.key)}
                      >
                        {#if association.isDefault === true}
                          已设置
                        {:else if $defaultApp.actionGroup === association.key}
                          处理中…
                        {:else if $defaultApp.status?.platform === "windows"}
                          去设置
                        {:else}
                          设为默认
                        {/if}
                      </button>
                    </div>
                  {/each}
                </div>
              </section>
            </div>
          {/if}
          </div>
          {/key}
        </div>
      </div>
    </div>
  </div>

<script lang="ts">
  import type { PluginManager } from "../application/plugin-manager";
  import type { PluginShortcutBinding } from "../domain/plugin";

  export let manager: PluginManager;
  export let pluginId: string;

  const state = manager.state;
  let recordingId: string | null = null;
  let busyId: string | null = null;
  let errorById: Record<string, string> = {};

  $: bindings = $state.shortcutBindings.filter((item) => item.pluginId === pluginId);
  $: conflicts = $state.shortcutConflicts.filter((item) => item.pluginId === pluginId);

  function conflictFor(commandId: string) {
    return conflicts.find((item) => item.commandId === commandId) ?? null;
  }

  function formatShortcut(value: string | undefined) {
    if (!value) return "";
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    if (!isMac) return value.replace("Mod", "Ctrl");
    return value
      .replace("Mod", "⌘")
      .replace("Ctrl", "⌃")
      .replace("Shift", "⇧")
      .replace("Alt", "⌥")
      .replaceAll("+", "");
  }

  function shortcutFromEvent(event: KeyboardEvent) {
    if (["Meta", "Control", "Shift", "Alt"].includes(event.key)) return null;
    const punctuationByCode: Record<string, string> = {
      Comma: ",",
      Period: ".",
      Slash: "/",
      Semicolon: ";",
      Minus: "-",
      Equal: "=",
      Backquote: "`",
      BracketLeft: "[",
      BracketRight: "]",
    };
    const rawKey = /^Key[A-Z]$/.test(event.code)
      ? event.code.slice(3)
      : /^Digit[0-9]$/.test(event.code)
        ? event.code.slice(5)
        : /^F(?:[1-9]|1[0-2])$/.test(event.code)
          ? event.code
          : punctuationByCode[event.code] ?? "";
    if (!rawKey) throw new Error(`不支持按键：${event.key}`);

    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
    const modifiers: string[] = [];
    if (isMac) {
      if (event.metaKey) modifiers.push("Mod");
      if (event.ctrlKey) modifiers.push("Ctrl");
    } else if (event.ctrlKey || event.metaKey) {
      modifiers.push("Mod");
    }
    if (event.shiftKey) modifiers.push("Shift");
    if (event.altKey) modifiers.push("Alt");
    if (modifiers.length === 0) throw new Error("请至少按住一个修饰键，例如 Ctrl / ⌘");
    return [...modifiers, rawKey].join("+");
  }

  function beginRecording(commandId: string) {
    recordingId = commandId;
    errorById = { ...errorById, [commandId]: "" };
  }

  async function capture(binding: PluginShortcutBinding, event: KeyboardEvent) {
    if (recordingId !== binding.commandId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      recordingId = null;
      return;
    }
    try {
      const shortcut = shortcutFromEvent(event);
      if (!shortcut) return;
      busyId = binding.commandId;
      await manager.setShortcutOverride(binding.commandId, shortcut);
      recordingId = null;
      errorById = { ...errorById, [binding.commandId]: "" };
    } catch (error) {
      errorById = {
        ...errorById,
        [binding.commandId]: error instanceof Error ? error.message : String(error),
      };
      recordingId = null;
    } finally {
      busyId = null;
    }
  }

  async function disable(binding: PluginShortcutBinding) {
    if (busyId) return;
    busyId = binding.commandId;
    try {
      await manager.setShortcutOverride(binding.commandId, null);
      errorById = { ...errorById, [binding.commandId]: "" };
    } catch (error) {
      errorById = { ...errorById, [binding.commandId]: error instanceof Error ? error.message : String(error) };
    } finally {
      busyId = null;
    }
  }

  async function reset(binding: PluginShortcutBinding) {
    if (busyId) return;
    busyId = binding.commandId;
    try {
      await manager.resetShortcutOverride(binding.commandId);
      errorById = { ...errorById, [binding.commandId]: "" };
    } catch (error) {
      errorById = { ...errorById, [binding.commandId]: error instanceof Error ? error.message : String(error) };
    } finally {
      busyId = null;
    }
  }
</script>

<div class="plugin-shortcut-editor">
  <div class="plugin-shortcut-editor-head">
    <div>
      <div class="plugin-shortcut-editor-title">快捷键</div>
      <div class="plugin-shortcut-editor-description">快捷键由宿主管理。内置快捷键不可覆盖；自定义值会在插件升级和重载后继续保留。</div>
    </div>
  </div>

  <div class="plugin-shortcut-list">
    {#each bindings as binding (binding.commandId)}
      {@const conflict = conflictFor(binding.commandId)}
      <div class:conflicted={Boolean(conflict)} class="plugin-shortcut-row">
        <div class="plugin-shortcut-copy">
          <div class="plugin-shortcut-command">{binding.commandTitle}</div>
          <div class="plugin-shortcut-default">
            {#if binding.defaultShortcut}
              默认 <kbd>{formatShortcut(binding.defaultShortcut)}</kbd>
            {:else}
              插件未声明默认快捷键
            {/if}
            {#if binding.overridden}
              <span>· {binding.overrideShortcut === null ? "已由用户禁用" : "用户自定义"}</span>
            {/if}
          </div>
          {#if conflict}
            <div class="plugin-shortcut-error">当前快捷键与 {conflict.conflictsWith.join("、")} 冲突，已暂停绑定。</div>
          {:else if errorById[binding.commandId]}
            <div class="plugin-shortcut-error">{errorById[binding.commandId]}</div>
          {/if}
        </div>

        <div class="plugin-shortcut-controls">
          <button
            class:recording={recordingId === binding.commandId}
            class="plugin-shortcut-recorder"
            disabled={busyId === binding.commandId}
            title="点击后按下新的快捷键；Esc 取消"
            on:click={() => beginRecording(binding.commandId)}
            on:keydown={(event) => void capture(binding, event)}
          >
            {#if recordingId === binding.commandId}
              按快捷键…
            {:else if binding.effectiveShortcut}
              <kbd>{formatShortcut(binding.effectiveShortcut)}</kbd>
            {:else}
              未设置
            {/if}
          </button>
          <button
            class="plugin-shortcut-action"
            disabled={busyId === binding.commandId || (binding.overridden && binding.overrideShortcut === null)}
            on:click={() => void disable(binding)}
          >禁用</button>
          {#if binding.overridden}
            <button class="plugin-shortcut-action" disabled={busyId === binding.commandId} on:click={() => void reset(binding)}>恢复默认</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

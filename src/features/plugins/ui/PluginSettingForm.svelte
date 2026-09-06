<script lang="ts">
  import type { PluginManager } from "../application/plugin-manager";
  import type { PluginSettingField, PluginSettingValue, PluginSettingsContribution } from "../domain/plugin";

  export let manager: PluginManager;
  export let schema: PluginSettingsContribution;

  let values: Record<string, PluginSettingValue> = {};
  let loading = true;
  let savingKey: string | null = null;
  let error: string | null = null;
  let previousSchema: PluginSettingsContribution | null = null;

  $: if (schema !== previousSchema) {
    previousSchema = schema;
    void load();
  }

  async function load() {
    loading = true;
    error = null;
    try {
      values = await manager.getPluginSettingValues(schema.pluginId);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    } finally {
      loading = false;
    }
  }

  async function save(field: PluginSettingField, value: PluginSettingValue) {
    if (savingKey) return;
    savingKey = field.key;
    error = null;
    try {
      const normalized = await manager.setPluginSetting(schema.pluginId, field.key, value);
      values = { ...values, [field.key]: normalized };
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    } finally {
      savingKey = null;
    }
  }

  function current(field: PluginSettingField): PluginSettingValue {
    return values[field.key] ?? field.defaultValue;
  }
</script>

<div class="plugin-setting-form">
  <div class="plugin-setting-form-head">
    <div>
      <div class="plugin-setting-form-title">{schema.title}</div>
      <div class="plugin-setting-form-subtitle">设置由宿主统一渲染，插件无法直接注入这里的 DOM。</div>
    </div>
    <button class="settings-inline-action" disabled={loading || !!savingKey} on:click={() => void load()}>刷新</button>
  </div>

  {#if loading}
    <div class="plugin-setting-loading">正在读取设置…</div>
  {:else}
    <div class="plugin-setting-fields">
      {#each schema.fields as field (field.key)}
        <div class="plugin-setting-field">
          <div class="plugin-setting-copy">
            <label for={`plugin-setting-${schema.pluginId}-${field.key}`}>{field.label}</label>
            {#if field.description}<p>{field.description}</p>{/if}
          </div>

          {#if field.type === "boolean"}
            <label class="plugin-switch plugin-setting-switch" title={field.label}>
              <input
                id={`plugin-setting-${schema.pluginId}-${field.key}`}
                type="checkbox"
                checked={Boolean(current(field))}
                disabled={savingKey === field.key}
                on:change={(event) => void save(field, event.currentTarget.checked)}
              />
              <span></span>
            </label>
          {:else if field.type === "select"}
            <select
              id={`plugin-setting-${schema.pluginId}-${field.key}`}
              class="plugin-setting-control"
              value={String(current(field))}
              disabled={savingKey === field.key}
              on:change={(event) => void save(field, event.currentTarget.value)}
            >
              {#each field.options as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          {:else if field.type === "number"}
            <input
              id={`plugin-setting-${schema.pluginId}-${field.key}`}
              class="plugin-setting-control plugin-setting-number"
              type="number"
              value={Number(current(field))}
              min={field.min}
              max={field.max}
              step={field.step ?? "any"}
              disabled={savingKey === field.key}
              on:change={(event) => void save(field, Number(event.currentTarget.value))}
            />
          {:else if field.multiline}
            <textarea
              id={`plugin-setting-${schema.pluginId}-${field.key}`}
              class="plugin-setting-control plugin-setting-textarea"
              rows="3"
              placeholder={field.placeholder ?? ""}
              value={String(current(field))}
              disabled={savingKey === field.key}
              on:change={(event) => void save(field, event.currentTarget.value)}
            ></textarea>
          {:else}
            <input
              id={`plugin-setting-${schema.pluginId}-${field.key}`}
              class="plugin-setting-control"
              type="text"
              placeholder={field.placeholder ?? ""}
              value={String(current(field))}
              disabled={savingKey === field.key}
              on:change={(event) => void save(field, event.currentTarget.value)}
            />
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if error}<div class="plugin-setting-error">{error}</div>{/if}
</div>

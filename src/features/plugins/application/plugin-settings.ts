import type { PluginSettingField, PluginSettingValue } from "../domain/plugin";

/** Host-owned namespace for schema-backed settings, intentionally separate from ctx.storage. */
export const PLUGIN_SETTINGS_STORAGE_PREFIX = "__mdv_settings_v1__:";

export function pluginSettingStorageKey(key: string) {
  return PLUGIN_SETTINGS_STORAGE_PREFIX + key;
}

/** Validates values at every trust boundary: Worker RPC and host settings UI. */
export function validatePluginSettingValue(field: PluginSettingField, value: unknown): PluginSettingValue {
  switch (field.type) {
    case "boolean":
      if (typeof value !== "boolean") throw new Error(`设置 ${field.key} 必须是布尔值`);
      return value;
    case "text":
      if (typeof value !== "string") throw new Error(`设置 ${field.key} 必须是文本`);
      if (value.length > 20_000) throw new Error(`设置 ${field.key} 文本超过 20,000 字符限制`);
      return value;
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`设置 ${field.key} 必须是有限数值`);
      if (field.min !== undefined && value < field.min) throw new Error(`设置 ${field.key} 不能小于 ${field.min}`);
      if (field.max !== undefined && value > field.max) throw new Error(`设置 ${field.key} 不能大于 ${field.max}`);
      return value;
    }
    case "select":
      if (typeof value !== "string" || !field.options.some((option) => option.value === value)) {
        throw new Error(`设置 ${field.key} 的选项无效`);
      }
      return value;
  }
}

import type { PluginDocumentRenderResult, PluginSettingField } from "../domain/plugin";

const MAX_DOCUMENT_HTML_CHARS = 6_000_000;
const MAX_SETTING_OPTIONS = 30;

export function normalizeLocalId(value: string) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(normalized)) throw new Error("插件 contribution id 格式无效");
  return normalized;
}

export function normalizeSettingKey(value: string) {
  const normalized = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(normalized)) throw new Error("插件设置 key 格式无效");
  return normalized;
}

export function normalizeSettingField(input: PluginSettingField): PluginSettingField {
  if (!input || typeof input !== "object") throw new Error("插件设置字段无效");
  const key = normalizeSettingKey(input.key);
  const label = String(input.label ?? "").trim().slice(0, 80);
  if (!label) throw new Error(`插件设置 ${key} 缺少 label`);
  const description = input.description ? String(input.description).trim().slice(0, 220) : undefined;
  switch (input.type) {
    case "boolean":
      return { key, type: "boolean", label, description, defaultValue: Boolean(input.defaultValue) };
    case "text":
      return {
        key, type: "text", label, description,
        defaultValue: String(input.defaultValue ?? "").slice(0, 20_000),
        placeholder: input.placeholder ? String(input.placeholder).slice(0, 160) : undefined,
        multiline: Boolean(input.multiline),
      };
    case "number": {
      const defaultValue = Number(input.defaultValue ?? 0);
      if (!Number.isFinite(defaultValue)) throw new Error(`插件设置 ${key} 的默认数值无效`);
      const min = input.min === undefined ? undefined : Number(input.min);
      const max = input.max === undefined ? undefined : Number(input.max);
      const step = input.step === undefined ? undefined : Number(input.step);
      if (min !== undefined && !Number.isFinite(min)) throw new Error(`插件设置 ${key} 的 min 无效`);
      if (max !== undefined && !Number.isFinite(max)) throw new Error(`插件设置 ${key} 的 max 无效`);
      if (step !== undefined && (!Number.isFinite(step) || step <= 0)) throw new Error(`插件设置 ${key} 的 step 无效`);
      if (min !== undefined && max !== undefined && min > max) throw new Error(`插件设置 ${key} 的 min 不能大于 max`);
      return { key, type: "number", label, description, defaultValue, min, max, step };
    }
    case "select": {
      const options = Array.isArray(input.options) ? input.options.slice(0, MAX_SETTING_OPTIONS).map((option) => ({
        label: String(option?.label ?? "").trim().slice(0, 80),
        value: String(option?.value ?? "").slice(0, 200),
      })).filter((option) => option.label) : [];
      if (options.length === 0) throw new Error(`插件设置 ${key} 至少需要一个 option`);
      const values = new Set(options.map((option) => option.value));
      if (values.size !== options.length) throw new Error(`插件设置 ${key} 的 option value 不能重复`);
      const defaultValue = String(input.defaultValue ?? options[0].value);
      if (!values.has(defaultValue)) throw new Error(`插件设置 ${key} 的默认值不在 options 中`);
      return { key, type: "select", label, description, defaultValue, options };
    }
    default:
      throw new Error(`不支持的插件设置类型：${String((input as { type?: unknown }).type)}`);
  }
}

export function validateDocumentRenderResult(input: PluginDocumentRenderResult): PluginDocumentRenderResult {
  if (!input || typeof input !== "object" || typeof input.html !== "string") {
    throw new Error("插件文档 renderer 必须返回包含 html 的对象");
  }
  if (input.html.length > MAX_DOCUMENT_HTML_CHARS) throw new Error("插件文档 HTML 超过 6,000,000 字符限制");
  const outline = Array.isArray(input.outline)
    ? input.outline.slice(0, 2_000).map((item, index) => ({
        id: String(item?.id ?? `plugin-heading-${index}`).slice(0, 160),
        level: Math.max(1, Math.min(6, Number(item?.level ?? 1))),
        title: String(item?.title ?? "").slice(0, 500),
      })).filter((item) => item.title)
    : undefined;
  const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : undefined;
  return {
    html: input.html,
    outline,
    lineCount: safeNumber(input.lineCount),
    wordCount: safeNumber(input.wordCount),
    characterCount: safeNumber(input.characterCount),
    estimatedReadMinutes: safeNumber(input.estimatedReadMinutes),
  };
}

export function clampOrder(value?: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(-1000, Math.min(1000, Math.round(value!)));
}

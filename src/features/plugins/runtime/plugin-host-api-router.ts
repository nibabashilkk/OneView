import type { PluginRepository } from "../application/plugin-repository";
import type { PluginHostServices } from "../application/plugin-host-services";
import { pluginSettingStorageKey, validatePluginSettingValue } from "../application/plugin-settings";
import type { PluginDiagnosticReport, PluginSettingField, PluginSettingValue } from "../domain/plugin";
import type { HostToPluginMessage } from "./plugin-protocol";
import { PluginPermissionGuard } from "./plugin-permission-guard";
import { normalizeSettingKey } from "./runtime-validation";

const MAX_EDITOR_WRITE_CHARS = 512_000;
const MAX_EDITOR_READ_CHARS = 2_000_000;
const MAX_SELECTION_READ_CHARS = 512_000;

export type PluginHostApiRouterOptions = {
  pluginId: string;
  repository: PluginRepository;
  services: PluginHostServices;
  guard: PluginPermissionGuard;
  getSettingField: (key: string) => PluginSettingField | undefined;
  post: (message: HostToPluginMessage) => void;
  diagnostic: (report: PluginDiagnosticReport) => void;
};

/** Routes typed Plugin API RPC. No Worker lifecycle or contribution registration lives here. */
export class PluginHostApiRouter {
  constructor(private readonly options: PluginHostApiRouterOptions) {}

  async handle(requestId: string, method: string, args: unknown[]) {
    const { pluginId, repository, services, guard, post, diagnostic } = this.options;
    try {
      let value: unknown = null;
      switch (method) {
        case "ui.notice":
          guard.require("ui.notice");
          services.showNotice(String(args[0] ?? "").slice(0, 500));
          break;
        case "workspace.getActiveFile":
          guard.require("workspace.read");
          value = services.getActiveFile();
          break;
        case "editor.getDocument": {
          guard.require("editor.read");
          const document = services.getEditorDocument();
          if (document && document.source.length > MAX_EDITOR_READ_CHARS) throw new Error("当前文档超过 Plugin API 2,000,000 字符读取限制");
          value = document;
          break;
        }
        case "editor.getSelection": {
          guard.require("editor.read");
          const selection = services.getEditorSelection();
          if (selection && selection.text.length > MAX_SELECTION_READ_CHARS) throw new Error("当前选区超过 Plugin API 512,000 字符读取限制");
          value = selection;
          break;
        }
        case "editor.replaceSelection": {
          guard.require("editor.write");
          const text = String(args[0] ?? "");
          if (text.length > MAX_EDITOR_WRITE_CHARS) throw new Error("单次编辑器写入超过 512,000 字符限制");
          services.replaceEditorSelection(text);
          break;
        }
        case "editor.insertText": {
          guard.require("editor.write");
          const text = String(args[0] ?? "");
          if (text.length > MAX_EDITOR_WRITE_CHARS) throw new Error("单次编辑器写入超过 512,000 字符限制");
          services.insertEditorText(text);
          break;
        }
        case "clipboard.writeText":
          guard.require("clipboard.write");
          await services.writeClipboard(String(args[0] ?? ""));
          break;
        case "settings.get": {
          guard.require("settings");
          const key = normalizeSettingKey(String(args[0] ?? ""));
          const field = this.options.getSettingField(key);
          if (!field) throw new Error(`未注册的插件设置：${key}`);
          const stored = await repository.storageGet<PluginSettingValue>(pluginId, pluginSettingStorageKey(key));
          if (stored === null) value = field.defaultValue;
          else {
            try { value = validatePluginSettingValue(field, stored); }
            catch (error) {
              const message = `设置 ${key} 的已保存值无效，已使用默认值：${error instanceof Error ? error.message : String(error)}`;
              services.reportError(pluginId, message);
              diagnostic({ level: "warning", kind: "settings", message });
              value = field.defaultValue;
            }
          }
          break;
        }
        case "settings.set": {
          guard.require("settings");
          const key = normalizeSettingKey(String(args[0] ?? ""));
          const field = this.options.getSettingField(key);
          if (!field) throw new Error(`未注册的插件设置：${key}`);
          const next = validatePluginSettingValue(field, args[1]);
          await repository.storageSet(pluginId, pluginSettingStorageKey(key), next);
          value = next;
          post({ channel: "mdv-host", type: "settings-changed", key, value: next });
          break;
        }
        case "storage.get":
          guard.require("storage");
          value = await repository.storageGet(pluginId, String(args[0] ?? ""));
          break;
        case "storage.set":
          guard.require("storage");
          await repository.storageSet(pluginId, String(args[0] ?? ""), args[1]);
          break;
        case "storage.delete":
          guard.require("storage");
          await repository.storageDelete(pluginId, String(args[0] ?? ""));
          break;
        default:
          throw new Error(`未知 Plugin API: ${method}`);
      }
      post({ channel: "mdv-host", type: "response", requestId, ok: true, value });
    } catch (error) {
      post({ channel: "mdv-host", type: "response", requestId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

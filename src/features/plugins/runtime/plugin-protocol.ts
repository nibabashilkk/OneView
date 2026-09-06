import type { PluginDocumentRenderInput, PluginDocumentRenderResult, PluginEventName, PluginRuntimeKind, PluginSettingField, PluginSettingValue, PluginUiContributionPlacement, PluginUiContributionSide, PluginUiContributionWhen, PluginUiIcon } from "../domain/plugin";


export type RuntimeHostInitMessage = {
  channel: "mdv-runtime-host";
  type: "initialize";
  pluginId: string;
  runtime: PluginRuntimeKind;
  mainJs: string;
};

export type PluginCommandDefinition = {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
};

export type PluginUiContributionDefinition = {
  id: string;
  placement: PluginUiContributionPlacement;
  label: string;
  command: string;
  tooltip?: string;
  icon?: PluginUiIcon;
  order?: number;
  when?: PluginUiContributionWhen;
  side?: PluginUiContributionSide;
};

export type PluginPanelDefinition = {
  id: string;
  title: string;
  html: string;
  css?: string;
  icon?: PluginUiIcon;
  order?: number;
  when?: PluginUiContributionWhen;
};


export type PluginSettingsDefinition = {
  title?: string;
  fields: PluginSettingField[];
};

export type PluginToHostMessage =
  | { channel: "mdv-plugin"; pluginId: string; type: "ready" }
  | { channel: "mdv-plugin"; pluginId: string; type: "unloaded" }
  | { channel: "mdv-plugin"; pluginId: string; type: "fatal"; error: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "register-command"; command: PluginCommandDefinition }
  | { channel: "mdv-plugin"; pluginId: string; type: "unregister-command"; commandId: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "register-contribution"; contribution: PluginUiContributionDefinition }
  | { channel: "mdv-plugin"; pluginId: string; type: "unregister-contribution"; contributionId: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "register-panel"; panel: PluginPanelDefinition }
  | { channel: "mdv-plugin"; pluginId: string; type: "unregister-panel"; panelId: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "open-panel"; panelId: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "close-panel"; panelId: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "panel-post-message"; panelId: string; payload: unknown }
  | { channel: "mdv-plugin"; pluginId: string; type: "panel-error"; panelId: string; error: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "register-settings"; settings: PluginSettingsDefinition }
  | { channel: "mdv-plugin"; pluginId: string; type: "unregister-settings" }
  | { channel: "mdv-plugin"; pluginId: string; type: "subscribe-event"; eventName: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "unsubscribe-event"; eventName: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "render-document-result"; requestId: string; ok: true; result: PluginDocumentRenderResult }
  | { channel: "mdv-plugin"; pluginId: string; type: "render-document-result"; requestId: string; ok: false; error: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "request"; requestId: string; method: string; args: unknown[] }
  | { channel: "mdv-plugin"; pluginId: string; type: "command-error"; commandId: string; error: string }
  | { channel: "mdv-plugin"; pluginId: string; type: "event-error"; eventName: string; error: string };

export type HostToPluginMessage =
  | { channel: "mdv-host"; type: "response"; requestId: string; ok: true; value: unknown }
  | { channel: "mdv-host"; type: "response"; requestId: string; ok: false; error: string }
  | { channel: "mdv-host"; type: "invoke-command"; commandId: string }
  | { channel: "mdv-host"; type: "event"; eventName: PluginEventName; payload: unknown }
  | { channel: "mdv-host"; type: "panel-message"; panelId: string; payload: unknown }
  | { channel: "mdv-host"; type: "render-document"; requestId: string; formatId: string; document: PluginDocumentRenderInput }
  | { channel: "mdv-host"; type: "settings-changed"; key: string; value: PluginSettingValue }
  | { channel: "mdv-host"; type: "unload" };

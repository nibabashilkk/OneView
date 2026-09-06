import type { PluginPanelContribution, PluginUiContribution } from "../domain/plugin";

export type PluginContributionVisibilityContext = {
  hasDocument: boolean;
  editable: boolean;
  hasSelection?: boolean;
  hasLink?: boolean;
};

/** Deliberately tiny v1 predicate model; no eval/expression language inside third-party manifests. */
export function isPluginContributionVisible(
  contribution: PluginUiContribution | PluginPanelContribution,
  context: PluginContributionVisibilityContext,
) {
  switch (contribution.when) {
    case "document": return context.hasDocument;
    case "editable": return context.hasDocument && context.editable;
    case "selection": return Boolean(context.hasSelection);
    case "link": return Boolean(context.hasLink);
    default: return true;
  }
}

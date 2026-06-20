/**
 * Utility to add Dyad component selector attributes for live editing.
 * Usage: <div {...dyadProps("Dashboard")} />
 *
 * Hinweis (Audit D): Dies sind Marker für das Dyad-Builder-Tooling
 * (Live-Komponentenauswahl im Editor). Rein additive `data-*`-Attribute
 * ohne Laufzeitwirkung — beibehalten, solange das Tooling genutzt wird.
 */

export function dyadProps(componentName: string, componentPath?: string) {
  return {
    "data-dyad-component": componentName,
    ...(componentPath ? { "data-dyad-component-path": componentPath } : {}),
  };
}

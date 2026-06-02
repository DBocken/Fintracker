/**
 * Utility to add Dyad component selector attributes for live editing.
 * Usage: <div {...dyadProps("Dashboard")} />
 */

export function dyadProps(componentName: string, componentPath?: string) {
  return {
    "data-dyad-component": componentName,
    ...(componentPath ? { "data-dyad-component-path": componentPath } : {}),
  };
}

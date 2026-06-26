/**
 * Chart theme utilities for light/dark mode support.
 * Detects Tailwind's dark class and provides appropriate colors.
 */

export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Subscribe to dark mode changes (for real-time theme switching).
 * Returns a cleanup function.
 */
export function subscribeToDarkModeChanges(callback: (isDark: boolean) => void): () => void {
  const observer = new MutationObserver(() => {
    callback(isDarkMode());
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}

/**
 * Color schemes for chart elements in both light and dark modes.
 */
export const CHART_COLORS = {
  light: {
    // Liquidity line chart
    operatingStroke: '#0d7377',      // darker teal for light bg
    operatingFillStart: '#0d7377',
    operatingFillStartOpacity: 0.25,
    operatingFillEndOpacity: 0.02,

    mcBandStart: '#4f46e5',          // slightly darker indigo
    mcBandStartOpacity: 0.2,
    mcBandEndOpacity: 0.04,

    medianStroke: '#4f46e5',         // indigo

    bufferLine: '#b45309',           // darker amber for light bg
    zeroLine: '#374151',             // dark gray

    // Grid and axis
    gridStroke: '#d1d5db',           // light gray
    axisStroke: '#6b7280',           // medium gray
    axisText: '#374151',             // dark gray

    // Heatmap
    heatmapBg: '#ffffff',            // white background
    heatmapText: '#1f2937',          // dark gray text
    heatmapGrid: '#d1d5db',          // light gray grid
    heatmapAxis: '#6b7280',          // medium gray
    heatmapAxisText: '#1f2937',      // dark text
    heatmapMedian: '#1f2937',        // dark for P50 line
  },
  dark: {
    // Liquidity line chart
    operatingStroke: '#1d5c54',      // dark teal
    operatingFillStart: '#1d5c54',
    operatingFillStartOpacity: 0.35,
    operatingFillEndOpacity: 0.02,

    mcBandStart: '#6366f1',          // indigo
    mcBandStartOpacity: 0.28,
    mcBandEndOpacity: 0.05,

    medianStroke: '#6366f1',         // indigo

    bufferLine: '#d97706',           // amber
    zeroLine: 'rgba(226,232,240,0.5)',

    // Grid and axis
    gridStroke: 'rgba(148,163,184,0.2)',
    axisStroke: 'rgba(148,163,184,0.65)',
    axisText: 'rgba(226,232,240,0.75)',

    // Heatmap
    heatmapBg: '#0b1220',            // very dark navy
    heatmapText: 'rgba(226,232,240,0.65)',
    heatmapGrid: 'rgba(148,163,184,0.16)',
    heatmapAxis: 'rgba(226,232,240,0.65)',
    heatmapAxisText: 'rgba(226,232,240,0.75)',
    heatmapMedian: 'rgba(255,255,255,0.92)',
  },
};

export function getChartColors() {
  return isDarkMode() ? CHART_COLORS.dark : CHART_COLORS.light;
}

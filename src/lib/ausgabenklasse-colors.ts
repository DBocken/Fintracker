/**
 * Farben für Ausgabenklassen (Sunburst-Struktur).
 * Konsistent mit dem Sunburst-Diagramm.
 */

import type { Ausgabenklasse } from '@/types';

export const AUSGABENKLASSE_COLORS: Record<Ausgabenklasse | 'unkategorisiert', string> = {
  essenziell: 'hsl(var(--chart-1))',      // Mint-Salbei
  diskretionaer: 'hsl(var(--chart-3))',   // Koralle
  sparen: 'hsl(var(--chart-4))',          // Amber
  einkommen: 'hsl(var(--chart-2))',       // Periwinkle
  unkategorisiert: 'hsl(var(--chart-6))', // Rose
};

/**
 * Erzeugt Farbschattierungen (Shades) für Hauptkategorien innerhalb einer Ausgabenklasse.
 * Je dunkler die Schattierung, desto mehr Wert wurde in dieser Kategorie ausgegeben.
 *
 * @param baseColor - Hex- oder HSL-Farbe der Ausgabenklasse
 * @param index - Index der Hauptkategorie (0 = hellste Schattierung)
 * @param total - Gesamtzahl der Kategorien in dieser Klasse
 * @returns CSS-Farbwert (hex oder hsl)
 */
export function getKlasseShade(
  baseColor: string,
  index: number,
  total: number
): string {
  // Einfache Opacity-basierte Schattierung: hellere Kategorien bei niedrigen Indizes
  const alpha = 0.6 + (index / Math.max(1, total - 1)) * 0.4;
  return baseColor.replace(')', `, ${alpha * 100}%)`);
}

export function getAusgabenklasseColor(klasse: Ausgabenklasse | null): string {
  if (!klasse) return AUSGABENKLASSE_COLORS.unkategorisiert;
  return AUSGABENKLASSE_COLORS[klasse] || AUSGABENKLASSE_COLORS.unkategorisiert;
}

/**
 * Darstellungsdichte: **kompakt** oder **fokussiert**.
 *
 * Umsetzung von `docs/architecture/darstellungsdichte.md` (ADR vom
 * 2026-08-30). Diese Datei ist die einzige Stelle, an der die Frage „welche
 * Dichte?" beantwortet wird — bewusst als reine Funktion ohne React und ohne
 * Browser-API, damit die Entscheidung ohne DOM prüfbar ist (`domain/`-Regel,
 * AGENTS.md §3).
 *
 * **Warum eine benannte Konstante und nicht `lg:`/`sm:`.** Der Bestand kannte
 * drei Schwellen für dieselbe Frage: `useIsMobile` (639), `useIsWideDesktop`
 * (1024) und verstreute `md:hidden`/`lg:hidden`/`sm:hidden`. Die ADR macht
 * daraus **eine** Dichte-Schwelle; die beiden Hooks bleiben bestehen, dürfen
 * aber nur noch das Layout INNERHALB einer Dichte steuern, nie die Dichte
 * selbst.
 */

export type DisplayDensity = 'kompakt' | 'fokussiert';

/**
 * Die **einzige** Dichte-Schwelle der App, in CSS-Pixeln.
 *
 * **Warum 768 und nicht 1024.** Media Queries messen CSS-Pixel, nicht
 * Geräte-Pixel — ein 4K-Telefon meldet rund 411 CSS-Pixel und ist damit
 * schmaler als jeder Laptop. Der Zahlenwert hängt aber an einem anderen Fall:
 * „Desktopseite anfordern" lässt den Browser `width=device-width` ignorieren
 * und auf einen Ersatz-Viewport von rund **980** CSS-Pixeln zurückfallen.
 * Läge die Schwelle bei 1024, landete genau dieser Nutzer UNTER ihr und
 * bekäme trotzdem die fokussierte Fassung — der Ausweg wäre wirkungslos. Die
 * Schwelle muss unter dem Ersatz-Viewport liegen; 768 tut das mit Abstand.
 *
 * Browser-Zoom ist eingeschlossen und gewollt: 200 % auf einem 1440-px-Fenster
 * ergeben effektiv 720 CSS-Pixel und damit fokussiert. Wer stark vergrössert,
 * will weniger Dinge gleichzeitig, grösser.
 */
export const DENSITY_THRESHOLD_PX = 768;

/** Media Query der kompakten Dichte — eine Quelle für CSS und JS. */
export const COMPACT_MEDIA_QUERY = `(min-width: ${DENSITY_THRESHOLD_PX}px)`;

export type DensityContext = {
  /**
   * Läuft als installierte App (Capacitor), nicht im Browser.
   *
   * Schlägt die Breite: Die App ist **immer** fokussiert, auch auf einem
   * Tablet im Querformat. Sie ist ein Produkt mit einem Verhalten — nicht
   * eines, das sich je nach Gerät anders anfühlt.
   */
  isNativeApp: boolean;
  /**
   * Breite des Layout-Viewports in CSS-Pixeln. `null`, wenn sie nicht
   * ermittelbar ist (kein `window`, kein `matchMedia` — SSR, Tests).
   */
  viewportWidthPx: number | null;
};

/**
 * Die Dichte für einen Kontext.
 *
 * **Ohne bekannte Breite gilt fokussiert.** Das ist kein neutraler Default,
 * sondern die sichere Richtung: Die fokussierte Fassung ist auf jedem
 * Bildschirm bedienbar, nur weniger dicht. Die kompakte Fassung auf einem
 * Telefon ist es nicht — sie ist genau der Fehler, den AGENTS.md §4 den
 * häufigsten nennt.
 */
export function resolveDensity({ isNativeApp, viewportWidthPx }: DensityContext): DisplayDensity {
  if (isNativeApp) return 'fokussiert';
  if (viewportWidthPx === null) return 'fokussiert';
  return viewportWidthPx >= DENSITY_THRESHOLD_PX ? 'kompakt' : 'fokussiert';
}

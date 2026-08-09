/**
 * Reiner Re-Export von `date-fns/locale/en-US`, unter einem Dateinamen OHNE
 * Bindestrich (WP 5.5b).
 *
 * Grund: `date-fns-locale.ts` importiert diese Datei per `import()` — Rollup/
 * Vite benennt den dabei entstehenden Chunk nach dem Dateinamen. Ein direkter
 * `import('date-fns/locale/en-US')` würde einen Chunk `en-US-<hash>.js`
 * erzeugen. `chunkName()` (`scripts/bundle-size-core.mjs`) strippt den
 * Hash-Suffix mit `-[A-Za-z0-9_-]{8,}$` — das Zeichenset schliesst
 * Bindestriche mit ein, wodurch bei „en-US-<hash>" (interner Bindestrich VOR
 * dem Hash-Bindestrich) zu viel weggeschnitten wird: übrig bleibt „en" — und
 * kollidiert mit dem gleichnamigen i18n-Sprachbaum-Chunk aus
 * `translation-registry.ts` (`src/i18n/translations/en.ts`). Zwei Chunks mit
 * demselben bereinigten Namen überschreiben sich in
 * `scripts/check-bundle-size.mjs`s `measured`-Map gegenseitig — das Budget
 * für den (weit größeren) Übersetzungsbaum würde dann unbemerkt nicht mehr
 * geprüft. Ein bindestrichfreier Dateiname umgeht die Kollision, ohne die
 * Wächter-Regex selbst anfassen zu müssen.
 */
export { enUS } from 'date-fns/locale/en-US';

/**
 * Was Planung und Formulare gemeinsam brauchen.
 *
 * Stand zuvor am Kopf von `ForecastPlanner.tsx`, zwischen Importen und der
 * Komponente.
 */

/** Euro-Darstellung der Prognose-Eingaben. */
export const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Heutiges Datum als ISO-Tag — Vorbelegung der Datumsfelder. */
export const today = () => new Date().toISOString().slice(0, 10);

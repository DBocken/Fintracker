/// <reference types="vite/client" />

/**
 * Die `@fontsource-variable/*`-Pakete liefern nur CSS und keine Typen. Bis
 * TypeScript 5.x war ein Seiteneffekt-Import ohne Deklaration stillschweigend
 * erlaubt; ab TypeScript 6 verlangt er eine (TS2882). Das Modul hat bewusst
 * keinen Wert-Export — der Import lädt ausschließlich die Schriftdateien.
 */
declare module '@fontsource-variable/*';

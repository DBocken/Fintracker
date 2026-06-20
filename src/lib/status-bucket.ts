/**
 * Zentrale 5-stufige Status-Logik für alle Score-/Kennzahl-Darstellungen.
 *
 * Einzige Quelle der Wahrheit für die Buckets aus dem Produkt-Audit
 * (Abschnitt G) und ersetzt die verstreuten Schwellenwerte in
 * `FinancialLandscape` (`getStage`/`scoreColor`) und der Tone-Logik in
 * `financial-health-service` (`getHealthLabel`).
 *
 *   0–20  kritisch     |  21–40 schwach  |  41–60 mittel
 *   61–80 gut          |  81–100 sehr gut
 */

export type StatusBucket = "critical" | "weak" | "mid" | "good" | "excellent";

/** Reihenfolge von schlecht nach gut — auch als 1-basierte Stufe nutzbar. */
export const STATUS_BUCKETS: StatusBucket[] = [
  "critical",
  "weak",
  "mid",
  "good",
  "excellent",
];

const BUCKET_LABEL: Record<StatusBucket, string> = {
  critical: "kritisch",
  weak: "schwach",
  mid: "mittel",
  good: "gut",
  excellent: "sehr gut",
};

/** Score (0–100) → semantischer Status-Bucket. */
export function getStatusBucket(score: number): StatusBucket {
  if (score <= 20) return "critical";
  if (score <= 40) return "weak";
  if (score <= 60) return "mid";
  if (score <= 80) return "good";
  return "excellent";
}

/** 1-basierte Stufe (1–5), praktisch für Asset-Indizes (`name${stage-1}`). */
export function getStatusStage(score: number): 1 | 2 | 3 | 4 | 5 {
  return (STATUS_BUCKETS.indexOf(getStatusBucket(score)) + 1) as 1 | 2 | 3 | 4 | 5;
}

/** Deutsches Label für die Stufe ("kritisch" … "sehr gut"). */
export function statusLabel(bucket: StatusBucket): string {
  return BUCKET_LABEL[bucket];
}

/** CSS-`hsl(var(--status-*))`-Ausdruck für inline-Styles (z. B. SVG-stroke). */
export function statusColorVar(bucket: StatusBucket): string {
  return `hsl(var(--status-${bucket}))`;
}

/*
 * Literale Klassennamen (kein String-Templating!), damit Tailwinds
 * Content-Scanner sie findet und nicht wegpurged.
 */
const TEXT_CLASS: Record<StatusBucket, string> = {
  critical: "text-status-critical",
  weak: "text-status-weak",
  mid: "text-status-mid",
  good: "text-status-good",
  excellent: "text-status-excellent",
};

const BG_CLASS: Record<StatusBucket, string> = {
  critical: "bg-status-critical",
  weak: "bg-status-weak",
  mid: "bg-status-mid",
  good: "bg-status-good",
  excellent: "bg-status-excellent",
};

/** Tailwind-Textfarbklasse für den Bucket. */
export function statusTextClass(bucket: StatusBucket): string {
  return TEXT_CLASS[bucket];
}

/** Tailwind-Hintergrundklasse für den Bucket. */
export function statusBgClass(bucket: StatusBucket): string {
  return BG_CLASS[bucket];
}

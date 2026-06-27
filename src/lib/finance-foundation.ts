// „Dein Finanz-Fundament" – 6 Etappen (eigene, rechtssichere Variante einer
// stufenweisen Finanz-Roadmap; bewusst 6 Stufen, eigene Namen/Texte).
//
// Reine, datengetriebene Logik: erkennt aus realen Kennzahlen die aktuelle
// Etappe und den Fortschritt. Sequentiell – die erste nicht abgeschlossene
// Etappe ist „aktiv".

export type FoundationStageKey =
  | "starthilfe"
  | "teure_schulden"
  | "sicherheitspolster"
  | "zukunft_besparen"
  | "grosse_ziele"
  | "frei_grosszuegig";

export interface FoundationInput {
  /** Liquider Sofort-Puffer (verfügbares Bargeld/Tagesgeld) in €. */
  liquidBuffer: number;
  /** Monatsausgaben (Median) in €. */
  monthlyExpenses: number;
  /** Verbleibende Konsumschulden in € (ohne Immobilienkredit). */
  consumerDebt: number;
  /** Sparquote 0..1. */
  savingsRate: number;
  /** Fortschritt „große Ziele" 0..1 (z. B. aus Milestones). */
  goalsFunded?: number;
}

export type FoundationStatus = "completed" | "active" | "locked";

export interface FoundationStage {
  key: FoundationStageKey;
  order: number;
  title: string;
  description: string;
  whyItMatters: string;
  /** Fortschritt 0..1. */
  progress: number;
  status: FoundationStatus;
}

export interface FoundationResult {
  stages: FoundationStage[];
  currentKey: FoundationStageKey;
  /** Mittlerer Fortschritt über alle Etappen (0..1). */
  overallProgress: number;
}

export const STARTER_TARGET = 1000;
export const BUFFER_MONTHS_TARGET = 3;
export const SAVINGS_TARGET = 0.15;
const EPS = 1e-9;

const STAGE_META: Record<FoundationStageKey, { order: number; title: string; description: string; whyItMatters: string }> = {
  starthilfe: {
    order: 1,
    title: "Starthilfe",
    description: `Ein erster Sofort-Puffer (Ziel: ${STARTER_TARGET} €).`,
    whyItMatters: "Kleine Überraschungen lösen so keine neuen Schulden aus.",
  },
  teure_schulden: {
    order: 2,
    title: "Teure Schulden raus",
    description: "Konsumschulden (Raten, Karten, BNPL) systematisch tilgen.",
    whyItMatters: "Jede getilgte Schuld schafft dauerhaft mehr monatlichen Spielraum.",
  },
  sicherheitspolster: {
    order: 3,
    title: "Sicherheitspolster",
    description: `${BUFFER_MONTHS_TARGET}–6 Monatsausgaben als Notgroschen aufbauen.`,
    whyItMatters: "Ein echter Puffer macht dich unabhängig von kurzfristigen Schocks.",
  },
  zukunft_besparen: {
    order: 4,
    title: "Zukunft besparen",
    description: `Feste Sparquote (Ziel: ${Math.round(SAVINGS_TARGET * 100)} %) – Altersvorsorge/ETF.`,
    whyItMatters: "Regelmäßiges Investieren nutzt den Zinseszins über die Jahre.",
  },
  grosse_ziele: {
    order: 5,
    title: "Große Ziele",
    description: "Eigenheim, Bildung, Familie als Rücklagen-Töpfe planen.",
    whyItMatters: "Mit stabiler Basis werden große Vorhaben planbar statt stressig.",
  },
  frei_grosszuegig: {
    order: 6,
    title: "Frei & großzügig",
    description: "Vermögen weiter aufbauen und gezielt geben.",
    whyItMatters: "Finanzielle Freiheit schafft Spielraum für das, was dir wichtig ist.",
  },
};

const ORDER: FoundationStageKey[] = [
  "starthilfe",
  "teure_schulden",
  "sicherheitspolster",
  "zukunft_besparen",
  "grosse_ziele",
  "frei_grosszuegig",
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function stageProgress(key: FoundationStageKey, input: FoundationInput): number {
  const expenses = input.monthlyExpenses;
  switch (key) {
    case "starthilfe":
      return clamp01(input.liquidBuffer / STARTER_TARGET);
    case "teure_schulden":
      return input.consumerDebt > 0 ? 0 : 1;
    case "sicherheitspolster": {
      if (expenses <= 0) return input.liquidBuffer > 0 ? 1 : 0;
      return clamp01(input.liquidBuffer / expenses / BUFFER_MONTHS_TARGET);
    }
    case "zukunft_besparen":
      return clamp01(input.savingsRate / SAVINGS_TARGET);
    case "grosse_ziele":
      return clamp01(input.goalsFunded ?? 0);
    case "frei_grosszuegig":
      // Laufende Etappe: rampt von der Zielsparquote (15 %) bis 25 % hoch.
      return clamp01((input.savingsRate - SAVINGS_TARGET) / (0.25 - SAVINGS_TARGET));
  }
}

/**
 * Berechnet alle 6 Etappen mit Fortschritt und Status. Die erste nicht
 * abgeschlossene Etappe (in fester Reihenfolge) ist „aktiv", spätere sind
 * „gesperrt".
 */
export function computeFinanceFoundation(input: FoundationInput): FoundationResult {
  const progresses = ORDER.map((key) => ({ key, progress: stageProgress(key, input) }));
  const firstOpen = progresses.find((p) => p.progress < 1 - EPS);
  const currentKey = firstOpen ? firstOpen.key : ORDER[ORDER.length - 1];

  const stages: FoundationStage[] = progresses.map(({ key, progress }) => ({
    ...STAGE_META[key],
    key,
    progress,
    status: progress >= 1 - EPS ? "completed" : key === currentKey ? "active" : "locked",
  }));

  const overallProgress = progresses.reduce((s, p) => s + p.progress, 0) / ORDER.length;
  return { stages, currentKey, overallProgress };
}

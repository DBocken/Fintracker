// „Dein Finanz-Fundament" – 6 Etappen (eigene, rechtssichere Variante einer
// stufenweisen Finanz-Roadmap; bewusst 6 Stufen, eigene Namen/Texte).
//
// Reine, datengetriebene Logik: erkennt aus realen Kennzahlen die aktuelle
// Etappe und den Fortschritt. Sequentiell – die erste nicht abgeschlossene
// Etappe ist „aktiv".

import { t } from "../i18n/serviceT";

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

function buildStageMeta(): Record<FoundationStageKey, { order: number; title: string; description: string; whyItMatters: string }> {
  return {
    starthilfe: {
      order: 1,
      title: t("financeFoundation.starthilfe.title"),
      description: t("financeFoundation.starthilfe.description").replace("{target}", String(STARTER_TARGET)),
      whyItMatters: t("financeFoundation.starthilfe.whyItMatters"),
    },
    teure_schulden: {
      order: 2,
      title: t("financeFoundation.teureSchulden.title"),
      description: t("financeFoundation.teureSchulden.description"),
      whyItMatters: t("financeFoundation.teureSchulden.whyItMatters"),
    },
    sicherheitspolster: {
      order: 3,
      title: t("financeFoundation.sicherheitspolster.title"),
      description: t("financeFoundation.sicherheitspolster.description").replace("{months}", String(BUFFER_MONTHS_TARGET)),
      whyItMatters: t("financeFoundation.sicherheitspolster.whyItMatters"),
    },
    zukunft_besparen: {
      order: 4,
      title: t("financeFoundation.zukunftBesparen.title"),
      description: t("financeFoundation.zukunftBesparen.description").replace("{percent}", String(Math.round(SAVINGS_TARGET * 100))),
      whyItMatters: t("financeFoundation.zukunftBesparen.whyItMatters"),
    },
    grosse_ziele: {
      order: 5,
      title: t("financeFoundation.grosseZiele.title"),
      description: t("financeFoundation.grosseZiele.description"),
      whyItMatters: t("financeFoundation.grosseZiele.whyItMatters"),
    },
    frei_grosszuegig: {
      order: 6,
      title: t("financeFoundation.freiGrosszuegig.title"),
      description: t("financeFoundation.freiGrosszuegig.description"),
      whyItMatters: t("financeFoundation.freiGrosszuegig.whyItMatters"),
    },
  };
}

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
  const stageMeta = buildStageMeta();
  const progresses = ORDER.map((key) => ({ key, progress: stageProgress(key, input) }));
  const firstOpen = progresses.find((p) => p.progress < 1 - EPS);
  const currentKey = firstOpen ? firstOpen.key : ORDER[ORDER.length - 1];

  const stages: FoundationStage[] = progresses.map(({ key, progress }) => ({
    ...stageMeta[key],
    key,
    progress,
    status: progress >= 1 - EPS ? "completed" : key === currentKey ? "active" : "locked",
  }));

  const overallProgress = progresses.reduce((s, p) => s + p.progress, 0) / ORDER.length;
  return { stages, currentKey, overallProgress };
}

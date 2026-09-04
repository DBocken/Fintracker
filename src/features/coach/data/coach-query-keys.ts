import type { TutorialChapterId } from '@/lib/tutorial-sequence';

/**
 * Query-Keys der Coach-Fläche — **byte-identisch** zu den Literalen, die bis
 * zur Slice-Migration in `src/pages/CoachPage.tsx` standen. Jede Abweichung
 * würde bestehende Caches und Invalidierungen stillschweigend trennen
 * (`docs/architecture/feature-structure.md`, Kochrezept Schritt 4).
 *
 * `financialHealth` und `milestones` teilen sich ihren Key bewusst mit anderen
 * Flächen (`DashboardMobileStory`, `MilestonesPage`): Es ist dieselbe Frage an
 * dieselben Daten, und ein eigener Key je Fläche hiesse, sie mehrfach zu
 * berechnen.
 */
export const coachKeys = {
  overview: (
    locale: string,
    includeTaxReserve: boolean,
    tutorialChapter: TutorialChapterId | null,
  ) => ['coach-overview', locale, includeTaxReserve, tutorialChapter] as const,
  financialHealth: (locale: string) => ['financial-health', locale] as const,
  milestones: (locale: string) => ['milestones', locale] as const,
  /**
   * Ohne `locale`: Die Frage „gibt es überhaupt Finanzdaten?" hat in jeder
   * Sprache dieselbe Antwort. Eigener Key statt des Buchungs-Caches, damit die
   * Bestandsfrage den vollständigen Buchungsbestand nicht verdrängt.
   */
  hasFinanceData: () => ['has-finance-data'] as const,
} as const;

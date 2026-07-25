import { describe, it, expect } from 'vitest';
import {
  TUTORIAL_ORDER,
  TUTORIAL_SOURCES,
  CORE_CHAPTER_IDS,
  buildCurriculum,
  chapterById,
  type DataReadiness,
  type TutorialChapterId,
} from '../tutorial-sequence';
import { NAV_FEATURE_PATHS, type NavFeatureId } from '../life-situations';

/**
 * Lehrplan des Tutorials (`docs/tutorial-sequence.md`).
 *
 * Die Tests sichern die drei Entscheidungen ab, die dort getroffen wurden und
 * sich sonst still verlieren würden: die Reihenfolge entlang des Geldflusses,
 * die Stadt als Kernkapitel und „vertagen statt leer zeigen".
 */

/** Frisch importiert, ein einziger Monat — der typische CSV-Einstieg. */
const oneMonth: DataReadiness = {
  transactionCount: 60,
  monthsOfHistory: 1,
  categorizedMonths: 1,
  accountCount: 1,
  hasSalaryDetected: false,
  hasRecurringDetected: false,
  hasBudget: false,
  hasDebt: false,
  hasOccasion: false,
  hasAssetsBeyondAccounts: false,
  hasDeductibleCategory: false,
  businessMode: false,
  hasPortfolio: false,
  hasPremiumAccess: false,
};

/** Alles erfüllt — der Zustand, den der Demo-Datensatz herstellen muss. */
const fullyReady: DataReadiness = {
  transactionCount: 180,
  monthsOfHistory: 3,
  categorizedMonths: 3,
  accountCount: 2,
  hasSalaryDetected: true,
  hasRecurringDetected: true,
  hasBudget: true,
  hasDebt: true,
  hasOccasion: true,
  hasAssetsBeyondAccounts: true,
  hasDeductibleCategory: true,
  businessMode: true,
  hasPortfolio: true,
  hasPremiumAccess: true,
};

/** Ganz am Anfang: die Weiche ist durchlaufen, aber es gibt noch nichts. */
const empty: DataReadiness = { ...oneMonth, transactionCount: 0, categorizedMonths: 0, accountCount: 0 };

const ALL_FEATURES = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

function ids(chapters: readonly TutorialChapterId[]): string[] {
  return [...chapters];
}

describe('TUTORIAL_ORDER', () => {
  it('sollte jede Kapitel-ID nur einmal führen', () => {
    const seen = TUTORIAL_ORDER.map((c) => c.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('sollte nur auf Bereiche verweisen, die es wirklich gibt', () => {
    const optional = TUTORIAL_ORDER.filter((c) => c.feature !== null);
    for (const chapter of optional) {
      expect(ALL_FEATURES).toContain(chapter.feature);
    }
  });

  it('sollte mit der Datenquellen-Weiche beginnen', () => {
    expect(TUTORIAL_ORDER[0]?.id).toBe('source');
  });

  it('sollte den Euro durch den Monat führen: Einkommen vor Verträgen vor Budgets vor Liquidität', () => {
    const order = TUTORIAL_ORDER.map((c) => c.id);
    expect(order.indexOf('income')).toBeLessThan(order.indexOf('contracts'));
    expect(order.indexOf('contracts')).toBeLessThan(order.indexOf('budgets'));
    expect(order.indexOf('budgets')).toBeLessThan(order.indexOf('liquidity'));
  });

  it('sollte mit dem Ausgang enden, damit auch ein Abbrecher den Rückweg kennt', () => {
    const order = TUTORIAL_ORDER.map((c) => c.id);
    expect(order[order.length - 1]).toBe('settings');
    expect(order[order.length - 2]).toBe('export');
  });

  it('sollte drei Datenquellen-Wege kennen', () => {
    expect([...TUTORIAL_SOURCES]).toEqual(['csv', 'bank', 'demo']);
  });
});

describe('buildCurriculum — Kernkapitel', () => {
  it('sollte Kernkapitel auch dann führen, wenn gar kein Bereich gewählt ist', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: [],
      lifeSituation: null,
      readiness: fullyReady,
    });
    const all = [...next, ...postponed];
    for (const core of CORE_CHAPTER_IDS) {
      expect(all).toContain(core);
    }
  });

  it('sollte die Finanzstadt als Kernkapitel führen, auch ohne den Bereich in der Auswahl', () => {
    const { next } = buildCurriculum({
      enabledFeatures: [],
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
    });
    expect(next).toContain('city');
  });

  it('sollte die erste Sitzung mit der Stadt abschließen: Dashboard davor, Coach danach', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
    });
    expect(next.indexOf('dashboard')).toBeLessThan(next.indexOf('city'));
    expect(next.indexOf('city')).toBeLessThan(next.indexOf('coach'));
  });

  it('sollte das Kategorien-Kapitel weglassen, wenn Unterkategorien abgeschaltet sind', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'student_school',
      readiness: fullyReady,
      subcategoriesEnabled: false,
    });
    expect([...next, ...postponed]).not.toContain('categories');
  });
});

describe('buildCurriculum — Bereichsauswahl', () => {
  it('sollte optionale Kapitel nur bei gewähltem Bereich führen', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: ['budgets'],
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
    });
    const all = [...next, ...postponed];
    expect(all).toContain('budgets');
    expect(all).not.toContain('trading');
    expect(all).not.toContain('debts');
  });

  it('sollte bei fehlender Auswahl alles außer den Opt-in-Bereichen führen', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: null,
      lifeSituation: null,
      readiness: fullyReady,
    });
    const all = [...next, ...postponed];
    expect(all).toContain('trading');
    // Die EÜR ist echtes Opt-in (DEFAULT_OFF_FEATURES) und darf niemandem
    // ungefragt erklärt werden.
    expect(all).not.toContain('euer');
  });
});

describe('buildCurriculum — Datenreife', () => {
  it('sollte Kapitel ohne Datengrundlage vertagen statt leer zu zeigen', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: oneMonth,
    });
    // Einkommenserkennung, Vertragserkennung und adaptive Budgets brauchen
    // drei Monate (salary-detection, contract-detection, budget-adaptive).
    expect(postponed).toContain('income');
    expect(postponed).toContain('contracts');
    expect(postponed).toContain('budgets');
    expect(next).not.toContain('income');
  });

  it('sollte die Stadt schon nach einem kategorisierten Monat zeigen', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: oneMonth,
    });
    expect(next).toContain('city');
  });

  it('sollte bei drei Monaten Historie nichts mehr wegen Reife vertagen', () => {
    const { postponed } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
    });
    expect(postponed).toEqual([]);
  });

  it('sollte am ganz leeren Anfang nur die Weiche und den Ausgang zeigen', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: empty,
    });
    expect(next).toContain('source');
    expect(next).not.toContain('dashboard');
    expect(next).not.toContain('city');
  });

  it('sollte die Reihenfolge in der Vertagungsliste beibehalten', () => {
    const { postponed } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: oneMonth,
    });
    expect(postponed.indexOf('income')).toBeLessThan(postponed.indexOf('contracts'));
  });
});

describe('buildCurriculum — Abweichungen je Lebenssituation', () => {
  it('sollte Schulden vorziehen, wenn es ums Schuldenabbauen geht', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'debt_focus',
      readiness: fullyReady,
    });
    expect(next.indexOf('debts')).toBeLessThan(next.indexOf('income'));
  });

  it('sollte nichts vor den Kern ziehen', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'debt_focus',
      readiness: fullyReady,
    });
    expect(next.indexOf('transactions')).toBeLessThan(next.indexOf('debts'));
    expect(next.indexOf('city')).toBeLessThan(next.indexOf('debts'));
  });

  it('sollte durch Vorziehen niemals ein Kapitel hinzufügen', () => {
    // `debt_focus` zieht `debts` vor — ohne den Bereich bleibt es trotzdem weg.
    const { next, postponed } = buildCurriculum({
      enabledFeatures: ['budgets'],
      lifeSituation: 'debt_focus',
      readiness: fullyReady,
    });
    expect([...next, ...postponed]).not.toContain('debts');
  });

  it('sollte Selbstständigen Steuer und EÜR vorziehen', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'self_employed',
      readiness: fullyReady,
    });
    expect(next.indexOf('tax')).toBeLessThan(next.indexOf('income'));
    expect(next.indexOf('euer')).toBeLessThan(next.indexOf('income'));
  });

  it('sollte ohne Lebenssituation die globale Reihenfolge lassen', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: null,
      readiness: fullyReady,
    });
    expect(next.indexOf('income')).toBeLessThan(next.indexOf('debts'));
  });
});

describe('buildCurriculum — Fortschritt', () => {
  it('sollte abgeschlossene Kapitel nicht erneut anbieten', () => {
    const { next, postponed } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
      completed: ['source', 'transactions'],
    });
    expect([...next, ...postponed]).not.toContain('source');
    expect([...next, ...postponed]).not.toContain('transactions');
    expect(next).toContain('categories');
  });

  it('sollte ein unbekanntes abgeschlossenes Kapitel ignorieren statt zu stolpern', () => {
    const { next } = buildCurriculum({
      enabledFeatures: ALL_FEATURES,
      lifeSituation: 'employed_stable',
      readiness: fullyReady,
      completed: ['gibtesnicht' as TutorialChapterId],
    });
    expect(ids(next).length).toBeGreaterThan(0);
  });
});

describe('chapterById', () => {
  it('sollte ein Kapitel liefern und bei unbekannter ID null', () => {
    expect(chapterById('city')?.id).toBe('city');
    expect(chapterById('gibtesnicht' as TutorialChapterId)).toBeNull();
  });
});

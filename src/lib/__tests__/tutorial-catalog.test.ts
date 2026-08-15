import { describe, it, expect } from 'vitest';

import { buildTutorialCatalog, nextChapterOfSection } from '../tutorial-catalog';
import { tutorialTitleKey } from '../tutorial-steps';
import { TUTORIAL_STEPS } from '../tutorial-steps';
import type { DataReadiness, TutorialChapterId } from '../tutorial-sequence';
import { translations, SUPPORTED_LOCALES } from '@/i18n/translations';

const ready: DataReadiness = {
  transactionCount: 180,
  monthsOfHistory: 6,
  categorizedMonths: 6,
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

const fresh: DataReadiness = {
  ...ready,
  transactionCount: 0,
  monthsOfHistory: 0,
  categorizedMonths: 0,
  accountCount: 0,
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

function resolve(locale: string, key: string): unknown {
  let node: unknown = (translations as Record<string, unknown>)[locale];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function section(catalog: ReturnType<typeof buildTutorialCatalog>, route: string) {
  const found = catalog.sections.find((s) => s.route === route);
  if (!found) throw new Error(`Bereich ${route} fehlt im Katalog`);
  return found;
}

describe('buildTutorialCatalog', () => {
  it('sollte die Kapitel nach dem Bereich gruppieren, in dem sie spielen', () => {
    const catalog = buildTutorialCatalog({ lifeSituation: null, readiness: ready });
    const buchungen = section(catalog, '/transactions');

    // Genau der Fall aus dem Auftrag: ein Menüpunkt, mehrere Tutorials.
    expect(buchungen.chapters.map((c) => c.id)).toEqual([
      'transactions',
      'categories',
      'transactionsFilter',
      'transactionDetails',
      'transactionSplit',
    ]);
    expect(buchungen.titleKey).toBe('nav.items.transactions');
  });

  it('sollte die Bereiche in Lehrplan-Reihenfolge führen', () => {
    const catalog = buildTutorialCatalog({ lifeSituation: null, readiness: ready });
    const routes = catalog.sections.map((s) => s.route);
    // `csv` (Kapitel 0.5, der Datei-Weg der Weiche) steht jetzt vor den
    // Buchungen — chronologisch kommt der Import zuerst.
    expect(routes[0]).toBe('/csv');
    expect(routes.indexOf('/csv')).toBeLessThan(routes.indexOf('/transactions'));
    expect(routes.indexOf('/dashboard')).toBeLessThan(routes.indexOf('/settings'));
    // Jeder Bereich steht genau einmal, auch wenn er mehrere Kapitel trägt.
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('sollte erledigte Kapitel BEHALTEN statt sie wegzulassen', () => {
    // Der Unterschied zum Lehrplan: Verschwände das Erledigte, verschwände
    // der Fortschritt in dem Moment, in dem er entsteht — und der grüne Haken
    // hätte nichts, woran er hängen könnte.
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: ready,
      completed: ['transactions'],
    });
    const buchungen = section(catalog, '/transactions');
    expect(buchungen.chapters.find((c) => c.id === 'transactions')?.state).toBe('done');
    expect(buchungen.doneCount).toBe(1);
    expect(catalog.doneCount).toBe(1);
  });

  it('sollte ein Kapitel ohne Datengrundlage als wartend führen, nicht als startbar', () => {
    const catalog = buildTutorialCatalog({ lifeSituation: null, readiness: fresh });
    const buchungen = section(catalog, '/transactions');
    expect(buchungen.chapters.every((c) => c.state === 'waiting')).toBe(true);
    // Der Abschluss braucht keine Daten und bleibt deshalb startbar.
    expect(section(catalog, '/settings').chapters[0].state).toBe('ready');
  });

  it('sollte Bereiche weglassen, die dieser Nutzer nicht gewählt hat', () => {
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: ready,
      enabledFeatures: ['budgets'],
    });
    expect(catalog.sections.some((s) => s.route === '/debts')).toBe(false);
    // Kernkapitel hängen an keiner Bereichsauswahl.
    expect(catalog.sections.some((s) => s.route === '/transactions')).toBe(true);
    expect(catalog.sections.some((s) => s.route === '/budgets')).toBe(true);
  });

  it('sollte das Kategorien-Kapitel ohne Unterkategorien weglassen', () => {
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: ready,
      subcategoriesEnabled: false,
    });
    const ids = catalog.sections.flatMap((s) => s.chapters.map((c) => c.id));
    expect(ids).not.toContain('categories');
  });

  it('sollte kein Kapitel ohne ausformulierte Schritte führen', () => {
    const catalog = buildTutorialCatalog({ lifeSituation: null, readiness: ready });
    const ids = catalog.sections.flatMap((s) => s.chapters.map((c) => c.id));
    expect(ids).not.toContain('source');
    expect(catalog.total).toBe(ids.length);
    for (const chapter of catalog.sections.flatMap((s) => s.chapters)) {
      expect(chapter.stepCount).toBeGreaterThan(0);
    }
  });
});

describe('nextChapterOfSection', () => {
  it('sollte das erste offene Kapitel des Bereichs nennen', () => {
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: ready,
      completed: ['transactions', 'categories'],
    });
    expect(nextChapterOfSection(section(catalog, '/transactions'))).toBe('transactionsFilter');
  });

  it('sollte bei durchgearbeitetem Bereich das erste Kapitel nennen, statt nichts zu tun', () => {
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: ready,
      completed: ['dashboard'],
    });
    expect(nextChapterOfSection(section(catalog, '/dashboard'))).toBe('dashboard');
  });
});

describe('Aufteilen — genau ein Eintrag, nie zwei', () => {
  it('sollte mit Zugang das vollstaendige Kapitel listen', () => {
    const catalog = buildTutorialCatalog({ lifeSituation: null, readiness: ready });
    const ids = section(catalog, '/transactions').chapters.map((c) => c.id);
    expect(ids).toContain('transactionSplit');
    expect(ids).not.toContain('transactionSplitPremium');
  });

  it('[REGRESSION] sollte ohne Zugang den Premium-Teaser listen statt zweimal „Aufteilen"', () => {
    // Beide Kapitel tragen denselben Namensschluessel. Ohne die Zusammen-
    // fassung im Katalog stuenden sie untereinander — einmal verfuegbar,
    // einmal vertagt, beide gleich beschriftet.
    const catalog = buildTutorialCatalog({
      lifeSituation: null,
      readiness: { ...ready, hasPremiumAccess: false },
    });
    const chapters = section(catalog, '/transactions').chapters;
    const ids = chapters.map((c) => c.id);
    expect(ids).toContain('transactionSplitPremium');
    expect(ids).not.toContain('transactionSplit');
    // Kein Doppel-Eintrag unter gleichem Namen.
    const titles = chapters.map((c) => c.titleKey);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('Namen der Kapitel', () => {
  it('[REGRESSION] sollte für JEDES Kapitel mit Schritten einen Namen in allen Sprachen haben', () => {
    // `t()` gibt bei unbekanntem Schlüssel den Schlüssel zurück — in der
    // Übersicht stünde dann wörtlich „tutorial.budgets.name" in der Liste,
    // ohne dass irgendetwas rot wird.
    const missing: string[] = [];
    for (const chapter of Object.keys(TUTORIAL_STEPS) as TutorialChapterId[]) {
      if ((TUTORIAL_STEPS[chapter] ?? []).length === 0) continue;
      for (const locale of SUPPORTED_LOCALES) {
        // Ueber die Titel-Abbildung, nicht ueber die Namenskonvention: Ein
        // Kapitel darf seinen Namen von woanders beziehen (`dashboard` nimmt
        // `nav.items.dashboard`), und `transactionSplitPremium` teilt ihn mit
        // dem Kapitel, das es vertritt.
        const key = tutorialTitleKey(chapter);
        if (typeof resolve(locale, key) !== 'string') missing.push(`${locale}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

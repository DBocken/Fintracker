/**
 * Zeitraum-Auswahl: Anzeigetext übersetzt, Vergleich gegen den Token.
 *
 * Zwei Befunde aus einem Blick auf das Gerät (Emulator, englische
 * Systemsprache):
 *
 * 1. **Sichtbar:** Die Auswahlliste rendert den Domänen-Token als
 *    Beschriftung. In der englischen Oberfläche stand „Gesamt" — das einzige
 *    deutsche Wort auf dem Bildschirm; dahinter „Jahr", „7 Tage",
 *    „Benutzerdefiniert".
 *
 * 2. **Unsichtbar und schlimmer:** Die Bedingung für die
 *    Benutzerdefiniert-Regler lautete
 *    `values.range === t('transactionFilters.customRange')` — ein Vergleich
 *    des TOKENS (`'Benutzerdefiniert'`) gegen den ANZEIGETEXT („Custom",
 *    „Произвольный"). Der war nur auf Deutsch wahr. Auf Englisch und
 *    Russisch erschienen Tageszahl-Regler und Granularität nach der Auswahl
 *    NIE: kein Fehler, kein leerer Zustand, nichts wurde rot — die Bedingung
 *    war schlicht immer falsch. Genau die Falle aus AGENTS.md §6 („Matching
 *    über den Anzeigenamen statt der ID").
 *
 * Der zweite Test ist deshalb der eigentliche Wächter: Er prüft die Funktion
 * in der Sprache, in der sie kaputt war.
 */

import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithI18n } from '@/test-utils/render';
import type { Account } from '@/types';
import type { FilterViewModel } from '@/features/shared/domain/filter-view-model';
import { CUSTOM_RANGE } from '@/features/shared/domain/dashboard-filters';
import { TransactionFilters } from '../TransactionFilters';

vi.mock('@/services/account-service', () => ({ getAccounts: vi.fn() }));

const noop = () => {};
const ACCOUNTS: Account[] = [];

function buildFilters(range: FilterViewModel['values']['range']): FilterViewModel {
  return {
    values: {
      category: 'all',
      account: 'all',
      contract: 'all',
      essential: 'all',
      ausgabenklasse: 'all',
      search: '',
      range,
      customDays: 30,
      customGranularity: 'daily',
      customPeriod: '',
    },
    set: {
      category: noop,
      account: noop,
      contract: noop,
      essential: noop,
      ausgabenklasse: noop,
      search: noop,
      range: noop,
      customDays: noop,
      customGranularity: noop,
      customPeriod: noop,
    },
    periodOptions: [],
    categories: [],
    accounts: ACCOUNTS,
  };
}

function renderAt(range: FilterViewModel['values']['range'], locale: 'de' | 'en') {
  return renderWithI18n(
    <TransactionFilters filters={buildFilters(range)} showSearch={false} stacked />,
    locale,
  );
}

describe('Zeitraum-Filter', () => {
  it('[REGRESSION] sollte den gewählten Zeitraum in der Anzeigesprache benennen, nicht als deutschen Token', () => {
    renderAt('Gesamt', 'en');

    // Der Trigger zeigt den gewählten Wert. Vorher stand hier „Gesamt".
    expect(screen.getByText('All time')).toBeInTheDocument();
    expect(screen.queryByText('Gesamt')).toBeNull();
  });

  it('sollte denselben Zeitraum auf Deutsch weiterhin deutsch benennen', () => {
    renderAt('Gesamt', 'de');

    expect(screen.getByText('Gesamt')).toBeInTheDocument();
  });

  it('[REGRESSION] sollte die Benutzerdefiniert-Regler AUCH auf Englisch zeigen', () => {
    // Der Kern des Befundes: Der Zustand trägt den Token, die alte Bedingung
    // verglich ihn gegen die Übersetzung — auf Englisch also nie wahr.
    renderAt(CUSTOM_RANGE, 'en');

    expect(screen.getByText('Granularity')).toBeInTheDocument();
  });

  it('sollte die Benutzerdefiniert-Regler auf Deutsch zeigen (Gegenprobe: war schon vorher richtig)', () => {
    renderAt(CUSTOM_RANGE, 'de');

    expect(screen.getByText('Granularität')).toBeInTheDocument();
  });

  it('sollte ohne Benutzerdefiniert keine Granularität anbieten', () => {
    renderAt('Monat', 'en');

    expect(screen.queryByText('Granularity')).toBeNull();
  });
});

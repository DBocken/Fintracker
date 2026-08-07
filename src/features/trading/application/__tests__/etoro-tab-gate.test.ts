import { describe, expect, it } from 'vitest';
import { etoroTabEnabled } from '../etoro-tab-gate';
import type { Portfolio } from '@/types';

/**
 * Das Gatter entscheidet, ob eine eToro-Abfrage überhaupt laufen darf. Es stand
 * zwanzigmal wörtlich in `TradingDashboard.tsx` und war dort nur über einen
 * gerenderten Screen prüfbar — für jeden der sieben Tabs einzeln.
 */
const PORTFOLIO = { id: 'p1', type: 'etoro' } as Portfolio;

const OFFEN = {
  portfolio: PORTFOLIO,
  isEtoro: true,
  unlocked: true,
  effectiveTab: 'overview',
};

describe('etoroTabEnabled', () => {
  it('sollte laufen, wenn Portfolio, Kontoart, Entsperrung und Tab stimmen', () => {
    expect(etoroTabEnabled(OFFEN, 'overview')).toBe(true);
  });

  it('sollte ohne gewähltes Portfolio nicht laufen', () => {
    expect(etoroTabEnabled({ ...OFFEN, portfolio: null }, 'overview')).toBe(false);
  });

  it('sollte für ein Nicht-eToro-Depot nicht laufen', () => {
    expect(etoroTabEnabled({ ...OFFEN, isEtoro: false }, 'overview')).toBe(false);
  });

  it('sollte bei gesperrter lokaler Verschlüsselung nicht laufen', () => {
    // Die Zugangsdaten liegen verschlüsselt; ohne Entsperrung gäbe es nichts
    // zu senden — die Abfrage würde nur das Rate-Limit verbrauchen.
    expect(etoroTabEnabled({ ...OFFEN, unlocked: false }, 'overview')).toBe(false);
  });

  it('sollte auf einem anderen Tab nicht laufen', () => {
    expect(etoroTabEnabled({ ...OFFEN, effectiveTab: 'news' }, 'overview')).toBe(false);
  });

  it('sollte für mehrere zuständige Tabs laufen', () => {
    // Der Konto-Snapshot wird von Übersicht, Smart Portfolios UND Analyse
    // gebraucht — deshalb nimmt das Gatter eine Liste.
    const tabs = ['overview', 'mirrors', 'analysis'] as const;
    expect(etoroTabEnabled({ ...OFFEN, effectiveTab: 'mirrors' }, tabs)).toBe(true);
    expect(etoroTabEnabled({ ...OFFEN, effectiveTab: 'analysis' }, tabs)).toBe(true);
    expect(etoroTabEnabled({ ...OFFEN, effectiveTab: 'history' }, tabs)).toBe(false);
  });
});

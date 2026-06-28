import { describe, it, expect } from 'vitest';
import type { ForecastAccount, RecurringFlow } from '@/lib/forecast-types';
import { computeDisposableUntilPayday, computeOperatingCash } from '@/lib/disposable-budget';

function account(partial: Partial<ForecastAccount> & { id: string; kind: ForecastAccount['kind']; openingBalance: number }): ForecastAccount {
  return { name: partial.name ?? partial.id, ...partial };
}

function flow(partial: Partial<RecurringFlow> & { id: string; amount: number; anchorDate: string }): RecurringFlow {
  return {
    name: partial.name ?? partial.id,
    cadence: partial.cadence ?? 'monthly',
    accountId: partial.accountId ?? 'acc-giro',
    ...partial,
  };
}

const GIRO = account({ id: 'giro', kind: 'checking', openingBalance: 1000 });
const SPAREN = account({ id: 'spar', kind: 'savings', openingBalance: 5000 });

describe('disposable-budget', () => {
  describe('computeOperatingCash', () => {
    it('sollte nur operative Konten (Giro/Bar/Wallet) summieren – Sparen/Depot zählen nicht', () => {
      const accounts = [
        GIRO, // 1000
        account({ id: 'bar', kind: 'cash', openingBalance: 50 }),
        account({ id: 'wallet', kind: 'wallet', openingBalance: 20 }),
        SPAREN, // 5000, ausgeschlossen
        account({ id: 'depot', kind: 'investment', openingBalance: 9000 }), // ausgeschlossen
      ];
      expect(computeOperatingCash(accounts)).toBe(1070);
    });
  });

  describe('computeDisposableUntilPayday – Normalverhalten', () => {
    const flows = [
      flow({ id: 'miete', amount: -600, anchorDate: '2026-06-10' }),
      flow({ id: 'internet', amount: -30, anchorDate: '2026-06-20' }),
      flow({ id: 'gehalt', amount: 2000, anchorDate: '2026-06-30' }), // Eingang, KEINE Pflicht
    ];

    it('sollte verfügbar = Guthaben − Pflicht-Abbuchungen bis zum Gehalt berechnen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [GIRO, SPAREN],
        recurringFlows: flows,
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.operatingCash).toBe(1000); // Sparen ausgeschlossen
      expect(r.obligations).toBe(630); // 600 + 30; Gehalt zählt nicht
      expect(r.obligationCount).toBe(2);
      expect(r.disposable).toBe(370);
      expect(r.fillPercent).toBe(63); // 630/1000
      expect(r.health).toBe('ok'); // 63 % < 80 %
    });

    it('sollte bei hoher Belegung (>= Warnschwelle) auf warn schalten', () => {
      const r = computeDisposableUntilPayday({
        accounts: [account({ id: 'giro', kind: 'checking', openingBalance: 1000 })],
        recurringFlows: [flow({ id: 'rate', amount: -850, anchorDate: '2026-06-10' })],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.fillPercent).toBe(85);
      expect(r.health).toBe('warn');
    });

    it('sollte bei Pflichten über Guthaben auf over schalten und negativ verfügbar ausweisen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [account({ id: 'giro', kind: 'checking', openingBalance: 1000 })],
        recurringFlows: [flow({ id: 'gross', amount: -1100, anchorDate: '2026-06-10' })],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.disposable).toBe(-100);
      expect(r.fillPercent).toBe(100); // gekappt
      expect(r.health).toBe('over');
    });
  });

  describe('computeDisposableUntilPayday – Edge Cases', () => {
    it('sollte ohne Guthaben (0 €) und mit anstehenden Pflichten over + vollen Tank zeigen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [account({ id: 'giro', kind: 'checking', openingBalance: 0 })],
        recurringFlows: [flow({ id: 'abo', amount: -20, anchorDate: '2026-06-10' })],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.disposable).toBe(-20);
      expect(r.fillPercent).toBe(100);
      expect(r.health).toBe('over');
    });

    it('sollte ohne anstehende Pflichten einen leeren Tank (ok) und volles Guthaben verfügbar zeigen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [account({ id: 'giro', kind: 'checking', openingBalance: 800 })],
        recurringFlows: [],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.obligations).toBe(0);
      expect(r.disposable).toBe(800);
      expect(r.fillPercent).toBe(0);
      expect(r.health).toBe('ok');
    });
  });

  describe('computeDisposableUntilPayday – Regression', () => {
    it('[REGRESSION] sollte Spar-/Depotguthaben NICHT als verfügbares Geld zählen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [
          account({ id: 'giro', kind: 'checking', openingBalance: 200 }),
          account({ id: 'spar', kind: 'savings', openingBalance: 10000 }),
        ],
        recurringFlows: [flow({ id: 'miete', amount: -500, anchorDate: '2026-06-10' })],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      // Trotz 10.000 € Sparbuch ist operativ nur 200 € da → Minus vor dem Gehalt.
      expect(r.operatingCash).toBe(200);
      expect(r.disposable).toBe(-300);
      expect(r.health).toBe('over');
    });

    it('[REGRESSION] sollte einen Geldeingang im Fenster nicht als Pflicht-Abbuchung verbuchen', () => {
      const r = computeDisposableUntilPayday({
        accounts: [account({ id: 'giro', kind: 'checking', openingBalance: 1000 })],
        recurringFlows: [
          flow({ id: 'bonus', amount: 300, anchorDate: '2026-06-15' }), // Eingang im Fenster
          flow({ id: 'miete', amount: -600, anchorDate: '2026-06-10' }),
        ],
        fromISO: '2026-06-01',
        paydayISO: '2026-06-30',
        daysUntilPayday: 29,
      });
      expect(r.obligations).toBe(600); // nur die Miete
      expect(r.disposable).toBe(400);
    });
  });
});

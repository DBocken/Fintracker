import { describe, it, expect } from 'vitest';
import { analyzeFile, resolveTarget, isTestFile } from '../layers-core.mjs';

/**
 * Wächter-Test für den Schicht-Wächter (AGENTS.md §3).
 *
 * Der Wächter selbst wäre sonst die einzige Regel im Repo, die niemand prüft —
 * und ein Wächter, der still nichts mehr findet, ist schlimmer als keiner: er
 * erzeugt den Eindruck, die Richtung stimme.
 */
describe('Schicht-Wächter', () => {
  describe('Erlaubte Richtungen', () => {
    it('sollte einen Service durchlassen, der lib benutzt', () => {
      const src = `import { toMinor } from '@/lib/money';`;
      expect(analyzeFile('src/services/tax-service.ts', src).violations).toEqual([]);
    });

    it('sollte eine Komponente durchlassen, die Service und lib benutzt', () => {
      const src = `import { getAccounts } from '@/services/account-service';\nimport { toMinor } from '@/lib/money';`;
      expect(analyzeFile('src/components/Foo.tsx', src).violations).toEqual([]);
    });

    it('sollte einem Service die reine domain eines Slices erlauben', () => {
      // Feature-`domain` ist selbst Fachlogik und liegt auf der Höhe von lib.
      const src = `import { getSubtreeIds } from '@/features/special-categories/domain/hierarchy';`;
      expect(analyzeFile('src/services/special-category-service.ts', src).violations).toEqual([]);
    });

    it('sollte externe Pakete ignorieren', () => {
      const src = `import { format } from 'date-fns';\nimport React from 'react';`;
      expect(analyzeFile('src/lib/forecast.ts', src).violations).toEqual([]);
    });

    it('sollte Tests ausnehmen — ein lib-Test darf einen Service heranziehen', () => {
      const src = `import { getAccounts } from '@/services/account-service';`;
      expect(analyzeFile('src/lib/__tests__/forecast.test.ts', src).violations).toEqual([]);
    });
  });

  describe('ViewModel kennt die Darstellung nicht', () => {
    // Der eigentliche Zweck der Trennung: Wenn spaeter eine andere
    // Praesentation danebengestellt wird (Android, anderer Shell), muss das
    // ViewModel unveraendert weiterlaufen. Ein Import nach `components/`
    // macht das unmoeglich — die alte Oberflaeche muesste mitgeschleppt
    // werden, sei es auch nur fuer einen Typ.
    it('[REGRESSION] sollte einen Typ-Import des ViewModels aus components/ melden', () => {
      // Genau das stand in `features/trading/application/use-etoro-account.ts`:
      // zwei Zustandstypen kamen aus zwei React-Komponentendateien. Der
      // Waechter hat geschwiegen, weil seine Regel nur `features/*/presentation`
      // kannte — der Weg nach `src/components/` stand offen.
      const src = `import type { EtoroNewsFilter } from '@/components/trading/EtoroNewsTab';`;
      const { violations } = analyzeFile('src/features/trading/application/use-etoro-account.ts', src);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('feature-application-ohne-ui');
    });

    it('[REGRESSION] sollte auch eine reine Funktion aus components/ melden', () => {
      const src = `import { filterTransactions } from '@/components/dashboard/filter-utils';`;
      expect(analyzeFile('src/features/dashboard/application/use-finance-overview.ts', src).violations)
        .toHaveLength(1);
    });

    it('sollte eine Seite (pages/) genauso verbieten', () => {
      const src = `import { Foo } from '@/pages/TransactionsPage';`;
      expect(analyzeFile('src/features/x/application/use-x.ts', src).violations).toHaveLength(1);
    });

    it('sollte dem ViewModel lib, services und die eigene domain weiter erlauben', () => {
      const src = [
        `import { toMinor } from '@/lib/money';`,
        `import { getAccounts } from '@/services/account-service';`,
        `import type { PeriodOption } from '@/features/shared/domain/period-options';`,
        `import { useQuery } from '@tanstack/react-query';`,
      ].join('\n');
      expect(analyzeFile('src/features/dashboard/application/use-finance-overview.ts', src).violations)
        .toEqual([]);
    });

    it('sollte einen React-Context-Hook aus hooks/ erlauben', () => {
      // `hooks -> components` bleibt bewusst ungeprueft (AGENTS.md §3): Ein
      // Hook, der einen Context liest, ist die uebliche Bauform. Liegt er in
      // `src/hooks/`, ist er fuer das ViewModel erreichbar, ohne dass eine
      // Komponentendatei im Spiel ist.
      const src = `import { useLocalEncryption } from '@/hooks/useLocalEncryption';`;
      expect(analyzeFile('src/features/trading/application/use-etoro-account.ts', src).violations)
        .toEqual([]);
    });
  });

  describe('Verstöße', () => {
    it('[REGRESSION] sollte lib → services melden (30 solcher Zeilen lagen unbemerkt im Baum)', () => {
      const src = `import { getAccounts } from '@/services/account-service';`;
      const { violations } = analyzeFile('src/lib/forecast-data.ts', src);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('lib-rein');
    });

    it('[REGRESSION] sollte lib → components auch bei doppelten Anführungszeichen melden', () => {
      // Der erste Handzähl-Versuch hat nur einfache Anführungszeichen gegriffen
      // und deshalb 13 von 30 Verstößen übersehen.
      const src = `import type { ContractRow } from "@/components/contracts/contract-types";`;
      const { violations } = analyzeFile('src/lib/contract-derivation.ts', src);
      expect(violations).toHaveLength(1);
    });

    it('sollte Relativpfade genauso auflösen wie @/-Aliase', () => {
      const src = `import { getAccounts } from '../services/account-service';`;
      const { violations } = analyzeFile('src/lib/forecast-data.ts', src);
      expect(violations).toHaveLength(1);
      expect(violations[0].target).toBe('src/services/account-service');
    });

    it('sollte reine Typ-Importe genauso werten wie Wert-Importe', () => {
      const src = `import type { MerchantRule } from '@/services/merchant-rules-service';`;
      expect(analyzeFile('src/lib/review-preview.ts', src).violations).toHaveLength(1);
    });

    it('sollte re-exportierende Importe erfassen', () => {
      const src = `export type { MerchantRule } from '@/services/merchant-rules-service';`;
      expect(analyzeFile('src/lib/review-preview.ts', src).violations).toHaveLength(1);
    });

    it('sollte dynamische Importe erfassen', () => {
      const src = `const m = await import('@/services/account-service');`;
      expect(analyzeFile('src/lib/forecast-data.ts', src).violations).toHaveLength(1);
    });

    it('sollte services → components melden', () => {
      const src = `import type { X } from '@/components/dashboard/filter-utils';`;
      const { violations } = analyzeFile('src/services/foo-service.ts', src);
      expect(violations[0].ruleId).toBe('services-ohne-ui');
    });

    it('sollte feature-domain → services melden', () => {
      const src = `import type { MilestoneStatus } from '@/services/milestones-service';`;
      const { violations } = analyzeFile('src/features/finance-city/domain/city-goals-adapter.ts', src);
      expect(violations[0].ruleId).toBe('feature-domain-rein');
    });

    it('sollte domain → presentation innerhalb desselben Slices melden', () => {
      const src = `import { CityCanvas } from '../presentation/CityCanvas';`;
      const { violations } = analyzeFile('src/features/finance-city/domain/city-layout.ts', src);
      expect(violations[0].ruleId).toBe('feature-domain-rein');
    });

    it('sollte application → presentation melden', () => {
      const src = `import { View } from '../presentation/View';`;
      const { violations } = analyzeFile('src/features/dashboard/application/use-finance-overview.ts', src);
      expect(violations[0].ruleId).toBe('feature-application-ohne-presentation');
    });

    it('sollte components → pages melden', () => {
      const src = `import { DebtsPage } from '@/pages/DebtsPage';`;
      const { violations } = analyzeFile('src/components/debts/Foo.tsx', src);
      expect(violations[0].ruleId).toBe('components-ohne-pages');
    });
  });

  describe('Kommentare', () => {
    it('sollte einen Beispiel-Import im Blockkommentar nicht werten', () => {
      const src = `/**\n * Früher stand hier: import { x } from '@/services/foo';\n */\nexport const a = 1;`;
      expect(analyzeFile('src/lib/a.ts', src).violations).toEqual([]);
    });

    it('sollte einen auskommentierten Import nicht werten', () => {
      const src = `// import { x } from '@/services/foo';`;
      expect(analyzeFile('src/lib/a.ts', src).violations).toEqual([]);
    });
  });

  describe('Ausnahmeliste', () => {
    it('sollte einen begründeten Eintrag durchlassen und ihn als benutzt melden', () => {
      const src = `import { getAccounts } from '@/services/account-service';`;
      const entry = { imports: ['@/services/account-service'], reason: 'Testfall' };
      const { violations, usedExceptions } = analyzeFile('src/lib/a.ts', src, entry);
      expect(violations).toEqual([]);
      expect(usedExceptions).toEqual(['@/services/account-service']);
    });

    it('sollte nur den genannten Import decken, nicht die ganze Datei', () => {
      const src = `import { getAccounts } from '@/services/account-service';\nimport { getDebts } from '@/services/debt-service';`;
      const entry = { imports: ['@/services/account-service'], reason: 'Testfall' };
      const { violations } = analyzeFile('src/lib/a.ts', src, entry);
      expect(violations.map((v) => v.spec)).toEqual(['@/services/debt-service']);
    });
  });

  describe('Hilfsfunktionen', () => {
    it('sollte @/-Aliase auf src/ abbilden', () => {
      expect(resolveTarget('@/lib/money', 'src/services/a.ts')).toBe('src/lib/money');
    });

    it('sollte Relativpfade gegen die Quelldatei auflösen', () => {
      expect(resolveTarget('./b', 'src/lib/a.ts')).toBe('src/lib/b');
      expect(resolveTarget('../services/b', 'src/lib/a.ts')).toBe('src/services/b');
    });

    it('sollte externe Pakete als null melden', () => {
      expect(resolveTarget('date-fns', 'src/lib/a.ts')).toBeNull();
      expect(resolveTarget('react', 'src/lib/a.ts')).toBeNull();
    });

    it('sollte Testpfade erkennen', () => {
      expect(isTestFile('src/lib/__tests__/a.test.ts')).toBe(true);
      expect(isTestFile('src/test-utils/render.tsx')).toBe(true);
      expect(isTestFile('src/lib/a.ts')).toBe(false);
    });
  });
});

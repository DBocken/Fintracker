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

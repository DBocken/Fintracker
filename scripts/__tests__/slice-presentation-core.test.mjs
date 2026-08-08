import { describe, it, expect } from 'vitest';
import { istSlicePresentation, countLegacyImports } from '../slice-presentation-core.mjs';

/**
 * Wächter-Test für die Slice-Presentation-Ratsche (AGENTS.md §3, ARCH-3,
 * WP 2.3).
 *
 * Zählt sie falsch, zeigt die Ratsche einen Fortschritt, den es nicht gibt —
 * das ist schlimmer als gar keine Zahl, weil niemand mehr nachsieht
 * (dieselbe Begründung wie bei `view-data-core.test.mjs`).
 */
describe('istSlicePresentation', () => {
  it('sollte presentation/-Dateien aller Slices erfassen', () => {
    expect(istSlicePresentation('src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx')).toBe(true);
    expect(istSlicePresentation('src/features/trading/presentation/TradingView.tsx')).toBe(true);
  });

  it('sollte domain/data/application NICHT erfassen — dort ist die Richtung eine andere Regel', () => {
    expect(istSlicePresentation('src/features/dashboard/application/use-finance-overview.ts')).toBe(false);
    expect(istSlicePresentation('src/features/dashboard/domain/filters.ts')).toBe(false);
    expect(istSlicePresentation('src/features/dashboard/data/dashboard-repository.ts')).toBe(false);
  });

  it('sollte components/ und pages/ selbst nicht erfassen', () => {
    expect(istSlicePresentation('src/components/dashboard/TransactionCharts.tsx')).toBe(false);
    expect(istSlicePresentation('src/pages/DebtsPage.tsx')).toBe(false);
  });
});

describe('countLegacyImports', () => {
  describe('zählt Importe aus der Alt-Oberfläche', () => {
    it('[REGRESSION] sollte den TransactionCharts-Import der Dashboard-Slice zählen (ARCH-3)', () => {
      // Genau der Fund aus dem Audit: DashboardDesktopView.tsx importiert aus
      // src/components/dashboard/TransactionCharts.tsx (564 Zeilen) — der
      // Referenz-Slice leckt in die Alt-Komponenten.
      const src = `import { SpendingBreakdownCard, ExpensesOverTimeCard } from '@/components/dashboard/TransactionCharts';`;
      const result = countLegacyImports(
        'src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx',
        src,
      );
      expect(result.imports).toBe(1);
      expect(result.specs).toEqual(['@/components/dashboard/TransactionCharts']);
    });

    it('sollte mehrere Importe derselben Datei einzeln zählen', () => {
      const src = [
        `import { AdvancedBalanceChart } from '@/components/AdvancedBalanceChart';`,
        `import { AccountCards } from '@/components/accounts/AccountCards';`,
        `import { SankeyChart } from '@/components/premium-dashboard/SankeyChart';`,
      ].join('\n');
      const result = countLegacyImports('src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx', src);
      expect(result.imports).toBe(3);
    });

    it('sollte einen pages/-Import genauso zählen wie components/', () => {
      const src = `import { DebtsPage } from '@/pages/DebtsPage';`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(1);
    });

    it('sollte Relativpfade genauso auflösen wie @/-Aliase', () => {
      // 'src/features/special-categories/presentation' + drei '../' landet
      // bei 'src' — von dort führt 'components/ui/button' nach
      // 'src/components/ui/button'.
      const src = `import { Button } from '../../../components/ui/button';`;
      const result = countLegacyImports('src/features/special-categories/presentation/View.tsx', src);
      expect(result.imports).toBe(1);
    });

    it('sollte reine Typ-Importe genauso zählen wie Wert-Importe', () => {
      const src = `import type { X } from '@/components/dashboard/filter-utils';`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(1);
    });
  });

  describe('Kein Fehlalarm', () => {
    it('sollte eine Datei außerhalb von presentation/ nicht zählen (application darf laut check:layers ohnehin nicht)', () => {
      const src = `import { Button } from '@/components/ui/button';`;
      expect(countLegacyImports('src/features/dashboard/application/use-finance-overview.ts', src).imports).toBe(0);
    });

    it('sollte lib- und service-Importe nicht zählen — nur components/ und pages/ sind die Alt-Oberfläche', () => {
      const src = [
        `import { toMinor } from '@/lib/money';`,
        `import { getAccounts } from '@/services/account-service';`,
      ].join('\n');
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(0);
    });

    it('sollte einen Import aus derselben oder einer anderen Slice-Schicht nicht zählen', () => {
      const src = [
        `import { useFinanceOverview } from '../application/use-finance-overview';`,
        `import type { DashboardFilterState } from '@/features/shared/domain/filters';`,
      ].join('\n');
      expect(countLegacyImports('src/features/dashboard/presentation/desktop/View.tsx', src).imports).toBe(0);
    });

    it('sollte externe Pakete ignorieren', () => {
      const src = `import { format } from 'date-fns';\nimport React from 'react';`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(0);
    });

    it('sollte einen auskommentierten Import nicht zählen', () => {
      const src = `// import { Button } from '@/components/ui/button';`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(0);
    });

    it('sollte einen Beispiel-Import im Blockkommentar nicht zählen', () => {
      const src = `/**\n * Frueher: import { X } from '@/components/dashboard/X';\n */\nexport const a = 1;`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(0);
    });

    it('sollte einen Test unter presentation/__tests__ nicht zählen — Tests sind ausgenommen', () => {
      const src = `import { Button } from '@/components/ui/button';`;
      expect(
        countLegacyImports('src/features/dashboard/presentation/__tests__/View.test.tsx', src).imports,
      ).toBe(0);
    });
  });
});

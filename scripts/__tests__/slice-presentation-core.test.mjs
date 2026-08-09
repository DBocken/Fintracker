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
      // bei 'src' — von dort führt 'components/dashboard/TransactionStats' nach
      // 'src/components/dashboard/TransactionStats'.
      const src = `import TransactionStats from '../../../components/dashboard/TransactionStats';`;
      const result = countLegacyImports('src/features/special-categories/presentation/View.tsx', src);
      expect(result.imports).toBe(1);
    });

    it('sollte reine Typ-Importe genauso zählen wie Wert-Importe', () => {
      const src = `import type { X } from '@/components/dashboard/filter-utils';`;
      expect(countLegacyImports('src/features/x/presentation/A.tsx', src).imports).toBe(1);
    });
  });

  describe('app-eigene Bausteine (components/common/) — eigene Spalte seit WP 6.3', () => {
    it('sollte einen Baustein-Import in `bausteine` zählen, NICHT in `imports`', () => {
      const src = `import { ChartFigure } from '@/components/common/ChartFigure';`;
      const result = countLegacyImports('src/features/dashboard/presentation/shared/TransactionCharts.tsx', src);
      expect(result.imports).toBe(0);
      expect(result.specs).toEqual([]);
      expect(result.bausteine).toBe(1);
      expect(result.bausteinSpecs).toEqual(['@/components/common/ChartFigure']);
    });

    it('sollte einen Baustein auch über einen Relativpfad erkennen', () => {
      const src = `import { InteractiveCard } from '../../../components/common/InteractiveCard';`;
      const result = countLegacyImports('src/features/special-categories/presentation/View.tsx', src);
      expect(result.imports).toBe(0);
      expect(result.bausteine).toBe(1);
    });

    it('[REGRESSION] sollte Bausteine und fremde Feature-UI in derselben Datei getrennt ausweisen (WP 6.3)', () => {
      // Genau der Fund aus WP 6.3: Die Migration von TradingDashboard haette
      // die EINE Zahl von 17 auf 48 getrieben — 12 fremde Feature-UI und 36
      // Bausteine, die AGENTS.md §8/§9 sogar VORSCHREIBT. Zwei Befunde mit
      // zwei verschiedenen Antworten (Screen migrieren vs. components/common
      // nach features/shared/presentation heben) gehoeren in zwei Zahlen.
      const src = [
        `import { SankeyChart } from '@/components/premium-dashboard/SankeyChart';`,
        `import { InfoStatStrip } from '@/components/common/InfoGroup';`,
        `import { DecimalInput } from '@/components/common/DecimalInput';`,
        `import { Button } from '@/components/ui/button';`,
      ].join('\n');
      const result = countLegacyImports('src/features/trading/presentation/tabs/T.tsx', src);
      expect(result.imports).toBe(1);
      expect(result.specs).toEqual(['@/components/premium-dashboard/SankeyChart']);
      expect(result.bausteine).toBe(2);
      expect(result.bausteinSpecs).toEqual([
        '@/components/common/InfoGroup',
        '@/components/common/DecimalInput',
      ]);
    });

    it('sollte in einem Test unter presentation/__tests__ auch keine Bausteine zählen', () => {
      const src = `import { InteractiveCard } from '@/components/common/InteractiveCard';`;
      const result = countLegacyImports('src/features/x/presentation/__tests__/A.test.tsx', src);
      expect(result.imports).toBe(0);
      expect(result.bausteine).toBe(0);
    });

  });

  describe('Kein Fehlalarm', () => {
    it('[REGRESSION] sollte shadcn-Primitive unter components/ui/ NICHT zählen (WP 6.2)', () => {
      // Die Migration von TransactionCharts loeste zwei gezaehlte Importe auf
      // und brachte als Slice-Datei `ui/card` + `ui/switch` mit — unterm
      // Strich waere die Ratsche von 24 auf 25 GESTIEGEN. AGENTS.md §7 nennt
      // shadcn/`@/components/ui` als ausschliessliche UI-Quelle: eine zweite
      // Praesentation benutzt dieselben Primitive, sie sind nicht die
      // Alt-Oberflaeche.
      const src = [
        `import { Card, CardHeader } from '@/components/ui/card';`,
        `import { Switch } from '@/components/ui/switch';`,
        `import { Button } from '../../../../components/ui/button';`,
      ].join('\n');
      const result = countLegacyImports('src/features/dashboard/presentation/shared/TransactionCharts.tsx', src);
      expect(result.imports).toBe(0);
      expect(result.specs).toEqual([]);
    });

    it('sollte eine Datei außerhalb von presentation/ nicht zählen (application darf laut check:layers ohnehin nicht)', () => {
      // Bewusst KEIN `ui/`-Import: der zaehlt seit WP 6.2 nirgends, der Test
      // wuerde sonst auch bei kaputtem `istSlicePresentation` gruen bleiben.
      const src = `import { AccountCards } from '@/components/accounts/AccountCards';`;
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
      // Bewusst KEIN `ui/`-Import (siehe oben) — sonst prueft der Test nichts.
      const src = `import { AccountCards } from '@/components/accounts/AccountCards';`;
      expect(
        countLegacyImports('src/features/dashboard/presentation/__tests__/View.test.tsx', src).imports,
      ).toBe(0);
    });
  });
});

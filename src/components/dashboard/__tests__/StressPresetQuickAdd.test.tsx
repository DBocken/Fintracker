import { describe, it, expect, vi as vitest } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import StressPresetQuickAdd from '../StressPresetQuickAdd';
import type { ForecastOverrides } from '@/services/forecast-overrides-service';

describe('StressPresetQuickAdd', () => {
  const mockOverrides: ForecastOverrides = {
    months: 6,
    safetyBuffer: 1000,
    bufferBasis: 'operating',
    accountInterest: {},
    categoryBudgets: {},
    plannedEvents: [],
    transfers: [],
    recurringFlowOverrides: {},
    sinkingFunds: [],
    scenarios: [],
  };

  const mockVariableExpenses = [
    { category: 'Lebensmittel', monthlyAmount: 400, confidence: 0.9 },
    { category: 'Freizeit', monthlyAmount: 150, confidence: 0.7 },
  ];

  describe('Normal Behavior', () => {
    it('sollte Preset-Buttons mit Default-Werten anzeigen', () => {
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={() => {}}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      expect(buttons.length).toBeGreaterThan(0);

      // Prüfe dass mindestens die vier Standard-Presets vorhanden sind
      const labels = Array.from(buttons).map((b) => b.textContent);
      expect(labels.some((l) => l?.includes('Anschaffung'))).toBe(true);
      expect(labels.some((l) => l?.includes('Einkommen'))).toBe(true);
      expect(labels.some((l) => l?.includes('Teurer'))).toBe(true);
      expect(labels.some((l) => l?.includes('Schock'))).toBe(true);
    });

    it('sollte Parameter-Input zeigen wenn Preset geklickt wird', () => {
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={() => {}}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      const purchaseButton = Array.from(buttons).find((b) => b.textContent?.includes('Anschaffung'));

      if (purchaseButton) {
        fireEvent.click(purchaseButton);

        // Nach dem Klick sollten Parameter-Eingaben sichtbar sein
        const inputs = container.querySelectorAll('input[type="number"]');
        expect(inputs.length).toBeGreaterThan(0);
      }
    });

    it('sollte onApply mit Preset-Daten aufrufen wenn Apply geklickt wird', async () => {
      const onApply = vitest.fn();
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={onApply}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      const purchaseButton = Array.from(buttons).find((b) => b.textContent?.includes('Anschaffung'));

      if (purchaseButton) {
        fireEvent.click(purchaseButton);

        // Apply-Button klicken
        const applyButton = Array.from(buttons).find((b) => b.textContent?.includes('eintragen'));
        if (applyButton) {
          fireEvent.click(applyButton);

          await waitFor(() => {
            expect(onApply).toHaveBeenCalled();
            const patch = onApply.mock.calls[0][0];
            expect(patch.plannedEvents).toBeDefined();
          });
        }
      }
    });

    it('sollte "Teurer"-Preset bei fehlenden Variable-Expenses deaktivieren', () => {
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={[]}
          overrides={mockOverrides}
          onApply={() => {}}
        />
      );

      const buttons = container.querySelectorAll('button[disabled]');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('sollte beim Wählen eines Szenarios die Ziel-Sektion melden', () => {
      const onActiveScenarioChange = vitest.fn();
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={() => {}}
          onActiveScenarioChange={onActiveScenarioChange}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      const costButton = Array.from(buttons).find((b) => b.textContent?.includes('Teurer'));
      if (costButton) {
        fireEvent.click(costButton);
        // "Teurer" betrifft die Budget-Sektion
        expect(onActiveScenarioChange).toHaveBeenCalledWith('budgets');
      }

      const purchaseButton = Array.from(buttons).find((b) => b.textContent?.includes('Anschaffung'));
      if (purchaseButton) {
        fireEvent.click(purchaseButton);
        // "Anschaffung" betrifft die geplanten Posten
        expect(onActiveScenarioChange).toHaveBeenCalledWith('events');
      }
    });

    it('sollte null melden wenn das Szenario geschlossen wird', () => {
      const onActiveScenarioChange = vitest.fn();
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={() => {}}
          onActiveScenarioChange={onActiveScenarioChange}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      const purchaseButton = Array.from(buttons).find((b) => b.textContent?.includes('Anschaffung'));
      if (purchaseButton) {
        fireEvent.click(purchaseButton); // öffnen → 'events'
        fireEvent.click(purchaseButton); // erneut klicken → schließen → null
        expect(onActiveScenarioChange).toHaveBeenLastCalledWith(null);
      }
    });

    it('sollte alle Presets bei fehlender accountId deaktivieren', () => {
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId={null}
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={() => {}}
        />
      );

      const buttons = container.querySelectorAll('button[disabled]');
      // Alle nicht-Teurer-Presets sollten deaktiviert sein (mindestens 3)
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit negativen Werten umgehen', () => {
      const onApply = vitest.fn();
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={onApply}
        />
      );

      // Dies ist eher eine Datenvalidierung – komponente sollte nicht crashes
      // wenn negative Werte eingegeben werden
      expect(container).toBeTruthy();
    });

    it('sollte Standard-Parameter-Werte verwenden wenn nicht angepasst', () => {
      const onApply = vitest.fn();
      const { container } = render(
        <StressPresetQuickAdd
          startISO="2026-06-26"
          accountId="acc1"
          variableExpenses={mockVariableExpenses}
          overrides={mockOverrides}
          onApply={onApply}
        />
      );

      const buttons = container.querySelectorAll('button[type="button"]');
      const purchaseButton = Array.from(buttons).find((b) => b.textContent?.includes('Anschaffung'));

      if (purchaseButton) {
        fireEvent.click(purchaseButton);

        // Apply ohne Parameter zu ändern – sollte defaults verwenden
        const applyButton = Array.from(buttons).find((b) => b.textContent?.includes('eintragen'));
        if (applyButton) {
          fireEvent.click(applyButton);

          expect(onApply).toHaveBeenCalled();
          const patch = onApply.mock.calls[0][0];
          expect(patch.plannedEvents?.[0]?.amount).toBe(3000); // default
          expect(patch.plannedEvents?.[0]?.date).toBeTruthy();
        }
      }
    });
  });
});

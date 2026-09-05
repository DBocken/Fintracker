import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { onboardingFeatureCatalog } from '@/components/layout/nav-config';
import FeaturesStep from '../steps/FeaturesStep';

const catalog = onboardingFeatureCatalog();
const noop = vi.fn();

function renderStep(overrides: Partial<Parameters<typeof FeaturesStep>[0]> = {}) {
  return renderWithProviders(
    <FeaturesStep
      catalog={catalog}
      selected={['debts', 'budgets']}
      onToggle={noop}
      onContinue={noop}
      onBack={noop}
      {...overrides}
    />,
  );
}

describe('FeaturesStep', () => {
  it('sollte zuerst das Ergebnis zeigen, nicht die Schalter', () => {
    // „Premature configuration": Einstellungen abfragen, bevor der Nutzer
    // weiss, wofür sie gut sind. Zuerst die Aussage.
    renderStep();
    expect(screen.getByText('Das blenden wir für dich ein')).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('sollte die gewählten Bereiche beim Namen nennen', () => {
    renderStep();
    expect(screen.getByText('Schulden')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
  });

  it('sollte die Schalter erst auf Wunsch öffnen', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole('button', { name: /Bereiche anpassen/ }));
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
  });

  it('sollte die Anpassung wieder schließen können', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole('button', { name: /Bereiche anpassen/ }));
    await user.click(screen.getByRole('button', { name: /Fertig/ }));
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('sollte weiterführen', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    renderStep({ onContinue });
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('sollte auf Englisch dieselbe Aussage zuerst zeigen', () => {
    renderWithProviders(
      <FeaturesStep
        catalog={catalog}
        selected={['debts']}
        onToggle={noop}
        onContinue={noop}
        onBack={noop}
      />,
      { locale: 'en' },
    );
    expect(screen.getByText('This is what we will show you')).toBeInTheDocument();
  });
});

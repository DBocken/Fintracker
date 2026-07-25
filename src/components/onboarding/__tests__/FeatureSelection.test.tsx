import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import { findFeatureSwitch } from '@/test-utils/feature-switch';
import FeatureSelection from '../FeatureSelection';
import { NAV_FEATURE_PATHS, type NavFeatureId } from '@/lib/life-situations';

const ALL = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

describe('FeatureSelection', () => {
  it('sollte jeden wählbaren Bereich als Schalter anbieten', () => {
    renderWithProviders(<FeatureSelection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getAllByRole('switch')).toHaveLength(ALL.length);
  });

  it('sollte die vorausgewählten Bereiche eingeschaltet zeigen', async () => {
    renderWithProviders(<FeatureSelection selected={['budgets']} onToggle={vi.fn()} />);
    expect(await findFeatureSwitch('budgets')).toBeChecked();
    expect(await findFeatureSwitch('trading')).not.toBeChecked();
  });

  it('sollte einen Bereich umschalten können', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderWithProviders(<FeatureSelection selected={[]} onToggle={onToggle} />);
    await user.click(await findFeatureSwitch('trading'));
    expect(onToggle).toHaveBeenCalledWith('trading');
  });

  it('sollte die Kernbereiche als immer sichtbar ausweisen, aber nicht als Schalter', () => {
    renderWithProviders(<FeatureSelection selected={ALL} onToggle={vi.fn()} />);
    // Kernbereiche erscheinen als Aufzählung, nicht als abwählbarer Schalter.
    expect(screen.getByText('Immer dabei')).toBeInTheDocument();
    // Ueber die Feature-Ids statt ueber Beschriftungen: eine Negativ-Aussage
    // gegen ein sichtbares Label („kein Schalter namens Buchungen") wuerde
    // nach jeder Umbenennung still weiter gruen bleiben, statt zu melden.
    const switchIds = screen.getAllByRole('switch').map((el) => el.id);
    expect(switchIds.sort()).toEqual(ALL.map((f) => `feature-${f}`).sort());
  });

  it('sollte erklären, dass abgewähltes nur ausgeblendet und nicht gesperrt ist', () => {
    renderWithProviders(<FeatureSelection selected={[]} onToggle={vi.fn()} />);
    expect(screen.getByText(/nur ausgeblendet, nicht gesperrt/)).toBeInTheDocument();
  });

  it('sollte zählen, wie viele Bereiche aktiv sind', () => {
    renderWithProviders(<FeatureSelection selected={['budgets', 'debts']} onToggle={vi.fn()} />);
    expect(screen.getByText(`2 von ${ALL.length} Bereichen aktiv`)).toBeInTheDocument();
  });

  it('sollte auf Englisch dieselben Bereiche anbieten', () => {
    renderWithProviders(<FeatureSelection selected={['budgets']} onToggle={vi.fn()} />, {
      locale: 'en',
    });
    expect(screen.getAllByRole('switch')).toHaveLength(ALL.length);
    expect(screen.getByText('Always included')).toBeInTheDocument();
    expect(screen.getByText(`1 of ${ALL.length} areas active`)).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/test-utils/render';
import ArchetypePicker from '../ArchetypePicker';
import { ARCHETYPES, MODIFIERS } from '@/lib/archetypes';

function setup(overrides: Partial<React.ComponentProps<typeof ArchetypePicker>> = {}) {
  const props = {
    value: null,
    modifiers: [],
    onChange: vi.fn(),
    onToggleModifier: vi.fn(),
    ...overrides,
  };
  return { props };
}

describe('ArchetypePicker', () => {
  it('sollte alle Lebenssituationen zur Auswahl anbieten', () => {
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    expect(screen.getAllByRole('radio')).toHaveLength(ARCHETYPES.length);
  });

  it('sollte jede Situation mit einer kurzen Erklärung beschreiben', () => {
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    expect(screen.getByText(/Taschengeld, Nebenjob oder Ausbildungsvergütung/)).toBeInTheDocument();
    expect(screen.getByText(/Feste Bezüge, Vermögen wird entnommen/)).toBeInTheDocument();
  });

  it('sollte die Situation ohne Statusetikett benennen (Ziel statt Zustand)', () => {
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    // Niemand klickt freiwillig auf „verschuldet" — die Kachel ist als Ziel formuliert.
    expect(screen.getByRole('radio', { name: /Schulden abbauen/ })).toBeInTheDocument();
  });

  it('sollte die gewählte Situation als ausgewählt markieren', () => {
    const { props } = setup({ value: 'family' });
    renderWithProviders(<ArchetypePicker {...props} />);
    expect(screen.getByRole('radio', { name: /Familie mit Kindern/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Ruhestand/ })).not.toBeChecked();
  });

  it('sollte die Auswahl nach oben melden', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    await user.click(screen.getByRole('radio', { name: /Studium/ }));
    expect(props.onChange).toHaveBeenCalledWith('student_university');
  });

  it('sollte alle Umstände als Mehrfachauswahl anbieten', () => {
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(MODIFIERS.length);
  });

  it('sollte einen Umstand umschalten können', async () => {
    const user = userEvent.setup();
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />);
    await user.click(screen.getByRole('checkbox', { name: /Ich lege Geld an/ }));
    expect(props.onToggleModifier).toHaveBeenCalledWith('investing');
  });

  it('sollte gewählte Umstände als gesetzt anzeigen', () => {
    const { props } = setup({ modifiers: ['investing'] });
    renderWithProviders(<ArchetypePicker {...props} />);
    expect(screen.getByRole('checkbox', { name: /Ich lege Geld an/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Kinder im Haushalt/ })).not.toBeChecked();
  });

  it('sollte auf Englisch dieselbe Auswahl anbieten', () => {
    const { props } = setup();
    renderWithProviders(<ArchetypePicker {...props} />, { locale: 'en' });
    expect(screen.getByText('Which situation describes you best?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Paying off debt/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I invest money/ })).toBeInTheDocument();
  });
});

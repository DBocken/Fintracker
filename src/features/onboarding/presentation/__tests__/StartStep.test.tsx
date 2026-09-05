import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import StartStep from '../steps/StartStep';

vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
  useMotionSafe: (props: unknown) => props,
}));

const noop = vi.fn();

function renderStep(overrides: Partial<Parameters<typeof StartStep>[0]> = {}) {
  return renderWithProviders(
    <StartStep
      anonymous={false}
      saving={false}
      saveFailed={false}
      onBack={noop}
      onFinish={noop}
      {...overrides}
    />,
  );
}

describe('StartStep', () => {
  it('sollte zuerst nach der Datenquelle fragen', () => {
    renderStep();
    expect(screen.getByText('Womit möchtest du anfangen?')).toBeInTheDocument();
  });

  it('sollte anonym benennen, dass die Bankanbindung ein Konto braucht', () => {
    renderStep({ anonymous: true });
    expect(screen.getByText(/Verbindung zu deiner Bank brauchst du ein Konto/)).toBeInTheDocument();
  });

  it('sollte nach der Datenquelle das Tutorial anbieten', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole('button', { name: /Beispieldaten/ }));
    await waitFor(() =>
      expect(screen.getByText('Möchtest du ein Tutorial starten?')).toBeInTheDocument(),
    );
  });

  it('sollte bei Beispieldaten erklären, dass die App dafür befüllt wird', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole('button', { name: /Beispieldaten/ }));
    await waitFor(() =>
      expect(screen.getByText(/zunächst mit Beispieldaten befüllt/)).toBeInTheDocument(),
    );
  });

  it('sollte den Beispieldaten-Hinweis beim Datei-Weg weglassen', async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole('button', { name: /Datei/ }));
    await waitFor(() =>
      expect(screen.getByText('Möchtest du ein Tutorial starten?')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/zunächst mit Beispieldaten befüllt/)).toBeNull();
  });

  it('sollte Quelle und Tutorialwunsch gemeinsam melden', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderStep({ onFinish });
    await user.click(screen.getByRole('button', { name: /Beispieldaten/ }));
    await waitFor(() => screen.getByText('Möchtest du ein Tutorial starten?'));
    await user.click(screen.getByRole('button', { name: /Tutorial starten/ }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({ source: 'demo', startTutorial: true }),
    );
  });

  it('sollte „Selbst erkunden" ohne Tutorial melden', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderStep({ onFinish });
    await user.click(screen.getByRole('button', { name: /Datei/ }));
    await waitFor(() => screen.getByText('Möchtest du ein Tutorial starten?'));
    await user.click(screen.getByRole('button', { name: /Selbst erkunden/ }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({ source: 'csv', startTutorial: false }),
    );
  });

  it('sollte einen gescheiterten Schreibvorgang benennen, statt ihn zu verschlucken', async () => {
    const user = userEvent.setup();
    renderStep({ saveFailed: true });
    await user.click(screen.getByRole('button', { name: /Beispieldaten/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('sollte auf Englisch dieselbe Frage stellen', () => {
    renderWithProviders(
      <StartStep
        anonymous={false}
        saving={false}
        saveFailed={false}
        onBack={noop}
        onFinish={noop}
      />,
      { locale: 'en' },
    );
    expect(screen.getByText('Where would you like to start?')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { AssetVolume, type AssetVolumeItem } from '../AssetVolume';

/**
 * WP-6.4 — Vermögen als Volumen.
 *
 * Die Flächenrechnung selbst hat eigene Tests in
 * `lib/__tests__/volume-scale.test.ts`. Hier wird geprüft, was die Komponente
 * darüber hinaus leisten muss: die Zahlen auch ohne Grafik zugänglich machen
 * und nicht vorhandene Posten weglassen.
 */

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

const ITEMS: AssetVolumeItem[] = [
  {
    key: 'cash',
    value: 2_000,
    label: 'Liquidität',
    colorClass: 'bg-brand',
    formattedValue: '2.000 €',
  },
  {
    key: 'investments',
    value: 8_000,
    label: 'Investitionen',
    colorClass: 'bg-premium',
    formattedValue: '8.000 €',
  },
  {
    key: 'receivables',
    value: 0,
    label: 'Forderungen',
    colorClass: 'bg-positive',
    formattedValue: '0 €',
  },
];

describe('AssetVolume (WP-6.4)', () => {
  it('sollte jeden vorhandenen Posten beschriften', () => {
    renderWithI18n(<AssetVolume items={ITEMS} />);
    expect(screen.getByText('Liquidität')).toBeInTheDocument();
    expect(screen.getByText('Investitionen')).toBeInTheDocument();
  });

  it('sollte nicht vorhandene Posten weglassen', () => {
    // Ein Vermögensteil, den es nicht gibt, soll auch nicht als winziger
    // Punkt erscheinen.
    renderWithI18n(<AssetVolume items={ITEMS} />);
    expect(screen.queryByText('Forderungen')).not.toBeInTheDocument();
  });

  it('sollte Betrag UND Anteil als Text bereitstellen', () => {
    // WP-6.10: Die Kreise sind für Hilfstechnik ausgeblendet — die Aussage
    // muss daneben stehen. Beides, weil die Grafik beides zeigt.
    renderWithI18n(<AssetVolume items={ITEMS} />);
    expect(screen.getByText(/Investitionen: 8\.000 € — 80 % des Vermögens/)).toBeInTheDocument();
    expect(screen.getByText(/Liquidität: 2\.000 € — 20 % des Vermögens/)).toBeInTheDocument();
  });

  it('sollte die Kreise für Hilfstechnik ausblenden', () => {
    const { container } = renderWithI18n(<AssetVolume items={ITEMS} />);
    const circles = container.querySelectorAll('.rounded-full');
    expect(circles.length).toBeGreaterThan(0);
    for (const circle of circles) {
      expect(circle.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('sollte bei reduced-motion sofort die Endgroesse zeigen', () => {
    // Ohne diesen Zweig staenden die Kreise bei 0 und waeren unsichtbar —
    // der Inhalt haenge dann an einer Animation, die gar nicht laeuft.
    reduceMock.mockReturnValue(true);
    const { container } = renderWithI18n(<AssetVolume items={ITEMS} />);
    const first = container.querySelector('.rounded-full') as HTMLElement;
    expect(first.style.width).not.toBe('0px');
    expect(first.style.transition).toBe('');
  });

  it('sollte ohne Posten gar nichts rendern', () => {
    const { container } = renderWithI18n(
      <AssetVolume items={[{ ...ITEMS[2] }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('sollte das Groesste zuerst zeigen', () => {
    // Es traegt die Aussage.
    renderWithI18n(<AssetVolume items={ITEMS} />);
    const labels = screen.getAllByText(/Liquidität|Investitionen/);
    expect(labels[0].textContent).toBe('Investitionen');
  });
});

/**
 * Zwei Überschriften mit demselben Namen auf einem Bildschirm.
 *
 * Der Seitenname-Umbau rückte den Namen in der fokussierten Dichte EINMAL in
 * den Inhalt und liess die Fläche ihre eigene Überschrift zurückziehen. Die
 * Annahme dabei war, jede Fläche führe ihren Namen über `PageHeader`.
 *
 * **Gemessen stimmte das nicht.** Vier Flächen bringen ihre eigene `<h1>` mit
 * — `/settings`, `/city`, `/fragen` und `/trading` —, und dort stand der Name
 * danach zweimal. Aufgefallen ist es nicht hier, sondern in CI: Playwright
 * brach mit „strict mode violation: resolved to 2 elements" ab, weil zwei
 * Überschriften „Finanzstadt" hiessen. Zwei `<h1>` sind aber kein Testproblem
 * — für eine Sprachausgabe ist die Seite damit zweimal betitelt.
 *
 * Geprüft wird die REGEL, nicht die vier Einzelfälle: Wer den Haken benutzt,
 * zieht sich zurück; wer ihn nicht benutzt, ist ein Fund. Der zweite Teil ist
 * nicht komponentenweise prüfbar — dafür steht die Quelltext-Prüfung unten.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  SeitennameProvider,
  useSeitennameVerdeckung,
} from '../SeitennameContext';

function Ueberschrift() {
  const verdeckung = useSeitennameVerdeckung();
  return <h1 className={`text-xl ${verdeckung}`}>Finanzstadt</h1>;
}

function rendere(traegtDieShell: boolean) {
  render(
    <I18nProvider initialLocale="de">
      <SeitennameProvider traegtDieShell={traegtDieShell}>
        <Ueberschrift />
      </SeitennameProvider>
    </I18nProvider>,
  );
  return screen.getByRole('heading', { name: 'Finanzstadt' });
}

describe('Seitenname — die Verdeckung', () => {
  it('[MOBILE] sollte die flächeneigene Überschrift zurückziehen, wenn die Shell den Namen trägt', () => {
    // Geprüft wird die ANWEISUNG, nicht ihre gerechnete Wirkung: In jsdom gibt
    // es kein Stylesheet, das `fokussiert:` auflöst. Dieselbe Begründung wie
    // bei den Safe-Area- und Seitenverhältnis-Tests.
    expect(rendere(true).className).toContain('fokussiert:hidden');
  });

  it('sollte sie stehen lassen, wenn die Shell keinen Namen trägt', () => {
    // Flächen ausserhalb der Navigation (Abrechnung, Datenschutz) haben keinen
    // Navigationseintrag, aus dem ein kanonischer Name käme. Dort bleibt die
    // Fläche zuständig — würde sie sich auch hier zurückziehen, hätte der
    // Bildschirm gar keine Überschrift mehr.
    expect(rendere(false).className).not.toContain('fokussiert:hidden');
  });

  it('[REGRESSION] sollte jede flächeneigene Überschrift einer Navigationsroute am Haken haben', () => {
    // Der eigentliche Fund. Eine Komponente kann nicht wissen, ob eine ANDERE
    // Datei ihre Überschrift vergessen hat — diese Prüfung liest deshalb den
    // Quelltext. Wer eine `<h1>` auf einer Navigationsroute rendert, benutzt
    // `useSeitennameVerdeckung`; sonst steht der Name dort zweimal.
    const flaechenMitEigenerUeberschrift = [
      'src/components/settings/EnhancedSettings.tsx',
      'src/features/finance-city/presentation/CityChrome.tsx',
      'src/features/money-questions/presentation/MoneyQuestionsPane.tsx',
      'src/features/trading/presentation/shared/TradingHeader.tsx',
      'src/features/shared/presentation/PageHeader.tsx',
    ];

    const ohneHaken = flaechenMitEigenerUeberschrift.filter(
      (datei) => !readFileSync(datei, 'utf8').includes('useSeitennameVerdeckung'),
    );

    expect(ohneHaken).toEqual([]);
  });
});

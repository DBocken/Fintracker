import { useMemo, type ReactNode } from 'react';
import { useTutorialRun } from '@/hooks/useTutorialRun';
import { TutorialControlProvider, type TutorialControl } from '@/hooks/useTutorialControl';
import TutorialOverlay from './TutorialOverlay';
import { TutorialPresenceProvider } from './tutorial-presence';

/**
 * Hält den Tutorial-Lauf und zeigt das Overlay, während er läuft.
 *
 * Ein eigener Wirt, damit `useTutorialRun` genau **einmal** existiert. Zwei
 * Aufrufe wären zwei unabhängige Zustandsmaschinen.
 *
 * Der Host umschließt die App als Provider (Befund A-2): nachrangige Hinweise
 * wie der Coach-Streifen lesen über `useTutorialPresence`, ob gerade eine
 * Tutorial-Hinweisebene sichtbar ist, und treten so lange zurück.
 *
 * **Kein Einladungsstreifen mehr** (`docs/tutorial-sequence.md`, Schritt 7):
 * Mit dem dauerhaften Kopfzeilen-Knopf (`TutorialLauncher`) und der Frage im
 * Onboarding (`OnboardingDialog`) gibt es bereits zwei Einstiege ins
 * Tutorial — ein zusätzlich über jeder Seite schwebendes „Soll ich es dir
 * zeigen?" wäre ein dritter, redundanter Weg zu demselben Angebot.
 */
export default function TutorialHost({ children }: { children?: ReactNode }) {
  const run = useTutorialRun();

  const presence = useMemo(() => ({ hintVisible: run.active }), [run.active]);

  // Der Griff nach außen: Kopfzeile, Übersichtsseite und Onboarding starten
  // Führungen, ohne den Lauf zu besitzen. `run.start`/`run.startSeries` sind
  // stabil (useCallback), der Kontextwert wechselt also nur mit dem
  // Laufzustand.
  const { start, startSeries, teachable, active } = run;
  const control = useMemo<TutorialControl>(
    () => ({
      start,
      startSeries,
      // Startet die zusammenhängende Folge aller gerade lehrbaren Kapitel —
      // dieselbe Folge wie der „Alles ansehen"-Knopf in der Übersicht
      // (`TutorialsOverview`), hier aber ohne dass die Aufrufstelle (das
      // Onboarding) den Katalog selbst kennen muss.
      startAll: () => startSeries(teachable),
      active,
    }),
    [start, startSeries, teachable, active],
  );

  return (
    <TutorialPresenceProvider value={presence}>
      <TutorialControlProvider value={control}>
      {run.active && <TutorialOverlay run={run} />}
      {children}
      </TutorialControlProvider>
    </TutorialPresenceProvider>
  );
}

import { createContext, useContext } from 'react';
import type { TutorialChapterId } from '@/lib/tutorial-sequence';

/**
 * Der Griff an die laufende Führung — für alles, was sie starten will, ohne
 * sie zu besitzen.
 *
 * `useTutorialRun` darf es genau **einmal** geben (zwei Aufrufe wären zwei
 * Zustandsmaschinen, und Einladung, Kopfzeile und Übersicht redeten von
 * verschiedenen Läufen). Gehalten wird der eine Lauf von `TutorialHost`; alles
 * andere liest ihn über diesen Kontext.
 *
 * Warum der Kontext in `src/hooks/` liegt und nicht neben dem Host: Die
 * Übersichtsseite ist eine Feature-Slice-Präsentation, und ein Import aus
 * `src/components/` würde dort die Slice-Ratsche hochtreiben
 * (`pnpm check:slice-presentation`). Der Provider bleibt Komponente, der
 * Lesezugriff nicht — dieselbe Trennung wie bei `useLocalEncryption`
 * (AGENTS.md §3, „Wohin ein Typ gehört").
 */
export interface TutorialControl {
  /** Startet ein Kapitel — auch ein bereits erledigtes. */
  start: (chapter: TutorialChapterId) => void;
  /** Startet eine Folge von Kapiteln am Stück (das Gesamt-Tutorial). */
  startSeries: (chapters: readonly TutorialChapterId[]) => void;
  /**
   * Startet die Folge aller gerade lehrbaren Kapitel — das ganze Tutorial in
   * einem Rutsch, ohne dass die Aufrufstelle den Katalog selbst kennen muss.
   * Für Einstiege wie das Onboarding, die nur „führ mich einmal komplett
   * durch" ausdrücken wollen, nicht welche Kapitel das im Einzelnen sind.
   */
  startAll: () => void;
  /** Läuft gerade eine Führung? */
  active: boolean;
}

const NOOP: TutorialControl = {
  start: () => {},
  startSeries: () => {},
  startAll: () => {},
  active: false,
};

/**
 * Ohne Provider passiert nichts, statt zu werfen: Ein Screenshot-Test oder
 * eine isoliert gerenderte Fläche soll an einer fehlenden Führung nicht
 * scheitern — die Führung ist Beiwerk, nicht Voraussetzung.
 */
const TutorialControlContext = createContext<TutorialControl>(NOOP);

export const TutorialControlProvider = TutorialControlContext.Provider;

export function useTutorialControl(): TutorialControl {
  return useContext(TutorialControlContext);
}

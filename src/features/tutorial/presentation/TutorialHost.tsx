import { useTutorialRun } from '../application/useTutorialRun';
import TutorialOverlay from './TutorialOverlay';
import TutorialInvitation from './TutorialInvitation';

/**
 * Hält den Tutorial-Lauf und entscheidet, was davon zu sehen ist: die
 * Einladung, wenn ein Kapitel bereitsteht, das Overlay, während es läuft.
 *
 * Ein eigener Wirt, damit `useTutorialRun` genau **einmal** existiert. Zwei
 * Aufrufe wären zwei unabhängige Zustandsmaschinen, und Einladung und Overlay
 * würden von verschiedenen Läufen reden.
 */
export default function TutorialHost() {
  const run = useTutorialRun();

  if (run.active) return <TutorialOverlay run={run} />;
  return <TutorialInvitation run={run} />;
}

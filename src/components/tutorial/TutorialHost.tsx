import { useMemo, useState, type ReactNode } from 'react';
import { useTutorialRun } from '@/hooks/useTutorialRun';
import TutorialOverlay from './TutorialOverlay';
import TutorialInvitation from './TutorialInvitation';
import { TutorialPresenceProvider } from './tutorial-presence';

/**
 * Hält den Tutorial-Lauf und entscheidet, was davon zu sehen ist: die
 * Einladung, wenn ein Kapitel bereitsteht, das Overlay, während es läuft.
 *
 * Ein eigener Wirt, damit `useTutorialRun` genau **einmal** existiert. Zwei
 * Aufrufe wären zwei unabhängige Zustandsmaschinen, und Einladung und Overlay
 * würden von verschiedenen Läufen reden.
 *
 * Der Host umschließt die App als Provider (Befund A-2): nachrangige Hinweise
 * wie der Coach-Streifen lesen über `useTutorialPresence`, ob gerade eine
 * Tutorial-Hinweisebene sichtbar ist, und treten so lange zurück. Deshalb
 * liegt auch der Wegklick-Zustand der Einladung hier und nicht in ihr selbst.
 */
export default function TutorialHost({ children }: { children?: ReactNode }) {
  const run = useTutorialRun();
  const [invitationDismissed, setInvitationDismissed] = useState(false);

  const invitationVisible = !run.active && !invitationDismissed && run.upcoming !== null;
  const hintVisible = run.active || invitationVisible;
  const presence = useMemo(() => ({ hintVisible }), [hintVisible]);

  return (
    <TutorialPresenceProvider value={presence}>
      {run.active ? (
        <TutorialOverlay run={run} />
      ) : (
        invitationVisible && <TutorialInvitation run={run} onDismiss={() => setInvitationDismissed(true)} />
      )}
      {children}
    </TutorialPresenceProvider>
  );
}

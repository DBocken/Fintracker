import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTutorialRun } from '@/hooks/useTutorialRun';
import { chapterOnRoute } from '@/lib/tutorial-steps';
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
  const location = useLocation();
  const [invitationDismissed, setInvitationDismissed] = useState(false);

  // Welches Kapitel angeboten wird, entscheidet die geöffnete Seite — nicht
  // allein der Lehrplan. Spielt hier eines, gilt dieses; sonst bleibt der
  // Lehrplan-Anfang, dann aber ausdrücklich als Wechsel benannt (`here`).
  // Vorher bot die Einladung überall den Lehrplan-Anfang an und nannte ihn
  // „diesen Bereich": Der Klick riss die Seite weg, und erklärt wurde etwas
  // anderes als das, worauf der Nutzer gerade sah.
  const here = chapterOnRoute(run.teachable, location.pathname);
  const offered = here ?? run.upcoming;

  const invitationVisible = !run.active && !invitationDismissed && offered !== null;
  const hintVisible = run.active || invitationVisible;
  const presence = useMemo(() => ({ hintVisible }), [hintVisible]);

  return (
    <TutorialPresenceProvider value={presence}>
      {run.active ? (
        <TutorialOverlay run={run} />
      ) : (
        invitationVisible && (
          <TutorialInvitation
            chapter={offered}
            here={here !== null}
            onStart={() => offered && run.start(offered)}
            onDismiss={() => setInvitationDismissed(true)}
          />
        )
      )}
      {children}
    </TutorialPresenceProvider>
  );
}

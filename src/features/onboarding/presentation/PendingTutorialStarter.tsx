/**
 * Löst den im Einstieg vorgemerkten Tutorial-Wunsch ein.
 *
 * Der Einstieg selbst kann die Führung nicht starten: `TutorialHost` steht
 * innerhalb der `AppShell`, der Einstieg davor. Diese Komponente sitzt im
 * Host und startet genau einmal, sobald die App wirklich steht.
 */

import { useEffect, useRef } from 'react';
import { useTutorialControl } from '@/hooks/useTutorialControl';
import { consumeTutorialWish } from '../data/pending-tutorial';

export default function PendingTutorialStarter() {
  const { startAll } = useTutorialControl();
  const erledigt = useRef(false);

  useEffect(() => {
    if (erledigt.current) return;
    erledigt.current = true;
    if (consumeTutorialWish()) startAll();
  }, [startAll]);

  return null;
}

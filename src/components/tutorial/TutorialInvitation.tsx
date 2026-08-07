import { GraduationCap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { TutorialRun } from '@/hooks/useTutorialRun';

/**
 * Die Einladung zum nächsten Kapitel — bewusst ein Angebot, kein Dialog.
 *
 * Ein modaler Dialog würde die App anhalten und damit genau das tun, was die
 * behutsame Heranführung vermeiden soll (`docs/tutorial-progressive-disclosure.md`).
 *
 * Rahmen und Schatten sind hier **keine** Karte im Sinn von
 * `docs/design-principles.md` („Karten sind Aktionen"), sondern die Ablösung
 * einer schwebenden Ebene vom Inhalt darunter — dieselbe Rolle wie bei einem
 * Hinweis-Streifen. Die Karten-Regel zielt auf tote Rahmen um genau einen
 * verschachtelten Knopf; hier stehen zwei gleichberechtigte Ziele
 * nebeneinander, und „Nicht jetzt" darf niemals versehentlich die Führung
 * starten. Genau deshalb ist die Fläche als Ganzes bewusst nicht klickbar.
 *
 * **WP-10.3 — warum die Einladung nicht mehr im Layoutfluss liegt.** Als
 * eingeschobener Streifen über der ganzen Hülle war sie mit 0,073 der weitaus
 * größte Posten im CLS-Budget von `/dashboard` (Budget 0,1): Sie schob
 * Kopfzeile, Navigation und Inhalt gemeinsam nach unten, sobald
 * `getUserSettings` aus der IndexedDB zurückkam.
 *
 * Verworfen wurden zwei naheliegende Wege. **Platz reservieren** lässt bei
 * allen, die keine Einladung bekommen — das ist der Normalfall — dauerhaft
 * einen leeren Streifen stehen; die Kosten trügen also alle für den seltenen
 * Fall. **Unter die Kopfzeile setzen** verschiebt weiterhin fast die gesamte
 * sichtbare Fläche und halbiert den Wert bestenfalls.
 *
 * Stattdessen liegt sie jetzt über dem Inhalt statt in ihm — dieselbe
 * Entscheidung, die der `OfflineIndicator` in WP-9.3 aus demselben Grund
 * getroffen hat. Das passt auch zur Sache: Ein Angebot, das man wegklicken
 * kann, ist keine Seitenstruktur. CLS-Beitrag: 0.
 */
export default function TutorialInvitation({
  run,
  onDismiss,
}: {
  run: TutorialRun;
  /** Das Wegklicken gehört dem Host: er hält die Präsenz der Hinweisebene
   *  (Befund A-2), damit nachrangige Hinweise nachrücken können. */
  onDismiss: () => void;
}) {
  const { t } = useI18n();

  if (!run.upcoming) return null;

  return (
    // Der Rahmen fängt keine Klicks ab (`pointer-events-none`), damit der
    // Inhalt darunter bedienbar bleibt; nur der Streifen selbst reagiert.
    // Der untere Abstand hält die Einladung über der Mobil-Navigation —
    // dieselbe Formel wie deren Platzhalter in `AppShell`.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4"
      // Sanft von unten herein statt aufploppen (AGENTS.md §9). Die
      // Bewegung liegt in `motion-safe`, respektiert also
      // `prefers-reduced-motion` ohne eigene Abfrage.
      data-testid="tutorial-invitation"
    >
      {/* `bg-card` und NICHT `bg-brand/10`: Eine durchscheinende Fläche
          übernimmt die Farbe dessen, was gerade darunter liegt — und über
          welchem Inhalt sie schwebt, ist nicht vorhersagbar. Gemessen kamen
          dabei 1.44:1 auf /accounts und 2.27:1 auf /net-worth heraus, für
          denselben Text. Der Farbakzent liegt jetzt im Rahmen, der Text auf
          einer bekannten Fläche. */}
      <div className="pointer-events-auto flex w-full max-w-[42rem] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-brand/40 bg-card px-4 py-2 text-xs text-card-foreground shadow-lg motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in sm:text-sm">
        <GraduationCap className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{t('tutorial.invitationTitle', 'Soll ich es dir zeigen?')}</span>{' '}
          <span className="text-muted-foreground">
            {t('tutorial.invitationBody', 'Eine kurze Führung durch diesen Bereich.')}
          </span>
        </span>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => run.start()}>
          {t('tutorial.invitationStart', 'Zeig es mir')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label={t('tutorial.invitationDismiss', 'Nicht jetzt')}
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

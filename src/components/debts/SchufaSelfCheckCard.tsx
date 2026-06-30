import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ShieldCheck, ExternalLink, Inbox, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSchufareminder } from "@/hooks/useSchufareminder";
import { SCHUFA_EXPLANATION, SCHUFA_REQUEST_URL } from "@/services/schufa-service";

function formatArrival(iso: string): string {
  try {
    return format(parseISO(iso), "d. MMMM", { locale: de });
  } catch {
    return "";
  }
}

/**
 * Geführte SCHUFA-Selbstauskunft (Issue #49, Epic #24): Erklären → Erinnern →
 * Erfassen. Aktions-Karte (Formular-Container) — nimmt dem Nutzer die Hürde,
 * die KOSTENLOSE DSGVO-Art.-15-Auskunft anzufordern, und erinnert ans Scannen.
 * RDG: informiert über ein Recht, gibt keine Rechtsberatung.
 */
export function SchufaSelfCheckCard() {
  const { reminder, isWaiting, isDue, request, markScanned, isRequesting, isMarking } =
    useSchufareminder();

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{SCHUFA_EXPLANATION.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{SCHUFA_EXPLANATION.text}</p>
            </div>

            <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {SCHUFA_EXPLANATION.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>

            {isWaiting ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Inbox className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  {isDue ? (
                    <span>Deine Auskunft müsste inzwischen da sein. Schon im Briefkasten?</span>
                  ) : (
                    <span>
                      Angefordert. Wir erinnern dich ca. am{" "}
                      <span className="font-medium">
                        {reminder ? formatArrival(reminder.expected_arrival) : ""}
                      </span>
                      .
                    </span>
                  )}
                </div>
                <Button
                  variant={isDue ? "default" : "outline"}
                  size="sm"
                  onClick={markScanned}
                  disabled={isMarking}
                >
                  {isMarking ? (
                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  )}
                  Auskunft ist da
                </Button>
              </div>
            ) : (
              <Button asChild className="w-full sm:w-auto">
                <a
                  href={SCHUFA_REQUEST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => request()}
                >
                  {isRequesting ? (
                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  )}
                  {SCHUFA_EXPLANATION.cta}
                </a>
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground">{SCHUFA_EXPLANATION.warning}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

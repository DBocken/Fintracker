"use client";

import { useI18n } from "@/i18n/useI18n";
import { lookupTranslation, lookupWorded } from "@/i18n/I18nProvider";
import { BASE_WORDING, otherWording } from "@/i18n/wording";
import {
  glossaryDefinitionKey,
  glossaryTermKey,
  type GlossaryTermId,
} from "@/i18n/glossary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ResponsiveInfoPopover } from "./ResponsiveInfoPopover";

interface GlossaryTermProps {
  termId: GlossaryTermId;
  /**
   * Blendet die Sekundärzeile mit dem Fachbegriff aus. Für breitenbegrenzte
   * Flächen (Navigations-Labels, KPI-Kacheln, Chart-Legenden), wo eine zweite
   * Zeile das Layout sprengt.
   */
  hideSecondary?: boolean;
  className?: string;
}

/**
 * Ein Fachbegriff im aktuell gewählten Sprachstil — antippbar, mit Erklärung
 * und der Entsprechung im jeweils anderen Register.
 *
 * In der Alltagssprache steht der Fachbegriff als leise Sekundärzeile daneben:
 * wer vom Fach ist, sieht sofort, dass die App den richtigen Begriff kennt,
 * und fühlt sich nicht für dumm gehalten; wer ihn nicht kennt, steht trotzdem
 * nicht vor einem fremden Wort. In der Fachsprache entfällt die Zeile — dort
 * ist der Begriff selbst die Hauptbezeichnung.
 *
 * ACHTUNG „Karten sind Aktionen" (docs/design-principles.md Prinzip 8): steht
 * der Begriff im Titel einer `InteractiveCard`, ist die Karte bereits das
 * Klickziel. Dieser Baustein rendert einen echten `<button>` und erzeugte dort
 * `<button>` in `<a>` — ungültiges HTML und zwei konkurrierende Klickziele. In
 * dem Fall gehört der Auslöser in die Kopfzeile AUSSERHALB der Karte, oder das
 * Folge-Sheet der Karte trägt einen Glossar-Abschnitt.
 */
export function GlossaryTerm({ termId, hideSecondary, className }: GlossaryTermProps) {
  const { locale, wording, setWording, t } = useI18n();

  const termKey = glossaryTermKey(termId);
  const current = t(termKey);
  const other = lookupWorded(locale, termKey, otherWording(wording)) ?? current;
  const definition = t(glossaryDefinitionKey(termId));

  // Der Fachbegriff steht immer im Basisbaum, unabhängig vom aktiven Register.
  const technical = lookupTranslation(locale, termKey) ?? current;
  const showSecondary = !hideSecondary && wording !== BASE_WORDING && technical !== current;

  const otherLabel = wording === BASE_WORDING ? t("glossary.alsoEveryday") : t("glossary.alsoTechnical");
  const switchLabel =
    wording === BASE_WORDING ? t("glossary.switchToEveryday") : t("glossary.switchToTechnical");

  return (
    <ResponsiveInfoPopover
      title={current}
      trigger={
        <button
          type="button"
          aria-label={t("glossary.openLabel").replace("{term}", current)}
          className={cn(
            "inline-flex flex-col items-start text-left underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
            className,
          )}
        >
          <span>{current}</span>
          {showSecondary ? (
            <span className="text-xs font-normal text-muted-foreground">{technical}</span>
          ) : null}
        </button>
      }
    >
      <p>{definition}</p>
      {other !== current ? (
        <p className="text-xs">
          <span className="text-muted-foreground">{otherLabel}: </span>
          <span className="font-medium text-foreground">{other}</span>
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0 text-xs"
        onClick={() => setWording(otherWording(wording))}
      >
        {switchLabel}
      </Button>
    </ResponsiveInfoPopover>
  );
}

export default GlossaryTerm;

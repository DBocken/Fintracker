import { Sparkles, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAutomationSuggestions } from "@/hooks/useAutomationSuggestions";
import {
  suggestionConfidenceLevel,
  type SuggestionConfidenceLevel,
} from "@/lib/automation-suggestions";

const LEVEL_CLASS: Record<SuggestionConfidenceLevel, string> = {
  hoch: "bg-positive/15 text-positive",
  mittel: "bg-brand/15 text-brand",
  niedrig: "bg-muted text-muted-foreground",
};

/**
 * Coach-Posteingang für Kategorie-Vorschläge („Unsichtbare Intelligenz, sichtbare
 * Erklärung"): zeigt automatisch erkannte Zuordnungen mit Sicherheitsstufe und
 * Grund — der Nutzer übernimmt oder lehnt ab. Bleibt unsichtbar, wenn nichts
 * offen ist (Ruhe vor Fülle). Aktions-/Formular-Container.
 */
export default function CategorySuggestionsInbox() {
  const { suggestions, accept, reject, isBusy, categoryNameById } = useAutomationSuggestions();

  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
          Vorschläge zur Bestätigung
          <Badge variant="outline" className="font-normal">
            {suggestions.length}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Automatisch erkannt – du entscheidest. Nichts wird ohne dich geändert.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {suggestions.map((s) => {
            const categoryId = (s.proposedChange as { category_id?: string }).category_id;
            const categoryName = (categoryId && categoryNameById.get(categoryId)) || "Kategorie";
            const level = suggestionConfidenceLevel(s.confidence);
            return (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-background p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    Vorschlag:
                    <span className="font-medium text-foreground">{categoryName}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${LEVEL_CLASS[level]}`}>
                      {level} Sicherheit
                    </span>
                  </p>
                  {s.reasons[0] && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.reasons[0]}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" onClick={() => accept(s)} disabled={isBusy}>
                    <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                    Übernehmen
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => reject(s)}
                    disabled={isBusy}
                    aria-label={`Vorschlag ablehnen: ${s.title}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

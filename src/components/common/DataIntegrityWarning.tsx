import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";

interface DataIntegrityWarningProps {
  /**
   * Beim letzten Lesen übersprungene, beschädigte Items dieser Collection
   * (`src/services/data-integrity-report.ts`, WP 1.2 Teil A). `0` ⇒ kein
   * Hinweis — kein Dauerbanner, der bei jedem sauberen Lesevorgang trotzdem
   * aufploppt.
   */
  skippedCount: number;
}

/**
 * Warnung mit Handlungsoption für Collections, bei denen die Kern-Lesegrenze
 * (`readLocalFinanceList`/`getLocalTransactions`, WP 1.2 Teil A) einzelne
 * kaputte Items übersprungen hat.
 *
 * KEIN Fehlerzustand: Die Daten SIND da (nur ein Teil ist unlesbar) —
 * `FinanceErrorState` würde hier fälschlich funktionierende Daten verstecken.
 * Der Hinweis steht deshalb NEBEN der Liste, nicht an ihrer Stelle.
 *
 * KEINE Karte (AGENTS.md §9): Ein `<Alert>` ohne `bg-card`/Schatten löst die
 * Karten-Regel nicht aus — passend, denn die Fläche selbst navigiert nicht,
 * nur der Link tut es.
 *
 * Ton wie `LocalEncryptionSettings`: `border-warning bg-warning/30` +
 * `text-foreground` (Warnfarbe AUF Warnfarbe ist schwer lesbar, die Fläche
 * trägt das Signal, nicht der Text).
 */
export default function DataIntegrityWarning({ skippedCount }: DataIntegrityWarningProps) {
  const { t } = useI18n();

  if (skippedCount <= 0) return null;

  return (
    <Alert className="mb-4 flex flex-wrap items-center justify-between gap-3 border-warning bg-warning/30">
      <AlertDescription className="flex items-center gap-2 text-sm text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        {/* Einzahl bekommt einen eigenen Schlüssel, keine eingesetzte 1: „1 Einträge"
            ist in jeder der drei Sprachen falsch, und der Fall count === 1 ist
            gerade bei beschädigten Datensätzen der häufigste. Zwei Formen nach dem
            Muster von `pluralTransactions`/`pluralCharges` — Russisch kennt
            eigentlich drei (1 / 2–4 / 5+), dafür fehlt dem Repo bisher der
            Mechanismus; die Mehrzahlform deckt hier 5+ korrekt ab. */}
        {skippedCount === 1
          ? t("dataIntegrity.itemsSkippedOne")
          : t("dataIntegrity.itemsSkipped").replace("{count}", String(skippedCount))}
      </AlertDescription>
      <Button asChild variant="outline" size="sm" className="shrink-0 border-border bg-card text-foreground hover:bg-accent">
        <Link to="/settings#backups">{t("dataIntegrity.checkBackup")}</Link>
      </Button>
    </Alert>
  );
}

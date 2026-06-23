import { useState } from "react";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { clearAllLocalData } from "@/services/local-data-reset";
import { clearAnonymousMode } from "@/lib/anonymous-mode";
import { getLocalFinanceStorageStatus } from "@/services/local-finance-store";
import { showError, showSuccess } from "@/utils/toast";
import { useI18n } from "@/i18n/useI18n";

/**
 * Abmelde-Button mit Datenhinweis (Issue #32): Beim Logout kann der Nutzer
 * wählen, ob die lokalen Finanzdaten auf diesem Gerät bleiben oder gelöscht
 * werden. Auf fremden/geteilten Geräten wird das Löschen empfohlen – besonders
 * wenn keine lokale Verschlüsselung aktiv ist, da die Daten sonst im Klartext
 * für den nächsten Nutzer zugänglich blieben.
 */
export function LogoutButton({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);

  // Beim Öffnen den aktuellen Schutzstatus bestimmen, um das Löschen
  // vorzuschlagen, wenn unverschlüsselte Daten lokal liegen.
  function handleOpenChange(next: boolean) {
    if (next) {
      void getLocalFinanceStorageStatus().then((status) => setWipe(!status.encrypted));
    }
    setOpen(next);
  }

  async function handleLogout() {
    setBusy(true);
    try {
      if (wipe) {
        await clearAllLocalData();
        clearAnonymousMode();
      }
      await supabase.auth.signOut();
      showSuccess(wipe ? t("auth.loggedOut", "Abgemeldet, lokale Daten gelöscht") : t("auth.loggedOutOnly", "Abgemeldet"));
      setOpen(false);
    } catch {
      showError(t("common.cancel", "Abmelden fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" className={className} type="button">
          <LogOut className="mr-1 h-3 w-3" />
          {t("auth.logout", "Abmelden")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("auth.logout", "Abmelden")}</AlertDialogTitle>
          <AlertDialogDescription>
            Deine Finanzdaten liegen lokal auf diesem Gerät. Auf einem fremden oder
            geteilten Gerät solltest du sie beim Abmelden löschen.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Checkbox
            checked={wipe}
            onCheckedChange={(v) => setWipe(v === true)}
            aria-label={t("auth.wipeLocalData", "Lokale Daten auf diesem Gerät löschen")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{t("auth.wipeLocalData", "Lokale Daten auf diesem Gerät löschen")}</span>
            <span className="mt-1 block text-muted-foreground">
              Entfernt alle lokal gespeicherten Transaktionen, Konten, Schulden und
              Einstellungen. Bereits angelegte Backups oder die Cloud bleiben unberührt.
            </span>
          </span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel", "Abbrechen")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleLogout();
            }}
            disabled={busy}
          >
            {wipe ? t("auth.logoutAndWipe", "Löschen & abmelden") : t("auth.logout", "Abmelden")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default LogoutButton;

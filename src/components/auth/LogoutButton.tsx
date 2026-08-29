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
import { endSession } from "@/services/session-service";
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
      await endSession({ wipeLocalData: wipe });
      showSuccess(wipe ? t("auth.loggedOut") : t("auth.loggedOutOnly"));
      setOpen(false);
    } catch {
      showError(t("auth.logoutFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" className={className} type="button">
          <LogOut className="mr-1 h-3 w-3" />
          {t("auth.logout")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("auth.logout")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("auth.logoutDataHint")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <Checkbox
            checked={wipe}
            onCheckedChange={(v) => setWipe(v === true)}
            aria-label={t("auth.wipeLocalData")}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{t("auth.wipeLocalData")}</span>
            <span className="mt-1 block text-muted-foreground">
              {t("auth.wipeLocalDataHint")}
            </span>
          </span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleLogout();
            }}
            disabled={busy}
          >
            {wipe ? t("auth.logoutAndWipe") : t("auth.logout")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default LogoutButton;

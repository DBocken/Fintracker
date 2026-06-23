import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldCheck, ShieldAlert, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalEncryption } from "@/components/providers/LocalEncryptionProvider";
import { useTier } from "@/hooks/useTier";
import { derivePrivacyStatus } from "@/lib/privacy-status";
import { getAnalyticsConsent } from "@/services/analytics-consent-service";
import { useI18n } from "@/i18n/useI18n";

/**
 * Privacy-Indikator (#41, #54): Schloss im Header jedes Screens.
 * Zeigt den echten Zustand der lokalen Verschlüsselung und den
 * tatsächlichen Server-Kontakt (anonym: keiner).
 */
export default function PrivacyIndicator() {
  const { t } = useI18n();
  const { enabled, unlocked } = useLocalEncryption();
  const tier = useTier();

  // Wichtig: Im Anonym-Modus darf dieser Indikator selbst keinen
  // Server-Call auslösen — Consent-Abfrage nur mit Login.
  const { data: consent } = useQuery({
    queryKey: ["analyticsConsent"],
    queryFn: getAnalyticsConsent,
    enabled: tier !== "anonymous",
    staleTime: 5 * 60 * 1000,
  });

  const status = derivePrivacyStatus(tier, consent?.opted_in ?? false);

  const Icon = enabled ? (unlocked ? ShieldCheck : Lock) : ShieldAlert;
  const iconClass = enabled ? "text-positive" : "text-muted-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("privacy.title", "Datenschutz")}>
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-3">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
          <div className="space-y-2 text-sm">
            <p className="font-semibold">
              {enabled
                ? unlocked
                  ? t("utility.encryptedAndUnlocked", "Lokal verschlüsselt & entsperrt")
                  : t("utility.encryptedAndLocked", "Lokal verschlüsselt & gesperrt")
                : t("utility.localOnly", "Daten bleiben auf deinem Gerät")}
            </p>
            <p className="text-muted-foreground">
              {enabled
                ? t("utility.staysOnDevice", "Deine Finanzdaten sind mit deinem Passwort verschlüsselt und verlassen dein Gerät nicht.")
                : t("utility.staysOnDeviceNoEncryption", "Deine Finanzdaten verlassen dein Gerät nicht. Aktiviere die Verschlüsselung für zusätzlichen Schutz.")}
            </p>

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Server className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{status.serverContactLabel}</span>
            </p>

            <div className="flex flex-col gap-1 pt-1">
              {!enabled && (
                <Link
                  to="/settings"
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  {t("privacy.enableEncryption", "Verschlüsselung aktivieren")}
                </Link>
              )}
              <Link
                to="/privacy"
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                {t("privacy.title", "Wie wir mit deinen Daten umgehen")}
              </Link>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

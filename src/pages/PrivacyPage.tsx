import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldCheck, ShieldAlert, Server, EyeOff, BarChart3, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocalEncryption } from "@/components/providers/LocalEncryptionProvider";
import { useTier } from "@/hooks/useTier";
import { derivePrivacyStatus } from "@/lib/privacy-status";
import { getAnalyticsConsent } from "@/services/analytics-consent-service";
import { useI18n } from "@/i18n/useI18n";

/**
 * Privacy-Seite (Issue #41): erklärt das Datenmodell in einfachem Deutsch.
 * Jede Aussage hier muss dem Code-Verhalten entsprechen — kein Marketing
 * über der Realität.
 */
export default function PrivacyPage() {
  const { enabled, unlocked } = useLocalEncryption();
  const tier = useTier();
  const { t } = useI18n();

  // Anonym: keine Consent-Abfrage (wäre selbst ein Server-Call).
  const { data: consent } = useQuery({
    queryKey: ["analyticsConsent"],
    queryFn: getAnalyticsConsent,
    enabled: tier !== "anonymous",
    staleTime: 5 * 60 * 1000,
  });

  const status = derivePrivacyStatus(tier, consent?.opted_in ?? false);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link
          to={tier === "anonymous" ? "/" : "/settings"}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("privacy.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("privacy.intro")}</p>
      </div>

      {/* Aktueller Status der lokalen Verschlüsselung — prominent mit CTA */}
      <Card className={enabled ? "border-positive/40" : "border-warning/40"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {enabled ? (
              <ShieldCheck className="h-5 w-5 text-positive" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
            {t("privacy.encryptionTitle")}: {enabled ? (unlocked ? t("privacy.encryptionActiveUnlocked") : t("privacy.encryptionActiveLocked")) : t("privacy.encryptionInactive")}
          </CardTitle>
          <CardDescription>
            {enabled ? t("privacy.encryptionOnDesc") : t("privacy.encryptionOffDesc")}
          </CardDescription>
        </CardHeader>
        {!enabled && (
          <CardContent>
            <Button asChild size="sm">
              <Link to="/settings">{t("privacy.enableEncryption")}</Link>
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Dein aktueller Server-Kontakt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" aria-hidden="true" />
            {t("privacy.serverContactTitle")}
          </CardTitle>
          <CardDescription>{status.serverContactLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status.sharedWithServer.length > 0 ? (
            <div>
              <p className="mb-1 font-medium">{t("privacy.sharedWithServerLabel")}</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {status.sharedWithServer.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">{t("privacy.noServerContact")}</p>
          )}
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              {t("privacy.neverLeavesLabel")}
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {status.neverShared.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Das Modell erklärt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5" aria-hidden="true" />
            {t("privacy.modelTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">{t("privacy.modelLocalFirstLabel")}</span>{" "}
            {t("privacy.modelLocalFirst")}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("privacy.modelEncryptionLabel")}</span>{" "}
            {t("privacy.modelEncryption")}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("privacy.modelLoginLabel")}</span>{" "}
            {t("privacy.modelLogin")}
          </p>
          <p>
            <span className="font-medium text-foreground">{t("privacy.modelBackupLabel")}</span>{" "}
            {t("privacy.modelBackup")}
          </p>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            {t("privacy.analyticsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("privacy.analyticsIntro")}</p>
          <ul className="list-inside list-disc space-y-1">
            <li>{t("privacy.analyticsPoint1")}</li>
            <li>{t("privacy.analyticsPoint2")}</li>
            <li>{t("privacy.analyticsPoint3")}</li>
            <li>{t("privacy.analyticsPoint4")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

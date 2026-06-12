import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Lock, ShieldCheck, ShieldAlert, Server, EyeOff, BarChart3, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocalEncryption } from "@/components/providers/LocalEncryptionProvider";
import { useTier } from "@/hooks/useTier";
import { derivePrivacyStatus } from "@/lib/privacy-status";
import { getAnalyticsConsent } from "@/services/analytics-consent-service";

/**
 * Privacy-Seite (Issue #41): erklärt das Datenmodell in einfachem Deutsch.
 * Jede Aussage hier muss dem Code-Verhalten entsprechen — kein Marketing
 * über der Realität.
 */
export default function PrivacyPage() {
  const { enabled, unlocked } = useLocalEncryption();
  const tier = useTier();

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
          Zurück
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Wie wir mit deinen Daten umgehen</h1>
        <p className="mt-2 text-muted-foreground">
          Kurz gesagt: Deine Finanzdaten bleiben auf deinem Gerät. Wir haben keine
          Cloud-Datenbank mit deinen Transaktionen — und wollen auch keine.
        </p>
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
            Lokale Verschlüsselung: {enabled ? (unlocked ? "aktiv (entsperrt)" : "aktiv (gesperrt)") : "nicht aktiviert"}
          </CardTitle>
          <CardDescription>
            {enabled
              ? "Deine Daten liegen AES-GCM-verschlüsselt auf diesem Gerät. Ohne dein Passwort sind sie nicht lesbar."
              : "Deine Daten liegen unverschlüsselt auf diesem Gerät. Mit einem Passwort schützt du sie zusätzlich — z. B. auf geteilten Geräten."}
          </CardDescription>
        </CardHeader>
        {!enabled && (
          <CardContent>
            <Button asChild size="sm">
              <Link to="/settings">Verschlüsselung aktivieren</Link>
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Dein aktueller Server-Kontakt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" aria-hidden="true" />
            Dein aktueller Server-Kontakt
          </CardTitle>
          <CardDescription>{status.serverContactLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status.sharedWithServer.length > 0 ? (
            <div>
              <p className="mb-1 font-medium">Das geht zum Server (weil du angemeldet bist):</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {status.sharedWithServer.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Du nutzt die App ohne Anmeldung. Es gibt keinen Codepfad, der deine
              Finanzdaten an einen Server sendet.
            </p>
          )}
          <div>
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <EyeOff className="h-4 w-4" aria-hidden="true" />
              Das verlässt dein Gerät nie:
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
            So funktioniert das Modell
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Lokal zuerst:</span>{" "}
            Transaktionen, Konten, Schulden und Kategorien werden in der Datenbank
            deines Browsers (IndexedDB) auf diesem Gerät gespeichert — nicht bei uns.
          </p>
          <p>
            <span className="font-medium text-foreground">Verschlüsselung:</span>{" "}
            Optional verschlüsselst du alles mit einem Passwort (AES-GCM). Das
            Passwort kennt nur dein Gerät — wir können deine Daten nicht entschlüsseln
            und auch nicht wiederherstellen, wenn du es vergisst.
          </p>
          <p>
            <span className="font-medium text-foreground">Mit Google-Login:</span>{" "}
            Zum Server gehen nur deine Anmeldung, die Bank-Anbindung
            (GoCardless-Requisition) und deine Einstellungen. Der Login ist nötig,
            weil deine Bank uns kennen muss — nicht weil wir dich kennen wollen.
          </p>
          <p>
            <span className="font-medium text-foreground">Backups & Export:</span>{" "}
            Backups sind standardmäßig verschlüsselt und landen als Datei bei dir —
            nicht auf unseren Servern. Der Export deiner Daten ist immer möglich und
            immer kostenlos.
          </p>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Aggregierte Statistik (nur mit Opt-in)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Nur wenn du angemeldet bist <span className="font-medium text-foreground">und</span> ausdrücklich
            zustimmst, senden wir aggregierte Statistik — nie einzelne Buchungen:
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Nur Summen pro Zeitraum und Kategorien-Gruppe, keine Einzeltransaktionen</li>
            <li>Gruppen mit weniger als 5 Buchungen werden komplett unterdrückt (Suppression)</li>
            <li>Das Paket wird vor dem Senden auf deinem Gerät verschlüsselt</li>
            <li>Du kannst die Zustimmung jederzeit in den Einstellungen widerrufen</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

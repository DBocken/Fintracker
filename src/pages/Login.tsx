import { useState } from "react";
import { Link } from "react-router-dom";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Landmark, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { startAnonymousMode } from "@/lib/anonymous-mode";
import { loadDemoData } from "@/services/demo-data-service";
import { getRedirectOrigin } from "@/lib/app-origin";

type LoginProps = {
  /** Wird aufgerufen, wenn der Nutzer den anonymen Modus startet (Issue #28). */
  onStartAnonymous?: () => void;
};

function Login({ onStartAnonymous }: LoginProps) {
  const isInIframe = typeof window !== "undefined" && window.top !== window.self;
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();
  const [showLogin, setShowLogin] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleStartAnonymous = () => {
    startAnonymousMode();
    onStartAnonymous?.();
  };

  // Erststart mit Beispieldaten (Issue #39): Demo laden, anonym starten und
  // direkt auf dem gefüllten Dashboard landen (Aha-Moment < 30 Sekunden).
  const handleStartDemo = async () => {
    setDemoLoading(true);
    try {
      await loadDemoData();
      startAnonymousMode();
      // Ziel-URL vor dem Router-Wechsel setzen — der App-Router übernimmt sie.
      window.history.replaceState(null, "", "/dashboard");
      onStartAnonymous?.();
    } finally {
      setDemoLoading(false);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const signInWithGoogleDirect = async () => {
    // Native: Browser-Plugin mit PKCE-Flow + Deep-Link zurück zur App
    if (isNative) {
      const redirectTo = "ausgabentracker://auth-callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true, // wir öffnen selbst den System-Browser
        },
      });

      if (error) {
        return;
      }

      if (data?.url) {
        await Browser.open({ url: data.url, windowName: "_self" });
      }
      return;
    }

    const redirectTo = `${getRedirectOrigin()}/`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground">
      {/* Brand backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-premium/10 to-transparent" />

      <Card variant="premium" className="z-10 w-full max-w-md p-6 shadow-lg">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Finanz-Copilot</div>
        </div>

        {/* Nutzenversprechen statt generischer Begrüßung (Issue #28/#39) */}
        <h1 className="mb-5 text-2xl font-bold leading-tight">
          Dein Geld heute verstehen – ohne Tabellenstress.
        </h1>

        {/* Privacy-Claim — das Kernversprechen, above the fold (Issue #28) */}
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-positive/30 bg-positive/10 p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-positive dark:text-positive" aria-hidden="true" />
          <p className="text-sm text-positive dark:text-positive">
            <span className="font-medium">Deine Daten verlassen dein Gerät nie.</span>{" "}
            Keine Cloud-Datenbank mit deinen Finanzen — keine Anmeldung nötig.
          </p>
        </div>

        {/* Primärer Weg: kostenlos & lokal starten */}
        <Button className="w-full" size="lg" onClick={handleStartAnonymous}>
          Kostenlos starten
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Deine Daten bleiben auf deinem Gerät, bis du Sync aktivierst.
        </p>

        {/* Sekundärer Weg: Google verbinden (Bankanbindung & Sync) */}
        {!showLogin && (
          <Button
            variant="outline"
            className="mt-3 w-full"
            size="lg"
            onClick={() => setShowLogin(true)}
          >
            Mit Google verbinden
          </Button>
        )}

        {/* Tertiär: erst mal nur schauen (Issue #39) */}
        <Button
          variant="ghost"
          className="mt-2 w-full text-muted-foreground"
          size="sm"
          onClick={handleStartDemo}
          disabled={demoLoading}
        >
          {demoLoading ? "Beispieldaten werden geladen…" : "Demo ansehen"}
        </Button>

        {/* Kurze Tier-Erklärung */}
        <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">Ohne Anmeldung:</span>{" "}
              CSV-Import, Analysen, Coach und Schulden-Planung — komplett lokal.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">Mit Google-Login:</span>{" "}
              Bankanbindung und Profil — nötig, weil deine Bank uns kennen muss, nicht weil
              wir dich kennen wollen.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium text-foreground">Premium:</span>{" "}
              Tiefere Analysen und Simulationen — folgt später.
            </span>
          </li>
        </ul>

        {/* Google-Login: eingeblendet nach "Mit Google verbinden" */}
        {showLogin && (
          <div className="mt-6 border-t pt-4">
            <Auth
              supabaseClient={supabase}
              providers={["google"]}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "hsl(var(--primary))",
                      brandAccent: "hsl(var(--primary))",
                      brandButtonText: "hsl(var(--primary-foreground))",
                      inputBackground: "hsl(var(--background))",
                      inputText: "hsl(var(--foreground))",
                      inputBorder: "hsl(var(--border))",
                      inputLabelText: "hsl(var(--muted-foreground))",
                      messageText: "hsl(var(--muted-foreground))",
                      anchorTextColor: "hsl(var(--muted-foreground))",
                    },
                    radii: {
                      borderRadiusButton: "0.5rem",
                      inputBorderRadius: "0.5rem",
                    },
                  },
                },
              }}
            />

            {isNative && (
              <div className="mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-brand text-white hover:bg-brand"
                  onClick={signInWithGoogleDirect}
                >
                  Google Login (Mobile)
                </Button>
              </div>
            )}

            {isInIframe && (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-warning dark:text-warning">
                <div className="text-xs">
                  Hinweis: Google verhindert Anmeldungen im eingebetteten Vorschaufenster (Iframe). Öffne die
                  Anmeldung im neuen Tab oder führe den Google‑Login direkt aus.
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-warning/50 text-warning hover:bg-warning/10 dark:text-warning"
                    onClick={openInNewTab}
                  >
                    Im neuen Tab öffnen
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-brand text-white hover:bg-brand"
                    onClick={signInWithGoogleDirect}
                  >
                    Google Login (direkt)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Link zur Privacy-Seite (Issue #41) */}
        <div className="mt-4 text-center">
          <Link
            to="/privacy"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Wie wir mit deinen Daten umgehen
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default Login;

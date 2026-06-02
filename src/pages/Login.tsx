"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

function Login() {
  const isInIframe = typeof window !== "undefined" && window.top !== window.self;
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();

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

    // Web: Standard-Redirect zurück auf die aktuelle Origin
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      {/* Brand backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-600/10 to-transparent" />

      <Card variant="premium" className="z-10 w-full max-w-md p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Finanz-Copilot</div>
            <div className="text-base font-semibold">Willkommen zurück</div>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">
          Dein persönlicher Finanzcoach. Melde dich an, um deine nächsten Schritte zu sehen.
        </p>

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
              className="bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={signInWithGoogleDirect}
            >
              Google Login (Mobile)
            </Button>
          </div>
        )}

        {isInIframe && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-200">
            <div className="text-xs">
              Hinweis: Google verhindert Anmeldungen im eingebetteten Vorschaufenster (Iframe). Öffne die
              Anmeldung im neuen Tab oder führe den Google‑Login direkt aus.
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-200"
                onClick={openInNewTab}
              >
                Im neuen Tab öffnen
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={signInWithGoogleDirect}
              >
                Google Login (direkt)
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Login;

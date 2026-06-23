import { useState } from "react";
import { User as UserIcon, Settings as SettingsIcon, EyeOff, KeyRound, Sparkles, Check } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { showSuccess, showError } from "@/utils/toast";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/services/transaction-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SKINS, type SkinId, applySkinClass } from "@/skins/skins";
import { useGentleMode } from "@/components/providers/GentleModeProvider";
import { useTier, TIER_OVERRIDE_EVENT } from "@/hooks/useTier";
import { setTierOverride, clearTierOverride } from "@/lib/tier";
import { useI18n } from "@/i18n/useI18n";

function normalizeSkinId(raw?: string | null): SkinId {
  if (!raw) return 'ruhe';
  if (raw.startsWith('clean-')) return 'clean';
  if (raw === 'clean') return 'clean';
  if (raw === 'neon') return 'neon';
  if (raw === 'legacy') return 'legacy';
  return 'ruhe';
}

export function UserProfile() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enabled: gentleModeEnabled, toggle: toggleGentleMode } = useGentleMode();
  const tier = useTier();
  const isPremium = tier === "premium";
  const [accessCode, setAccessCode] = useState("");

  const handleUnlock = () => {
    const unlocked = setTierOverride(accessCode);
    if (unlocked) {
      window.dispatchEvent(new Event(TIER_OVERRIDE_EVENT));
      setAccessCode("");
      showSuccess("Premiumzugang freigeschaltet");
    } else {
      showError(t("auth.invalidCode", "Code ungültig"));
    }
  };

  const handleRemoveAccess = () => {
    clearTierOverride();
    window.dispatchEvent(new Event(TIER_OVERRIDE_EVENT));
    showSuccess("Zugang entfernt");
  };

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const skin: SkinId = normalizeSkinId(settings?.theme);

  const updateSkinMutation = useMutation({
    mutationFn: (nextSkin: SkinId) => updateUserSettings({ theme: nextSkin }),
    onSuccess: (_data, nextSkin) => {
      // Sofort anwenden + persistieren
      applySkinClass(nextSkin);
      localStorage.setItem("skin", nextSkin);
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      showSuccess("Theme gespeichert");
    },
    onError: () => showError("Fehler beim Speichern des Themes"),
  });

  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email ||
    "Unbekannter Nutzer";
  const email = user?.email || "";

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* Sitzt in der dunklen Sidebar → Sidebar-Tokens statt Content-Tokens. */}
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-sidebar-muted transition-colors hover:bg-sidebar-accent/50">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials || <UserIcon className="h-4 w-4" />}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-sidebar-muted truncate">
              {email}
            </div>
            <div className="text-[11px] text-positive">
              Angemeldet
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <Card variant="premium">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
              {initials || <UserIcon className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-base">
                {displayName}
              </CardTitle>
              <CardDescription className="text-xs">
                {email}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="rounded-full bg-positive/10 px-2 py-0.5 text-xs text-positive">
                Angemeldet
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Nutzer-ID</span>
              <span className="text-xs font-mono text-muted-foreground">
                {user?.id || "—"}
              </span>
            </div>

            <div className="pt-2">
              <div className="mb-1 text-xs text-muted-foreground">Theme wählen</div>
              <Select
                value={skin}
                onValueChange={(v) => updateSkinMutation.mutate(v as SkinId)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("utility.selectSkin", "Skin wählen")} />
                </SelectTrigger>
                <SelectContent>
                  {SKINS.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Hinweis: Helles/Dunkles Erscheinungsbild schaltest du über den Schalter oben um.
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sanfter Modus</span>
              </div>
              <Switch
                checked={gentleModeEnabled}
                onCheckedChange={() => toggleGentleMode()}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Versteckt Beträge und zeigt Fortschritt statt Salden.
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">Beta- & Premiumzugang</span>
                </div>
                {isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-premium/10 px-2 py-0.5 text-[11px] text-premium">
                    <Sparkles className="h-3 w-3" />
                    Alpha
                  </span>
                )}
              </div>

              {isPremium ? (
                <div className="mt-2 space-y-2">
                  <ul className="space-y-1 text-[11px] text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-positive" /> Erweiterte Analysen
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-positive" /> Monate vergleichen
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-positive" /> Simulation & Trading
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={handleRemoveAccess}
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Zugang entfernen
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Du hast einen Alpha-Code? Gib ihn ein, um Premiumfunktionen freizuschalten.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder="Zugangscode"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUnlock();
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs"
                      disabled={!accessCode.trim()}
                      onClick={handleUnlock}
                    >
                      Freischalten
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Deine Anmeldung wird über Supabase verwaltet. Du kannst dich per
              E‑Mail registrieren oder mit Google anmelden.
            </p>
          </CardContent>

          <CardFooter className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              type="button"
            >
              <SettingsIcon className="mr-1 h-3 w-3" />
              Profil
            </Button>
            <LogoutButton className="text-xs text-muted-foreground" />
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default UserProfile;
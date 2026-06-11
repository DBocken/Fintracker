import { User as UserIcon, LogOut, Settings as SettingsIcon } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/services/transaction-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SKINS, type SkinId, applySkinClass } from "@/skins/skins";

function normalizeSkinId(raw?: string | null): SkinId {
  if (!raw) return 'legacy';
  if (raw.startsWith('clean-')) return 'clean';
  if (raw === 'clean') return 'clean';
  if (raw === 'neon') return 'neon';
  if (raw === 'legacy') return 'legacy';
  return 'legacy';
}

export function UserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/60">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
            {initials || <UserIcon className="h-4 w-4" />}
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-foreground truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {email}
            </div>
            <div className="text-[11px] text-emerald-500">
              Angemeldet
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <Card variant="premium">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
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
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
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
                  <SelectValue placeholder="Skin wählen" />
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
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                showSuccess("Abgemeldet");
              }}
            >
              <LogOut className="mr-1 h-3 w-3" />
              Abmelden
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default UserProfile;
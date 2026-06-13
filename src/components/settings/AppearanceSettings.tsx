import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/services/transaction-service';
import { SKINS, type SkinId, applySkinClass } from '@/skins/skins';
import { ThemeToggle } from '@/components/ThemeToggle';
import { showError, showSuccess } from '@/utils/toast';

function normalizeSkinId(raw?: string | null): SkinId {
  if (!raw) return 'ruhe';
  if (raw.startsWith('clean-') || raw === 'clean') return 'clean';
  if (raw === 'neon') return 'neon';
  if (raw === 'legacy') return 'legacy';
  return 'ruhe';
}

// Kurzbeschreibungen, damit die Theme-Auswahl selbsterklärend ist.
const SKIN_DESCRIPTIONS: Record<SkinId, string> = {
  ruhe: 'Sandfarben & ruhig — der Standard',
  legacy: 'Klassisch, neutrale Graustufen',
  clean: 'Klare Kontraste, blauer Akzent',
  neon: 'Dunkle Bühne mit Neon-Akzenten',
};

export function AppearanceSettings() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const skin: SkinId = normalizeSkinId(settings?.theme);

  const updateSkinMutation = useMutation({
    mutationFn: (nextSkin: SkinId) => updateUserSettings({ theme: nextSkin }),
    onSuccess: (_data, nextSkin) => {
      applySkinClass(nextSkin);
      localStorage.setItem('skin', nextSkin);
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      showSuccess('Theme gespeichert');
    },
    onError: () => showError('Fehler beim Speichern des Themes'),
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Theme</CardTitle>
          <CardDescription>Wähle den Look der gesamten Oberfläche.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SKINS.map((option) => {
              const isActive = option.id === skin;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateSkinMutation.mutate(option.id)}
                  aria-pressed={isActive}
                  className={`flex items-start justify-between gap-2 rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-brand bg-brand/10'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{option.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {SKIN_DESCRIPTIONS[option.id]}
                    </div>
                  </div>
                  {isActive && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Heller / Dunkler Modus</CardTitle>
          <CardDescription>Wechsle unabhängig vom Theme zwischen heller und dunkler Darstellung.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Darstellung umschalten</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AppearanceSettings;

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import FinanceErrorState from '@/components/common/FinanceErrorState';
import { showSuccess, showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import { getTaxYearProfile, saveTaxYearProfile } from '@/services/tax-profile-service';

function numOrEmpty(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export function TaxCommuteCard({ year }: { year: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // WP-9.6: Die Eingabefelder starten leer. Ein Lesefehler liest sich damit
  // als „noch nichts eingetragen" — und der Speichern-Knopf ueberschreibt die
  // echten Werte mit Leere.
  const {
    data: profile,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['taxYearProfile', year],
    queryFn: () => getTaxYearProfile(year),
  });

  const [days, setDays] = useState('');
  const [km, setKm] = useState('');
  const [homeoffice, setHomeoffice] = useState('');

  useEffect(() => {
    setDays(numOrEmpty(profile?.commuteDaysPerYear));
    setKm(numOrEmpty(profile?.commuteOneWayKm));
    setHomeoffice(numOrEmpty(profile?.homeofficeDays));
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      saveTaxYearProfile(year, {
        commuteDaysPerYear: days ? Number(days) : null,
        commuteOneWayKm: km ? Number(km) : null,
        homeofficeDays: homeoffice ? Number(homeoffice) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxYearProfile', year] });
      showSuccess(t('tax.commute.saved', 'Gespeichert'));
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('tax.commute.title', 'Arbeitsweg & Homeoffice')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('tax.commute.description', '')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {profileError && (
          <FinanceErrorState variant="data" onRetry={() => void refetchProfile()} />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="commute-days">{t('tax.commute.daysLabel', 'Arbeitstage mit Fahrt')}</Label>
            <Input id="commute-days" type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="commute-km">{t('tax.commute.kmLabel', 'einfache Entfernung (km)')}</Label>
            <Input id="commute-km" type="number" min={0} value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="commute-homeoffice">{t('tax.commute.homeofficeLabel', 'Homeoffice-Tage')}</Label>
            <Input
              id="commute-homeoffice"
              type="number"
              min={0}
              value={homeoffice}
              onChange={(e) => setHomeoffice(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {t('common.save', 'Speichern')}
        </Button>
      </CardContent>
    </Card>
  );
}

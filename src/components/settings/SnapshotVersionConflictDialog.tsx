import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InfoStatStrip } from '@/components/common/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import type { SnapshotStandInfo, SnapshotVersionComparison } from '@/lib/snapshot-comparison';

/**
 * Bestätigungsdialog für RES-4 (Sync-Import: Versionsvergleich): zeigt beide
 * Stände nebeneinander — Version UND Datum, nicht nur „älter"/„neuer" — damit
 * der Nutzer entscheiden kann, was er beim Fortfahren verliert. Reine
 * Anzeige/Bestätigung, keine eigene Vergleichslogik (die steht im Service,
 * `compareSnapshotForImport`).
 */
export function SnapshotVersionConflictDialog({
  comparison,
  open,
  onConfirm,
  onCancel,
}: {
  comparison: SnapshotVersionComparison | null;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();

  const dateLocale = locale === 'de' ? 'de-DE' : locale === 'ru' ? 'ru-RU' : 'en-US';

  function formatStand(stand: SnapshotStandInfo | undefined) {
    if (!stand || stand.createdAt === null) return t('privacy.privacySync.versionConflictUnknown');
    const versionLabel = t('privacy.privacySync.versionConflictVersionLabel').replace('{version}', String(stand.version));
    return `${versionLabel} · ${new Date(stand.createdAt).toLocaleDateString(dateLocale)}`;
  }

  const stats = [
    { label: t('privacy.privacySync.versionConflictDeviceStand'), value: formatStand(comparison?.local) },
    { label: t('privacy.privacySync.versionConflictFileStand'), value: formatStand(comparison?.remote) },
  ];

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('privacy.privacySync.versionConflictTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {comparison?.isForeignDevice
              ? t('privacy.privacySync.versionConflictDescriptionForeign')
              : t('privacy.privacySync.versionConflictDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <InfoStatStrip items={stats} />

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('privacy.privacySync.versionConflictCancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('privacy.privacySync.versionConflictConfirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

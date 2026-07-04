/**
 * Template für i18n-kompatible Komponenten
 *
 * Kopiere diesen Template und passe an:
 * 1. ComponentName
 * 2. Translations in src/i18n/translations.ts
 * 3. Test-File nach __tests__/
 */

import { useI18n } from "@/i18n/useI18n";

export default function ComponentName() {
  const { t } = useI18n();

  return (
    <div>
      {/* Alle sichtbaren Texte gehen über t() */}
      <h1>{t("componentName.title")}</h1>
      <p>{t("componentName.description")}</p>
    </div>
  );
}

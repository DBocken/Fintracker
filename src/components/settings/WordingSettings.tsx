import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/i18n/useI18n';
import { lookupTranslation, lookupWorded } from '@/i18n/I18nProvider';
import { SUPPORTED_WORDINGS, type Wording } from '@/i18n/wording';
import { GLOSSARY_TERM_IDS, glossaryDefinitionKey, glossaryTermKey } from '@/i18n/glossary';
import { overlayFor } from '@/i18n/overlays';

/**
 * Sprachstil-Wahl plus vollständiges Glossar.
 *
 * Der Schalter steht bewusst NEBEN der Sprachwahl: beide betreffen, wie die App
 * spricht. Das Glossar direkt darunter macht die Achse auffindbar, ohne dass
 * man zufällig über einen unterstrichenen Begriff stolpern muss — der
 * „dauerhaft sichtbare Ausgang" aus docs/tutorial-progressive-disclosure.md.
 */
export function WordingSettings() {
  const { locale, wording, setWording, t } = useI18n();

  // Ohne Overlay für diese Sprache wäre der Schalter eine leere Zusage.
  const hasOverlay = SUPPORTED_WORDINGS.some((w) => overlayFor(w, locale) !== undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.wording.title')}</CardTitle>
        <CardDescription>
          {hasOverlay
            ? t('settings.wording.description')
            : t('settings.wording.unavailableForLocale')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Select
          value={wording}
          onValueChange={(value) => setWording(value as Wording)}
          disabled={!hasOverlay}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_WORDINGS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`settings.wording.option.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{t('glossary.title')}</p>
          <p className="text-xs text-muted-foreground">{t('glossary.description')}</p>
          <dl className="divide-y divide-border">
            {GLOSSARY_TERM_IDS.map((id) => {
              const termKey = glossaryTermKey(id);
              const current = t(termKey);
              const technical = lookupTranslation(locale, termKey) ?? current;
              const everyday = lookupWorded(locale, termKey, 'everyday') ?? current;
              const alternative = current === technical ? everyday : technical;
              const alternativeLabel =
                current === technical ? t('glossary.alsoEveryday') : t('glossary.alsoTechnical');

              return (
                <div key={id} className="py-3">
                  <dt className="text-sm font-medium text-foreground">{current}</dt>
                  <dd className="text-xs text-muted-foreground">
                    {t(glossaryDefinitionKey(id))}
                  </dd>
                  {alternative !== current ? (
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {alternativeLabel}: <span className="text-foreground">{alternative}</span>
                    </dd>
                  ) : null}
                </div>
              );
            })}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export default WordingSettings;

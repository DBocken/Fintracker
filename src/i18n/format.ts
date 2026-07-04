/**
 * Helper-Funktionen für dynamische, lokalisierte Strings
 * (Pluralisierung, Datums-Labels, Template-Ersetzung)
 */

type T = (key: string, fallback?: string) => string;

export function formatDaysUntil(daysUntil: number, t: T): string {
  if (daysUntil <= 0) return t('common.today');
  if (daysUntil === 1) return t('common.tomorrow');
  return t('common.inDays').replace('{days}', String(daysUntil));
}

export function formatCoachDaysUntil(daysUntil: number, t: T): string {
  if (daysUntil <= 0) return t('coach.whenToday');
  if (daysUntil === 1) return t('coach.whenTomorrow');
  return t('coach.whenInDays').replace('{days}', String(daysUntil));
}

export function pluralize(
  count: number,
  singularKey: string,
  pluralKey: string,
  t: T,
): string {
  return count === 1 ? t(singularKey) : t(pluralKey);
}

export function pluralTransactions(count: number, t: T): string {
  return pluralize(count, 'common.singularTransaction', 'common.pluralTransaction', t);
}

export function pluralCharges(count: number, t: T): string {
  return pluralize(count, 'common.singularCharge', 'common.pluralCharge', t);
}

/**
 * Template-String ersetzen: {key} → Wert
 * z.B. replaceTemplate("in {days} Tagen", { days: 5 }) → "in 5 Tagen"
 */
export function replaceTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(values[key] ?? ''));
}

/**
 * Jahresbezogenes Steuer-Profil: Werte, die für exakt berechenbare Pauschalen
 * (Pendler-/Homeoffice-Pauschale) nötig sind, aber NICHT aus einzelnen
 * Transaktionen ableitbar sind (km, Arbeitstage). Lokal-first, pro
 * Veranlagungszeitraum, mit stabiler ID `tax-profile-<year>`.
 */
import { readLocalFinanceList, upsertLocalFinanceItem } from './local-finance-store';

export interface TaxYearProfile {
  id: string;
  year: number;
  /** Arbeitstage mit Arbeitsweg (für die Entfernungspauschale). */
  commuteDaysPerYear?: number | null;
  /** Einfache Entfernung Wohnung–Arbeit in km. */
  commuteOneWayKm?: number | null;
  /** Anzahl Homeoffice-Tage (für die Homeoffice-Pauschale). */
  homeofficeDays?: number | null;
  created_at?: string;
  updated_at?: string;
}

const KEY = 'taxYearProfiles' as const;

function profileId(year: number): string {
  return `tax-profile-${year}`;
}

export async function getTaxYearProfile(year: number): Promise<TaxYearProfile | null> {
  const all = await readLocalFinanceList<TaxYearProfile>(KEY);
  return all.find((p) => p.id === profileId(year)) ?? null;
}

export async function getAllTaxYearProfiles(): Promise<TaxYearProfile[]> {
  return readLocalFinanceList<TaxYearProfile>(KEY);
}

/**
 * Legt das Profil eines Jahres an oder aktualisiert es (Upsert über stabile ID).
 * Negative Eingaben werden auf null normalisiert (0 wird als „nicht gesetzt"
 * behandelt, damit die Pauschalen 0 € liefern statt eines Rechenfehlers).
 */
export async function saveTaxYearProfile(
  year: number,
  values: Pick<TaxYearProfile, 'commuteDaysPerYear' | 'commuteOneWayKm' | 'homeofficeDays'>,
): Promise<TaxYearProfile> {
  const norm = (v: number | null | undefined): number | null =>
    v === null || v === undefined || Number.isNaN(v) || v < 0 ? null : v;

  return upsertLocalFinanceItem<TaxYearProfile>(KEY, {
    id: profileId(year),
    year,
    commuteDaysPerYear: norm(values.commuteDaysPerYear),
    commuteOneWayKm: norm(values.commuteOneWayKm),
    homeofficeDays: norm(values.homeofficeDays),
  });
}

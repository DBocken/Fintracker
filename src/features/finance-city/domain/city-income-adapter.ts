/**
 * Einnahmen-Adapter der 3D-Finanzstadt (WP-D5, Einnahmen-Tab): bildet die
 * geteilte Einkommensstrom-Ableitung (`@/lib/income-streams#deriveIncomeStreams`
 * — KEINE eigene Aggregation hier, AGENTS.md §8) auf das kanonische
 * `CityModel` ab. Reine Funktion ohne React/three.js (README-Architekturtabelle).
 *
 * Mapping (dieselbe Stadt-Grammatik wie der Ausgaben-Tab):
 * - **Distrikt** = Einnahmen-Hauptkategorie (z. B. Gehalt, Kapitalerträge) —
 *   gruppiert über `stream.mainCategoryId`, nach Gesamtbetrag absteigend.
 * - **Gebäude** = eine Einnahmequelle (Strom: Arbeitgeber/Zahler),
 *   `amount` = `totalInWindow`. Regelmäßige Ströme tragen ihre nächste
 *   erwartete Zahlung (`nextPayment`) für das Vertrags-Sheet.
 * - **Etage** = ein MONAT des Stroms („jeder Monat ein Stockwerk"): Label
 *   `MM/yyyy`, Betrag = Monatssumme, `bookings` = die Einzelzahlungen des
 *   Monats. Deckelung analog zur Händler-Regel des Ausgaben-Tabs: die 5
 *   neuesten Monate bleiben eigene Etagen, ältere werden zu EINER
 *   „Frühere Monate"-Etage zusammengefasst.
 *
 * Farbwelt: eigene Grün-/Teal-Palette (kühler als die Ausgaben-Palette),
 * damit sofort erkennbar ist, in welcher Welt man sich befindet.
 *
 * Geld-Regeln: Monats-/Distrikt-Summen ausschließlich über Integer-Cent
 * (`toMinor`/`sumMinor`), Rückgabe als Anzeige-Euro (`toMajor`) — konsistent
 * mit `city-merchant-floors.ts`.
 */

import { t } from '@/i18n/serviceT';
import { toMinor, toMajor, sumMinor } from '@/lib/money';
import type { IncomeStream, IncomeStreamPayment, IncomeStreamsResult } from '@/lib/income-streams';
import type { CityBooking, CityContract, CityDistrict, CityModel, CitySubcategory } from './city-model';

/** Neueste Monate als eigene Etagen; ältere werden gebündelt (analog `MAX_NAMED_MERCHANTS`). */
const MAX_NAMED_MONTHS = 5;
/** Exportiert für das Vertrags-Sheet: die Bündel-Etage hat keinen einzelnen Monat. */
export const EARLIER_MONTHS_FLOOR_ID = '__earlier';

/**
 * Grün-/Teal-Palette der Einnahmen-Distrikte — bewusst getrennt von
 * `CITY_DISTRICT_PALETTE` (Ausgaben): die Einnahmen-Welt ist durchgehend
 * kühl/grün, Unterscheidbarkeit kommt aus der Helligkeits-/Tonspreizung.
 */
// Kräftige Töne (WP-D6, Nutzer-Befund "Farben nicht gut zu sehen") — analog
// zur Ausgaben-Palette hochgesättigt, bleibt aber in der kühlen Grün-Familie.
const INCOME_DISTRICT_PALETTE = [
  '#10b981', // Smaragd
  '#0d9488', // Petrol
  '#22c55e', // Grün
  '#2dd4bf', // Türkis
  '#65a30d', // Blattgrün
  '#34d399', // Jade
] as const;

function incomeDistrictColor(index: number): string {
  return INCOME_DISTRICT_PALETTE[index % INCOME_DISTRICT_PALETTE.length];
}

function earlierMonthsLabel(): string {
  return t('financeCity.earlierMonths', 'Frühere Monate');
}

/** `yyyy-MM` → Anzeige `MM/yyyy` (locale-neutral, keine Monatsnamen-Lokalisierung nötig). */
function monthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-');
  return `${month}/${year}`;
}

function toCityBooking(payment: IncomeStreamPayment & { txId: string }): CityBooking {
  return { txId: payment.txId, date: payment.dateISO, amount: payment.amount, payee: payment.payee };
}

/**
 * Etagen eines Stroms: ein Monat je Etage (neueste zuerst kommt aus der
 * `payments`-Sortierung), gedeckelt auf `MAX_NAMED_MONTHS` + „Frühere Monate".
 * Deep-Link je Etage: Zahler-Suche; eine Kategorie wird nur gesetzt, wenn der
 * Strom eine ECHTE Kategorie trägt (`mainCategoryId` kann die synthetische
 * „unkategorisiert"-Id sein — die würde auf der Buchungsseite nichts matchen).
 */
function buildFloorsForStream(stream: IncomeStream, categoryIdIsReal: boolean): CityContract[] {
  const byMonth = new Map<string, IncomeStreamPayment[]>();
  for (const payment of stream.payments) {
    const month = payment.dateISO.slice(0, 7);
    const list = byMonth.get(month);
    if (list) list.push(payment);
    else byMonth.set(month, [payment]);
  }

  const filter: CityContract['filter'] = {
    ...(categoryIdIsReal && stream.mainCategoryId ? { categoryId: stream.mainCategoryId } : {}),
    search: stream.label,
  };

  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])); // neueste zuerst
  const named = months.slice(0, MAX_NAMED_MONTHS);
  const earlier = months.slice(MAX_NAMED_MONTHS);

  const toFloor = (id: string, label: string, payments: IncomeStreamPayment[]): CityContract => ({
    id,
    label,
    amount: toMajor(sumMinor(payments.map((p) => toMinor(p.amount)))),
    bookings: payments
      .filter((p): p is IncomeStreamPayment & { txId: string } => typeof p.txId === 'string')
      .map(toCityBooking),
    filter,
  });

  const floors = named.map(([month, payments]) => toFloor(`${stream.key}:${month}`, monthLabel(month), payments));
  if (earlier.length > 0) {
    floors.push(
      toFloor(
        `${stream.key}:${EARLIER_MONTHS_FLOOR_ID}`,
        earlierMonthsLabel(),
        earlier.flatMap(([, payments]) => payments),
      ),
    );
  }
  return floors;
}

/**
 * Baut das `CityModel` des Einnahmen-Tabs aus dem Stream-Ergebnis. Keine
 * Ströme -> `{ districts: [] }` (die Page zeigt dann den Empty-State).
 */
export function buildCityModelFromIncomeStreams(result: IncomeStreamsResult): CityModel {
  const byMain = new Map<string, { name: string; realCategory: boolean; streams: IncomeStream[] }>();
  for (const stream of result.streams) {
    const mainKey = stream.mainCategoryId ?? '__none';
    // Synthetische „unkategorisiert"-Ids (`resolveHierarchy`-Fallback, beginnt
    // mit `__`) sind KEINE Kategorie-Ids — kein Kategorie-Deep-Link dafür.
    const realCategory = Boolean(stream.mainCategoryId && !stream.mainCategoryId.startsWith('__'));
    const group = byMain.get(mainKey);
    if (group) group.streams.push(stream);
    else byMain.set(mainKey, { name: stream.mainCategoryName, realCategory, streams: [stream] });
  }

  const districts: CityDistrict[] = [...byMain.entries()].map(([mainKey, group]) => {
    const subcategories: CitySubcategory[] = group.streams.map((stream) => ({
      id: stream.key,
      label: stream.label,
      amount: stream.totalInWindow,
      contracts: buildFloorsForStream(stream, group.realCategory),
      ...(stream.nextDateISO !== null && stream.nextAmount !== null
        ? { nextPayment: { dateISO: stream.nextDateISO, amount: stream.nextAmount } }
        : {}),
    }));

    return {
      id: `income:${mainKey}`,
      label: group.name,
      color: '', // Farbe nach der Sortierung per Index (deterministisch, s. u.).
      total: toMajor(sumMinor(group.streams.map((s) => toMinor(s.totalInWindow)))),
      subcategories,
    };
  });

  districts.sort((a, b) => b.total - a.total);
  districts.forEach((district, index) => {
    district.color = incomeDistrictColor(index);
  });

  return { districts };
}

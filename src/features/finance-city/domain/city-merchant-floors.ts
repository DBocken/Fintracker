/**
 * Etagen-Aggregation der 3D-Finanzstadt (WP-E2, Nutzer-Befund: eine einzelne,
 * NICHT wiederkehrende Buchung — z. B. Aldi oder eine einmalige Zeitungs-
 * Buchung — tauchte bisher gar nicht als eigene Etage auf, weil Etagen zuvor
 * ausschließlich aus `computeContracts` (`@/lib/contract-derivation`) kamen und
 * dieses Händler mit weniger als `minCount` Buchungen überspringt).
 *
 * Neue Regel: **Etage = Händler innerhalb einer Unterkategorie**, unabhängig
 * von Wiederkehr. Ein Gebäude (Unterkategorie, `subId ?? mainId` — dieselbe
 * Konvention wie `city-data-adapter.ts`) zerfällt beim Eintauchen in je eine
 * Etage pro Händler (`merchantFingerprint`), die dort gebucht hat — Netflix/
 * Spotify fallen dabei automatisch als eigene Etagen heraus, Aldi/Zeitung
 * jetzt ebenso.
 *
 * Reine Funktion ohne React/three.js-Import (README-Architekturtabelle,
 * `domain/`). Geldbeträge werden NUR über `@/lib/money.ts` in Integer-Cent
 * aufsummiert (AGENTS.md §8, kein roher Float-`reduce` über Beträge) und erst
 * am Ende zurück nach Euro gewandelt — `CityContract.amount` bleibt wie bisher
 * Anzeige-Euro (Float), konsistent mit `CitySubcategory.amount`.
 */
import { resolveHierarchy } from '@/lib/analysis-data';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import { toMinor, toMajor, sumMinor } from '@/lib/money';
import { t } from '@/i18n/serviceT';
import type { Transaction, Category } from '@/types';
import type { CityContract } from './city-model';

/** Ab dieser Händleranzahl (exklusive) wird gedeckelt: Top 5 + EINE "Sonstige"-Etage (maximal 6 Etagen). */
const MAX_NAMED_MERCHANTS = 5;
const OTHER_MERCHANTS_FLOOR_ID = '__other';

function otherMerchantsLabel(): string {
  return t('financeCity.otherMerchants', 'Sonstige');
}

/** Eine einzelne Buchung, gesammelt für die spätere Cent-genaue Aggregation je Händler. */
type MerchantBooking = { payee: string; absMinor: number };

/**
 * Baut je Gebäude (Unterkategorie-Id, `subId ?? mainId`) die Liste der
 * Etagen — ein Eintrag je Händler (`merchantFingerprint`), über alle
 * Buchungen dieses Händlers in diesem Gebäude aufsummiert.
 *
 * Übersprungen werden: interne Überträge (`is_transfer`), nicht-negative
 * Beträge (Einnahmen/Nullbuchungen — nur Ausgaben werden Etagen) und
 * Buchungen ohne `category_id`. Ist die Kategorie selbst nicht auflösbar
 * (z. B. gelöschte/unbekannte `category_id`), wird die Buchung ebenfalls
 * übersprungen statt mit einer sinnlosen "unkategorisiert"-Gebäude-Id
 * einzugehen (kein Crash).
 *
 * Deckelung je Gebäude: mehr als `MAX_NAMED_MERCHANTS` (5) Händler -> die
 * Top 5 (nach Gesamtbetrag absteigend) bleiben eigene Etagen, der Rest wird
 * zu EINER "Sonstige"-Etage zusammengefasst (maximal 6 Etagen je Gebäude).
 */
export function buildMerchantFloorsByBuilding(
  transactions: Transaction[],
  categoriesById: Map<string, Category>,
): Map<string, CityContract[]> {
  // Gebäude-Id -> Fingerprint -> alle Einzelbuchungen dieses Händlers (Cent-Summierung erst am Ende).
  const bookingsByBuilding = new Map<string, Map<string, MerchantBooking[]>>();

  for (const tx of transactions) {
    if (tx.is_transfer) continue;
    if (!(tx.amount < 0)) continue;
    if (!tx.category_id) continue;
    if (!categoriesById.has(tx.category_id)) continue; // Main nicht auflösbar -> überspringen statt crashen.

    const { mainId, subId } = resolveHierarchy(categoriesById, tx.category_id);
    const buildingId = subId ?? mainId;

    const fingerprint = merchantFingerprint(tx);
    const absMinor = Math.abs(toMinor(tx.amount));

    let merchants = bookingsByBuilding.get(buildingId);
    if (!merchants) {
      merchants = new Map();
      bookingsByBuilding.set(buildingId, merchants);
    }
    const bookings = merchants.get(fingerprint);
    if (bookings) bookings.push({ payee: tx.payee, absMinor });
    else merchants.set(fingerprint, [{ payee: tx.payee, absMinor }]);
  }

  const result = new Map<string, CityContract[]>();
  for (const [buildingId, merchants] of bookingsByBuilding) {
    const merchantTotals = [...merchants.entries()].map(([fingerprint, bookings]) => {
      // Label = Payee der betragshöchsten Einzelbuchung dieses Händlers.
      const representative = bookings.reduce((max, b) => (b.absMinor > max.absMinor ? b : max));
      return {
        id: fingerprint,
        label: representative.payee,
        totalMinor: sumMinor(bookings.map((b) => b.absMinor)),
      };
    });
    merchantTotals.sort((a, b) => b.totalMinor - a.totalMinor);

    let floors: { id: string; label: string; totalMinor: number }[];
    if (merchantTotals.length > MAX_NAMED_MERCHANTS + 1) {
      const top = merchantTotals.slice(0, MAX_NAMED_MERCHANTS);
      const rest = merchantTotals.slice(MAX_NAMED_MERCHANTS);
      floors = [
        ...top,
        {
          id: OTHER_MERCHANTS_FLOOR_ID,
          label: otherMerchantsLabel(),
          totalMinor: sumMinor(rest.map((r) => r.totalMinor)),
        },
      ];
    } else {
      floors = merchantTotals;
    }

    result.set(
      buildingId,
      floors.map((f): CityContract => ({ id: f.id, label: f.label, amount: toMajor(f.totalMinor) })),
    );
  }

  return result;
}

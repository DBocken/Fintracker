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
import { getCategoryContributions, resolveHierarchy } from '@/lib/analysis-data';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import { toMinor, toMajor, sumMinor, type Cents } from '@/lib/money';
import { t } from '@/i18n/serviceT';
import type { Transaction, Category, TransactionAllocation } from '@/types';
import { isRecurring } from './city-recurrence';
import type { CityContract } from './city-model';

/** Ab dieser Händleranzahl (exklusive) wird gedeckelt: Top 5 + EINE "Sonstige"-Etage (maximal 6 Etagen). */
const MAX_NAMED_MERCHANTS = 5;
/** Exportiert für das Vertrags-Sheet (WP-D4): die "Sonstige"-Etage hat keinen einzelnen Händler — ihr Buchungs-Deep-Link filtert nur nach Kategorie, nicht nach Händlernamen. */
export const OTHER_MERCHANTS_FLOOR_ID = '__other';

function otherMerchantsLabel(): string {
  return t('financeCity.otherMerchants', 'Sonstige');
}

/** Eine einzelne Buchung, gesammelt für die spätere Cent-genaue Aggregation je Händler. `txId` fehlt nur bei (praktisch nicht vorkommenden) Transaktionen ohne id — solche Buchungen zählen zur Summe, erscheinen aber nicht in der Sheet-Buchungsliste (kein Deep-Link-Ziel). */
type MerchantBooking = { payee: string; absMinor: Cents; txId?: string; date: string };

/**
 * Baut je Gebäude (Unterkategorie-Id, `subId ?? mainId`) die Liste der
 * Etagen — ein Eintrag je Händler (`merchantFingerprint`), über alle
 * Buchungen dieses Händlers in diesem Gebäude aufsummiert.
 *
 * Aufgeteilte Buchungen (`allocationsByTx`) zerfallen anteilig: Wer Kleidung
 * bei Aldi kauft und die Buchung aufteilt, bekommt den Kleidungs-Anteil als
 * Aldi-Etage im KLEIDUNGS-Gebäude — nicht den vollen Betrag bei Lebensmitteln.
 * Beides läuft über dieselbe Expansion wie Sunburst/Sankey
 * (`getCategoryContributions`), ohne Map bleibt es bei einer Kategorie je
 * Buchung.
 *
 * Übersprungen werden: interne Überträge (`is_transfer`), nicht-negative
 * Beträge (Einnahmen/Nullbuchungen — nur Ausgaben werden Etagen) und Beiträge
 * ohne zugewiesene Kategorie (`subcategory_id ?? category_id`). Ist die
 * zugewiesene Kategorie selbst nicht auflösbar (z. B. gelöscht), wird der
 * Beitrag ebenfalls übersprungen statt mit einer sinnlosen
 * "unkategorisiert"-Gebäude-Id einzugehen (kein Crash).
 *
 * Deckelung je Gebäude: mehr als `MAX_NAMED_MERCHANTS` (5) Händler -> die
 * Top 5 (nach Gesamtbetrag absteigend) bleiben eigene Etagen, der Rest wird
 * zu EINER "Sonstige"-Etage zusammengefasst (maximal 6 Etagen je Gebäude).
 */
export function buildMerchantFloorsByBuilding(
  transactions: Transaction[],
  categoriesById: Map<string, Category>,
  allocationsByTx?: Map<string, TransactionAllocation[]>,
): Map<string, CityContract[]> {
  // Gebäude-Id -> Fingerprint -> alle Einzelbuchungen dieses Händlers (Cent-Summierung erst am Ende).
  const bookingsByBuilding = new Map<string, Map<string, MerchantBooking[]>>();

  for (const tx of transactions) {
    if (tx.is_transfer) continue;
    if (!(tx.amount < 0)) continue;

    // [REGRESSION] App-Konvention der zugewiesenen Kategorie ist
    // `subcategory_id ?? category_id` (`getCategoryContributions`,
    // `analysis-data.ts` — daraus baut der Sunburst die Gebäude-Ids).
    // Vorher wurde nur `category_id` gelesen: Buchungen mit gesetzter
    // `subcategory_id` landeten unterm Hauptkategorie-Key, und das
    // Unterkategorie-Gebäude blieb beim Eintauchen ohne Etagen.
    for (const contribution of getCategoryContributions(tx, allocationsByTx)) {
      const assignedId = contribution.assignedId;
      if (!assignedId) continue;
      if (!categoriesById.has(assignedId)) continue; // Kategorie nicht auflösbar -> überspringen statt crashen.
      const absMinor = Math.abs(toMinor(contribution.amount)) as Cents;
      if (absMinor === 0) continue;

      const { mainId, subId } = resolveHierarchy(categoriesById, assignedId);
      const buildingId = subId ?? mainId;

      const fingerprint = merchantFingerprint(tx);

      let merchants = bookingsByBuilding.get(buildingId);
      if (!merchants) {
        merchants = new Map();
        bookingsByBuilding.set(buildingId, merchants);
      }
      const booking: MerchantBooking = { payee: tx.payee, absMinor, txId: tx.id, date: tx.date };
      const bookings = merchants.get(fingerprint);
      if (bookings) bookings.push(booking);
      else merchants.set(fingerprint, [booking]);
    }
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
        bookings,
      };
    });
    merchantTotals.sort((a, b) => b.totalMinor - a.totalMinor);

    let floors: { id: string; label: string; totalMinor: Cents; bookings: MerchantBooking[] }[];
    if (merchantTotals.length > MAX_NAMED_MERCHANTS + 1) {
      const top = merchantTotals.slice(0, MAX_NAMED_MERCHANTS);
      const rest = merchantTotals.slice(MAX_NAMED_MERCHANTS);
      floors = [
        ...top,
        {
          id: OTHER_MERCHANTS_FLOOR_ID,
          label: otherMerchantsLabel(),
          totalMinor: sumMinor(rest.map((r) => r.totalMinor)),
          // "Sonstige" trägt die Buchungen ALLER zusammengefassten Händler —
          // das Sheet listet sie gemischt (mit Payee je Zeile erkennbar).
          bookings: rest.flatMap((r) => r.bookings),
        },
      ];
    } else {
      floors = merchantTotals;
    }

    result.set(
      buildingId,
      floors.map(
        (f): CityContract => ({
          id: f.id,
          label: f.label,
          amount: toMajor(f.totalMinor),
          // WP-5.1: Wiederkehr aus den Buchungsdaten ableiten, die hier
          // ohnehin schon vorliegen — keine zusätzliche Query und keine
          // Rücknahme der WP-E2-Entscheidung gegen `computeContracts`.
          // Die "Sonstige"-Etage bündelt viele Händler; ihre gemischten
          // Datumsangaben ergäben eine Wiederkehr, die keinem Zahlungsstrom
          // entspricht — sie bleibt deshalb bewusst ohne Markierung.
          recurring: f.id === OTHER_MERCHANTS_FLOOR_ID ? false : isRecurring(f.bookings.map((b) => b.date)),
          // WP-D5: Deep-Link-Semantik der Ausgaben-Etage — Kategorie (Gebäude)
          // + Händler-Suche; die "Sonstige"-Etage bündelt viele Händler und
          // filtert deshalb nur nach Kategorie.
          filter: {
            categoryId: buildingId,
            ...(f.id === OTHER_MERCHANTS_FLOOR_ID ? {} : { search: f.label }),
          },
          // WP-D4 (Sheet-Buchungsliste): nach Datum absteigend (neueste zuerst,
          // ISO-Strings sind lexikografisch sortierbar); Tie-Breaker txId für
          // deterministische Reihenfolge bei gleichem Datum. Nur Buchungen MIT
          // txId — ohne id gibt es kein Deep-Link-Ziel auf der Buchungsseite.
          bookings: f.bookings
            .filter((b): b is MerchantBooking & { txId: string } => typeof b.txId === 'string')
            .sort((a, b) => b.date.localeCompare(a.date) || a.txId.localeCompare(b.txId))
            .map((b) => ({ txId: b.txId, date: b.date, amount: toMajor(b.absMinor), payee: b.payee })),
        }),
      ),
    );
  }

  return result;
}

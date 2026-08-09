import type { Ausgabenklasse, Category, Transaction, TransactionAllocation } from "@/types";
import { t as translate } from "@/i18n/serviceT";
import {
  getCategoryContributions,
  resolveAusgabenklasse,
  resolveHierarchy,
} from "@/lib/analysis-data";

// -----------------------------------------------------------------------------
// Sunburst: Superkategorie (Ausgabenklasse) -> Hauptkategorie
//
// Lag bis WP 6.6 in `analysis-data.ts` (ARCH-6, Gott-Modul mit ≥5 Themen).
// Verschoben wurde ausschließlich der Ort — Verhalten und Zusicherungen sind
// unverändert.
// -----------------------------------------------------------------------------

/**
 * Stabile IDs der vorgelagerten Ausgabenklassen (Sunburst-Innenring). Hält die
 * Hauptkategorien-Vielfalt aus dem Innenring heraus und macht Diagramme lesbar.
 */
export type SunburstSuperId = "essenziell" | "diskretionaer" | "sparen" | "unkategorisiert";

export const SUNBURST_SUPER_LABEL: Record<SunburstSuperId, string> = {
  essenziell: "Essenziell",
  diskretionaer: "Nicht-Essenziell",
  sparen: "Sparen",
  unkategorisiert: "Unkategorisiert",
};

export interface SunburstInner {
  id: string;
  name: string;
  value: number;
}
export interface SunburstOuter {
  id: string;
  parentId: string;
  name: string;
  value: number;
}
export interface SpendingSunburst {
  inner: SunburstInner[];
  outer: SunburstOuter[];
  total: number;
}

function toSuperId(klasse: Ausgabenklasse | null, hasAssignment: boolean): SunburstSuperId {
  if (!hasAssignment) return "unkategorisiert";
  if (klasse === "essenziell") return "essenziell";
  if (klasse === "sparen") return "sparen";
  return "diskretionaer"; // diskretionaer, einkommen, null
}

/**
 * Aggregiert Ausgaben zum Sunburst: Innenring = Ausgabenklasse
 * (Essenziell/Nicht-Essenziell/Sparen), Außenring = Hauptkategorie je Klasse.
 * `transactions` sollte bereits transfer-bereinigt sein; `total` ist die Summe
 * aller Ausgaben (Absolutbeträge der negativen Beträge).
 */
export function buildSpendingSunburst(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SpendingSunburst {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const innerMap = new Map<string, SunburstInner>();
  const outerMap = new Map<string, SunburstOuter>();
  let total = 0;

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount < 0)) continue;

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      // Negative Buchungen in einer Einkommens-Kategorie (z. B. Gehalts-
      // Rückbuchung) sind keine Ausgaben, sondern Einkommens-Korrekturen.
      // Sie gehören nicht in die Ausgaben-Aufschlüsselung.
      if (klasse === "einkommen") continue;

      const amount = Math.abs(c.amount);
      total += amount;

      const superId = toSuperId(klasse, Boolean(c.assignedId));

      const inner = innerMap.get(superId) ?? {
        id: superId,
        name: SUNBURST_SUPER_LABEL[superId],
        value: 0,
      };
      inner.value += amount;
      innerMap.set(superId, inner);

      // Unkategorisierte Ausgaben bekommen keinen Außenring (nur Innenring-Slice).
      if (superId === "unkategorisiert") continue;

      const { mainId, mainName } = resolveHierarchy(byId, c.assignedId);
      const outerKey = `${superId}::${mainId}`;
      const outer = outerMap.get(outerKey) ?? {
        id: outerKey,
        parentId: superId,
        name: mainName,
        value: 0,
      };
      outer.value += amount;
      outerMap.set(outerKey, outer);
    }
  }

  return {
    inner: [...innerMap.values()].sort((a, b) => b.value - a.value),
    outer: [...outerMap.values()].sort((a, b) => b.value - a.value),
    total,
  };
}

export interface SunburstBreakdownChild {
  /** Außenring-ID der Form `${superId}::${mainId}`. */
  id: string;
  name: string;
  value: number;
  /** Anteil am Eltern-Klassen-Wert (0..1). */
  share: number;
}
export interface SunburstBreakdownGroup {
  /** Klassen-ID (Innenring). */
  id: string;
  name: string;
  value: number;
  /** Anteil am Gesamt-Ausgabenwert (0..1). */
  share: number;
  children: SunburstBreakdownChild[];
}

/**
 * Verflacht die zwei Sunburst-Ringe in eine geordnete Eltern→Kind-Hierarchie
 * für die mobile, antippbare Aufschlüsselung. Während der Donut die tieferen
 * Ebenen nur per Hover zeigt (auf Touch unerreichbar), macht diese Struktur
 * jede Hauptkategorie je Klasse als Text + Anteilsbalken sichtbar.
 *
 * Gruppen folgen der Innenring-Reihenfolge (bereits nach Wert sortiert),
 * Kinder werden je Gruppe absteigend nach Wert sortiert. Anteile sind relativ:
 * Gruppe zur Gesamtsumme, Kind zum jeweiligen Klassen-Wert.
 */
export function buildSunburstBreakdown(sunburst: SpendingSunburst): SunburstBreakdownGroup[] {
  const childrenByParent = new Map<string, SunburstOuter[]>();
  for (const o of sunburst.outer ?? []) {
    const arr = childrenByParent.get(o.parentId) ?? [];
    arr.push(o);
    childrenByParent.set(o.parentId, arr);
  }

  const total = sunburst.total > 0 ? sunburst.total : (sunburst.inner ?? []).reduce((s, it) => s + it.value, 0);

  return (sunburst.inner ?? []).map((klasse) => {
    const rawChildren = (childrenByParent.get(klasse.id) ?? [])
      .slice()
      .sort((a, b) => b.value - a.value);
    const children: SunburstBreakdownChild[] = rawChildren.map((c) => ({
      id: c.id,
      name: c.name,
      value: c.value,
      share: klasse.value > 0 ? c.value / klasse.value : 0,
    }));
    return {
      id: klasse.id,
      name: klasse.name,
      value: klasse.value,
      share: total > 0 ? klasse.value / total : 0,
      children,
    };
  });
}

// -----------------------------------------------------------------------------
// Sunburst-Baum: mehrstufige Hierarchie (Klasse -> Hauptkategorie -> Unterkategorie)
// für das grafische, zoombare Sunburst-Diagramm.
// -----------------------------------------------------------------------------

export interface SunburstNode {
  /** Eindeutiger Pfad-Schlüssel, z. B. `essenziell::wohnen::miete`. */
  id: string;
  name: string;
  /** Ausgaben-Absolutbetrag (Summe der Nachkommen bei inneren Knoten). */
  value: number;
  /** Wurzel-Ausgabenklasse — steuert die Einfärbung über alle Ringe. */
  klasseId: SunburstSuperId;
  /** Kategorie-ID für die Navigation zu gefilterten Buchungen (null bei Klassen-Knoten). */
  categoryId: string | null;
  children: SunburstNode[];
}

export interface SunburstTree {
  total: number;
  children: SunburstNode[];
}

type SubAgg = { id: string; name: string; value: number };
type MainAgg = { id: string; name: string; value: number; directValue: number; subs: Map<string, SubAgg> };
type KlasseAgg = { id: SunburstSuperId; value: number; mains: Map<string, MainAgg>; directValue: number };

/**
 * Baut den hierarchischen Sunburst-Baum (bis zu drei Ebenen) aus Ausgaben.
 * Eltern-Werte sind exakt die Summe ihrer Kinder, damit die Ringe lückenlos
 * füllen: Hauptkategorien mit *zusätzlich* direkt (ohne Unterkategorie)
 * gebuchten Ausgaben erhalten dafür ein synthetisches „Ohne Unterkategorie"-
 * Kind. Unkategorisierte Ausgaben bleiben ein Blatt auf Klassen-Ebene.
 *
 * `transactions` sollte transfer-bereinigt sein; Einkommens-Korrekturen
 * (negative Buchungen in Einkommens-Kategorien) werden ausgenommen.
 */
export function buildSunburstTree(
  transactions: Transaction[],
  categories: Category[],
  allocationsByTx?: Map<string, TransactionAllocation[]>
): SunburstTree {
  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const klassen = new Map<SunburstSuperId, KlasseAgg>();
  let total = 0;

  const getKlasse = (id: SunburstSuperId): KlasseAgg => {
    let ka = klassen.get(id);
    if (!ka) {
      ka = { id, value: 0, mains: new Map(), directValue: 0 };
      klassen.set(id, ka);
    }
    return ka;
  };

  for (const t of transactions) {
    if (t.is_transfer) continue;
    if (!(t.amount < 0)) continue;

    for (const c of getCategoryContributions(t, allocationsByTx)) {
      const klasse = resolveAusgabenklasse(byId, c.assignedId);
      if (klasse === "einkommen") continue;

      const amount = Math.abs(c.amount);
      total += amount;

      const superId = toSuperId(klasse, Boolean(c.assignedId));
      const ka = getKlasse(superId);
      ka.value += amount;

      // Unkategorisierte Ausgaben bleiben ein Blatt — nichts zum Reinzoomen.
      if (superId === "unkategorisiert") {
        ka.directValue += amount;
        continue;
      }

      const { mainId, mainName, subId, subName } = resolveHierarchy(byId, c.assignedId);
      let ma = ka.mains.get(mainId);
      if (!ma) {
        ma = { id: mainId, name: mainName, value: 0, directValue: 0, subs: new Map() };
        ka.mains.set(mainId, ma);
      }
      ma.value += amount;

      if (subId && subName) {
        const sa = ma.subs.get(subId) ?? { id: subId, name: subName, value: 0 };
        sa.value += amount;
        ma.subs.set(subId, sa);
      } else {
        ma.directValue += amount;
      }
    }
  }

  const bySortValueDesc = <T extends { value: number }>(a: T, b: T) => b.value - a.value;

  const children: SunburstNode[] = [...klassen.values()]
    .filter((ka) => ka.value > 0)
    .sort(bySortValueDesc)
    .map((ka) => {
      const klasseNode: SunburstNode = {
        id: ka.id,
        name: SUNBURST_SUPER_LABEL[ka.id],
        value: ka.value,
        klasseId: ka.id,
        categoryId: null,
        children: [],
      };

      klasseNode.children = [...ka.mains.values()]
        .filter((ma) => ma.value > 0)
        .sort(bySortValueDesc)
        .map((ma) => {
          const mainNode: SunburstNode = {
            id: `${ka.id}::${ma.id}`,
            name: ma.name,
            value: ma.value,
            klasseId: ka.id,
            categoryId: ma.id,
            children: [],
          };

          if (ma.subs.size > 0) {
            mainNode.children = [...ma.subs.values()]
              .filter((sa) => sa.value > 0)
              .sort(bySortValueDesc)
              .map((sa) => ({
                id: `${ka.id}::${ma.id}::${sa.id}`,
                name: sa.name,
                value: sa.value,
                klasseId: ka.id,
                categoryId: sa.id,
                children: [],
              }));
            // Direkt (ohne Unterkategorie) gebuchter Rest füllt den Ring lückenlos.
            if (ma.directValue > 0) {
              mainNode.children.push({
                id: `${ka.id}::${ma.id}::__direct`,
                name: translate("analysisDataService.withoutSubcategory", "Ohne Unterkategorie"),
                value: ma.directValue,
                klasseId: ka.id,
                categoryId: ma.id,
                children: [],
              });
            }
          }

          return mainNode;
        });

      return klasseNode;
    });

  return { total, children };
}

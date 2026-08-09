/**
 * Migrationen der lokal gespeicherten Kategorien — reine Funktionen ohne I/O.
 *
 * Jede Funktion nimmt die gespeicherte Liste entgegen und liefert
 * `{ categories, changed }`. `changed` ist NUR bei echter Änderung true: Der
 * Aufrufer (`local-settings-service.readLocalCategoriesRaw`) würde sonst die
 * komplette verschlüsselte Liste bei JEDEM Lesen neu schreiben (F-CAT).
 *
 * Lagen bis WP 6.6 im Service selbst (ARCH-6). Dass sie dort lagen, war eine
 * Ablage-Gewohnheit, keine Entscheidung — sie fassen weder IndexedDB noch
 * `localStorage` an und gehören damit nach `src/lib/` (AGENTS.md §3, „Wohin ein
 * Typ gehört"). Verschoben wurde ausschließlich der Ort; Verhalten, Reihenfolge
 * und die als Altfall kommentierten Namens-Vergleiche sind unverändert.
 */

import type { Category } from "../types";
import { DEFAULT_LOCAL_CATEGORIES } from "./default-categories";

/**
 * Füllt fehlende `parent_id`-Werte (Bestandsdaten vor der Hierarchie-
 * Umstrukturierung) aus den Default-Kategorien nach. Reine Funktion (testbar):
 * `changed` ist NUR dann true, wenn tatsächlich eine parent_id ergänzt wurde —
 * damit die verschlüsselte Liste nicht bei jedem Lesen neu geschrieben wird (F-CAT).
 */
export function migrateParentIds(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  const result = categories.map((cat) => {
    if (cat.parent_id !== undefined) return cat;
    const defaultCat = DEFAULT_LOCAL_CATEGORIES.find((d) => d.id === cat.id);
    changed = true;
    return { ...cat, parent_id: defaultCat?.parent_id ?? null };
  });
  return { categories: result, changed };
}

/**
 * Ruestet `name_key` bei Bestandsdaten nach.
 *
 * Gesetzt wird der Key NUR, wenn die gespeicherte Kategorie eine Standard-ID
 * hat UND ihr Name noch exakt dem deutschen Ausgangstext entspricht. Wer eine
 * Standard-Kategorie bereits umbenannt hat, behaelt seinen Text — genau wie
 * jemand, der sie nach dieser Migration umbenennt.
 *
 * `changed` ist nur dann true, wenn wirklich ein Key ergaenzt wurde; sonst
 * wuerde die verschluesselte Liste bei jedem Lesen neu geschrieben (F-CAT).
 */
export function backfillCategoryNameKeys(categories: Category[]): { categories: Category[]; changed: boolean } {
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));
  let changed = false;

  const result = categories.map((cat) => {
    if (cat.name_key !== undefined) return cat;

    const fallback = defaultsById.get(cat.id);
    if (!fallback?.name_key) return cat;
    // Abweichender Name = die Nutzerin hat umbenannt. Nicht anfassen.
    // HISTORISCHER SEED-WERT, nicht lokalisieren: `fallback.name` ist der
    // deutsche Ausgangstext aus der Taxonomie. Verglichen wird gegen den
    // GESPEICHERTEN Namen, um "hat die Nutzerin umbenannt?" zu beantworten.
    // Diese Zeile entscheidet, ob `name_key` je nachgetragen wird — ein
    // falsch-negativer Vergleich macht die Kategorie DAUERHAFT unlokalisierbar.
    if (cat.name !== fallback.name) return cat;

    changed = true;
    return { ...cat, name_key: fallback.name_key };
  });

  return { categories: result, changed };
}

/**
 * Rüstet fehlende `ausgabenklasse`/`essenziell`-Attribute bei gespeicherten
 * Kategorien nach. Default-Kategorien werden per stabiler ID abgeglichen;
 * für übrige Kategorien wird die Ausgabenklasse von der Hauptkategorie geerbt.
 * Reine Funktion (testbar), gibt zurück ob sich etwas geändert hat.
 *
 * (Dieser Kommentarblock stand vor WP 6.6 eine Funktion zu hoch — über
 * `backfillCategoryNameKeys`, das seinen eigenen Block mitbringt. Beim Umzug
 * an die beschriebene Funktion gerückt; Verhalten unberührt.)
 */
export function backfillAusgabenklasse(categories: Category[]): { categories: Category[]; changed: boolean } {
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));
  // HISTORISCHER SEED-WERT, nicht lokalisieren: Namens-Index nur fuer
  // Cloud-Kategorien ohne `local-cat-*`-ID. Der Vergleich laeuft gegen die
  // deutschen Ausgangstexte, nicht gegen Anzeigenamen.
  const defaultsByName = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.name, c]));
  const byId = new Map(categories.map((c) => [c.id, c]));
  let changed = false;

  const result = categories.map((cat) => {
    if (cat.attributes?.ausgabenklasse) return cat;

    // 1. Direkter Abgleich mit der Default-Kategorie (gleiche ID).
    let fallback = defaultsById.get(cat.id);
    let klasse = fallback?.attributes?.ausgabenklasse;
    let essenziell = fallback?.attributes?.essenziell;

    // 2. Fallback: Abgleich nach Name (für Cloud-Kategorien ohne local-cat-* IDs).
    if (!klasse && cat.name) {
      fallback = defaultsByName.get(cat.name);
      klasse = fallback?.attributes?.ausgabenklasse;
      essenziell = fallback?.attributes?.essenziell;
    }

    // 3. Sonst von der Hauptkategorie erben.
    if (!klasse && cat.parent_id) {
      const parent = byId.get(cat.parent_id);
      const parentDefault = defaultsById.get(cat.parent_id);
      const parentDefaultByName = parent?.name ? defaultsByName.get(parent.name) : undefined;
      klasse = parent?.attributes?.ausgabenklasse ?? parentDefault?.attributes?.ausgabenklasse ?? parentDefaultByName?.attributes?.ausgabenklasse;
      essenziell = essenziell ?? parent?.attributes?.essenziell ?? parentDefault?.attributes?.essenziell ?? parentDefaultByName?.attributes?.essenziell;
    }

    if (!klasse) return cat;

    changed = true;
    return {
      ...cat,
      attributes: {
        ...cat.attributes,
        ausgabenklasse: klasse,
        essenziell: essenziell ?? cat.attributes?.essenziell,
      },
    };
  });

  return { categories: result, changed };
}

/**
 * Migriert die frühere einzelne "Einkommen"-Hauptkategorie (mit den 4
 * Unterkategorien Gehalt, Rente & Soziales, Erstattungen, Zinserträge) auf die
 * neue Mehr-Kategorien-Einkommensstruktur (Anstellung, Nebenerwerb & Selbstständigkeit,
 * Online & Creator, Verkäufe, Kapitalerträge, Staat & Soziales, Erstattungen,
 * Sonstige Einnahmen).
 *
 * Alle betroffenen IDs bleiben stabil (local-cat-einkommen/-gehalt/-erstattungen/
 * -zinsertraege/-rentesoziales) — Transaktionen referenzieren Kategorie-IDs direkt,
 * daher ist KEINE Transaktions-Migration nötig. Nutzereigene Unterkategorien unter
 * `local-cat-einkommen` werden bewusst nicht verschoben (landen unter "Sonstige
 * Einnahmen"). Vom Nutzer überschriebene Kategorien (`is_default === false`)
 * behalten Name/Filter, nur das strukturelle Reparenting wird nachgezogen.
 *
 * Reine Funktion (testbar): `changed` ist NUR dann true, wenn tatsächlich etwas
 * geändert wurde — sonst würde die verschlüsselte Liste bei jedem Lesen neu
 * geschrieben (F-CAT).
 */
// Keywords, die von Gehalt/Rente & Soziales in eigene neue (Unter-)Kategorien
// umgezogen sind. Wir ENTFERNEN nur diese spezifischen, umgezogenen Einträge —
// wir ersetzen NICHT die gesamte `filters`-Liste. Sonst würden später additiv
// ergänzte Keywords (z. B. per Kategorien-Template oder Nutzeraktion) bei jedem
// erneuten Lesen wieder verworfen, weil sie von der reinen Default-Liste abweichen.
const GEHALT_KEYWORDS_MOVED = ["honorar", "umsatzerlös", "umsatzerloes", "auszahlung gewinn"];
const RENTESOZIALES_KEYWORDS_MOVED = [
  "kindergeld", "familienkasse", "bafög", "bafoeg", "elterngeld",
  "arbeitslosengeld", "agentur für arbeit", "agentur fuer arbeit",
  "jobcenter leistung", "wohngeld", "krankengeld",
];

export function migrateIncomeTaxonomy(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  const existingIds = new Set(categories.map((c) => c.id));

  // 1. Fehlende Einkommens-Defaults anhängen (neue Hauptkategorien + Unterkategorien).
  const missingIncomeDefaults = DEFAULT_LOCAL_CATEGORIES.filter(
    (c) => c.attributes?.ausgabenklasse === "einkommen" && !existingIds.has(c.id)
  );
  if (missingIncomeDefaults.length > 0) {
    changed = true;
  }

  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));

  const migrated = categories.map((cat) => {
    // 2. local-cat-einkommen: alte Bezeichnung "Einkommen" → "Sonstige Einnahmen".
    // HISTORISCHER SEED-WERT, nicht lokalisieren: einmalige Migration gegen den
    // deutschen Namen von vor der Lokalisierung. ID-gated, laeuft nur einmal.
    if (cat.id === "local-cat-einkommen" && cat.name === "Einkommen") {
      const fallback = defaultsById.get("local-cat-einkommen");
      changed = true;
      return {
        ...cat,
        name: fallback?.name ?? "Sonstige Einnahmen",
        icon: fallback?.icon ?? cat.icon,
        color: fallback?.color ?? cat.color,
      };
    }

    // 3. local-cat-gehalt: reparent unter Anstellung; umgezogene Keywords entfernen.
    if (cat.id === "local-cat-gehalt") {
      let next = cat;
      if (next.parent_id === "local-cat-einkommen") {
        changed = true;
        next = { ...next, parent_id: "local-cat-anstellung" };
      }
      if (next.is_default !== false) {
        const filtered = next.filters.filter((f) => !GEHALT_KEYWORDS_MOVED.includes(f));
        if (filtered.length !== next.filters.length) {
          changed = true;
          next = { ...next, filters: filtered };
        }
      }
      return next;
    }

    // 4. local-cat-rentesoziales: reparent unter Staat & Soziales; umbenennen + umgezogene Keywords entfernen.
    if (cat.id === "local-cat-rentesoziales") {
      let next = cat;
      if (next.parent_id === "local-cat-einkommen") {
        changed = true;
        next = { ...next, parent_id: "local-cat-staatsoziales" };
      }
      // HISTORISCHER SEED-WERT, nicht lokalisieren (siehe oben).
      if (next.name === "Rente & Soziales") {
        changed = true;
        next = { ...next, name: "Rente & Pension" };
      }
      if (next.is_default !== false) {
        const filtered = next.filters.filter((f) => !RENTESOZIALES_KEYWORDS_MOVED.includes(f));
        if (filtered.length !== next.filters.length) {
          changed = true;
          next = { ...next, filters: filtered };
        }
      }
      return next;
    }

    // 5. local-cat-erstattungen: Beförderung zur Hauptkategorie. Hauptkategorien
    // tragen strukturell nie Filter (Invariante) — das gilt unabhängig von
    // is_default, da eine Hauptkategorie mit Filtern die Sunburst-/Kategorisierungs-
    // Annahmen verletzen würde.
    if (cat.id === "local-cat-erstattungen" && cat.parent_id === "local-cat-einkommen") {
      changed = true;
      return { ...cat, parent_id: null, filters: [] };
    }

    // 6. local-cat-zinsertraege: reparent unter Kapitalerträge.
    if (cat.id === "local-cat-zinsertraege" && cat.parent_id === "local-cat-einkommen") {
      changed = true;
      return { ...cat, parent_id: "local-cat-kapitalertraege" };
    }

    // 7. Alles andere (inkl. Nutzer-Unterkategorien unter local-cat-einkommen) unangetastet.
    return cat;
  });

  const result = [...migrated, ...missingIncomeDefaults.map((c) => ({ ...c }))];
  return { categories: result, changed };
}

/**
 * Rüstet Steuer-Defaults nach:
 * 1. Hängt neue Default-(Unter-)Kategorien an, die die `taxDefault`-Erweiterung
 *    eingeführt hat (Handwerker, Haushaltsnahe Dienstleistungen, Spenden), sofern
 *    ihre stabile ID noch fehlt.
 * 2. Setzt `attributes.default_tax_category_id` (+ `steuerrelevant`) auf
 *    bestehenden DEFAULT-Kategorien (per stabiler ID), die in den Defaults eine
 *    Steuer-Rubrik tragen — aber nur, wenn der Nutzer die Kategorie nicht selbst
 *    überschrieben hat (`is_default !== false`) und noch kein Wert gesetzt ist.
 *
 * Reine Funktion (testbar): `changed` ist NUR true bei echter Änderung — sonst
 * würde die verschlüsselte Liste bei jedem Lesen neu geschrieben (F-CAT).
 */
// Mit dieser Erweiterung neu eingeführte Standard-Unterkategorien (§35a/Spenden).
const NEW_TAX_SUBCATEGORY_IDS = [
  "local-cat-handwerker",
  "local-cat-haushaltsdienste",
  "local-cat-spenden",
];

export function backfillTaxDefaults(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  const existingIds = new Set(categories.map((c) => c.id));
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));

  // 1. NUR die mit dieser Erweiterung neu eingeführten Subkategorien anhängen,
  //    falls sie fehlen. Bewusst eine feste Allowlist statt „alle steuerrelevanten
  //    Defaults" — sonst würde eine vom Nutzer gelöschte Alt-Kategorie (z. B.
  //    Apotheke) beim nächsten Lesen wieder auferstehen.
  const missingTaxDefaults = NEW_TAX_SUBCATEGORY_IDS.map((id) => defaultsById.get(id)).filter(
    (c): c is Category => Boolean(c) && !existingIds.has(c!.id)
  );
  if (missingTaxDefaults.length > 0) {
    changed = true;
  }

  // 2. default_tax_category_id auf bestehenden, nicht überschriebenen Defaults setzen.
  const migrated = categories.map((cat) => {
    if (cat.is_default === false) return cat; // Nutzer-Override unangetastet lassen
    if (cat.attributes?.default_tax_category_id !== undefined) return cat; // bereits gesetzt
    const def = defaultsById.get(cat.id);
    const rubric = def?.attributes?.default_tax_category_id;
    if (!rubric) return cat;

    changed = true;
    return {
      ...cat,
      attributes: {
        ...cat.attributes,
        steuerrelevant: cat.attributes?.steuerrelevant ?? true,
        default_tax_category_id: rubric,
      },
    };
  });

  const result = [...migrated, ...missingTaxDefaults.map((c) => ({ ...c }))];
  return { categories: result, changed };
}

/**
 * Präzisions-Migration der Steuer-Vorschlags-Defaults:
 * 1. Die frühere Misch-Kategorie „Haftpflicht & Hausrat" wird zu
 *    „Hausrat & Gebäude" OHNE Steuer-Default (Hausrat/Gebäude sind nicht
 *    absetzbar — der pauschale 0,9-Vorschlag war irreführend); der
 *    Haftpflicht-Anteil zieht in die neue Kategorie `local-cat-haftpflicht`
 *    (wird angehängt, falls sie fehlt).
 * 2. Vereine verlieren den Spenden-Default (Mitgliedsbeiträge sind meist nicht
 *    gemeinnützig); echte Spenden erkennt die Keyword-Ebene weiterhin.
 *
 * Nur unveränderte Defaults (`is_default !== false`) und nur die ALTEN
 * Default-Werte werden angefasst — bewusst vom Nutzer gesetzte Abweichungen
 * bleiben stehen. Reine Funktion, `changed` nur bei echter Änderung (F-CAT).
 */
// Aus der Misch-Kategorie in die neue Haftpflicht-Kategorie umgezogene Keywords.
const HAFTPFLICHT_KEYWORDS_MOVED = ["haftpflicht"];

export function migrateInsuranceTaxSplit(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  const existingIds = new Set(categories.map((c) => c.id));
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));

  const migrated = categories.map((cat) => {
    if (cat.is_default === false) return cat;

    if (cat.id === "local-cat-haftpflichthausrat") {
      let next = cat;
      // HISTORISCHER SEED-WERT, nicht lokalisieren (siehe oben).
      if (next.name === "Haftpflicht & Hausrat") {
        changed = true;
        next = { ...next, name: defaultsById.get(next.id)?.name ?? "Hausrat & Gebäude" };
      }
      if (next.attributes?.default_tax_category_id === "tax-so-versicherungen") {
        changed = true;
        next = {
          ...next,
          attributes: { ...next.attributes, default_tax_category_id: null, steuerrelevant: false },
        };
      }
      const filtered = next.filters.filter((f) => !HAFTPFLICHT_KEYWORDS_MOVED.includes(f));
      if (filtered.length !== next.filters.length) {
        changed = true;
        next = { ...next, filters: filtered };
      }
      return next;
    }

    if (cat.id === "local-cat-vereine" && cat.attributes?.default_tax_category_id === "tax-so-spenden") {
      changed = true;
      return {
        ...cat,
        attributes: { ...cat.attributes, default_tax_category_id: null, steuerrelevant: false },
      };
    }

    return cat;
  });

  // Neue Haftpflicht-Kategorie additiv anhängen (nur wenn der Nutzer die
  // Versicherungs-Hauptgruppe überhaupt kennt — sonst kommt sie ohnehin mit
  // dem nächsten vollständigen Seed).
  const appended: Category[] = [];
  const haftpflichtDefault = defaultsById.get("local-cat-haftpflicht");
  if (haftpflichtDefault && !existingIds.has(haftpflichtDefault.id) && existingIds.has("local-cat-haftpflichthausrat")) {
    changed = true;
    appended.push({ ...haftpflichtDefault });
  }

  return { categories: [...migrated, ...appended], changed };
}

/**
 * Kategorien-Paket 2026: hängt die neuen Alltags-Kategorien (Kinder & Familie,
 * Bildung, Steuern & Abgaben) additiv an und zieht das Keyword „grundsteuer"
 * aus Miete um (für Eigentümer ist Grundsteuer keine Miete). Feste Allowlist
 * statt „alle fehlenden Defaults", damit vom Nutzer gelöschte Alt-Kategorien
 * nicht wieder auferstehen. Reine Funktion, `changed` nur bei echter Änderung
 * (F-CAT), Nutzer-Overrides bleiben unangetastet.
 */
const CATEGORY_PACK_2026_IDS = [
  "local-cat-kinderfamilie",
  "local-cat-kinderbetreuung",
  "local-cat-schule",
  "local-cat-spielzeugkind",
  "local-cat-bildung",
  "local-cat-fortbildung",
  "local-cat-buecher",
  "local-cat-steuernabgaben",
  "local-cat-grundsteuerabgabe",
  "local-cat-steuerzahlungen",
  "local-cat-kommunaleabgaben",
];

// Aus Miete in „Steuern & Abgaben" umgezogene Keywords.
const MIETE_KEYWORDS_MOVED = ["grundsteuer"];

export function migrateCategoryPack2026(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;
  const existingIds = new Set(categories.map((c) => c.id));
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));

  const migrated = categories.map((cat) => {
    if (cat.id !== "local-cat-miete" || cat.is_default === false) return cat;
    const filtered = cat.filters.filter((f) => !MIETE_KEYWORDS_MOVED.includes(f));
    if (filtered.length === cat.filters.length) return cat;
    changed = true;
    return { ...cat, filters: filtered };
  });

  const appended = CATEGORY_PACK_2026_IDS.map((id) => defaultsById.get(id)).filter(
    (c): c is Category => Boolean(c) && !existingIds.has(c!.id),
  );
  if (appended.length > 0) changed = true;

  return { categories: [...migrated, ...appended.map((c) => ({ ...c }))], changed };
}

/**
 * Klassen-Korrektur: Medizinische Therapie und Sehhilfen/Hörgeräte erbten
 * fälschlich „diskretionär" von der Gesundheit-Hauptkategorie — sie sind
 * essenziell (wie Arzt/Apotheke). Hebt NUR den alten diskretionär-Default auf
 * unveränderten Default-Kategorien an; bewusst gesetzte andere Klassen und
 * Nutzer-Overrides bleiben stehen. Reine Funktion, F-CAT-konform.
 */
const ESSENTIAL_HEALTH_IDS = ["local-cat-therapie", "local-cat-optikerhoergeraete"];

export function migrateEssentialHealthClasses(categories: Category[]): { categories: Category[]; changed: boolean } {
  let changed = false;

  const migrated = categories.map((cat) => {
    if (!ESSENTIAL_HEALTH_IDS.includes(cat.id)) return cat;
    if (cat.is_default === false) return cat;
    if (cat.attributes?.ausgabenklasse !== "diskretionaer") return cat;

    changed = true;
    return {
      ...cat,
      attributes: { ...cat.attributes, ausgabenklasse: "essenziell" as const, essenziell: true },
    };
  });

  return { categories: migrated, changed };
}

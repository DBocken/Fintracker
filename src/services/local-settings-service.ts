"use client";

/**
 * Lokaler Speicher für Kategorien und Nutzereinstellungen
 * (Issue #26, Epic #19).
 *
 * Kategorien und Einstellungen bleiben unabhängig vom Login verschlüsselbar
 * auf dem Gerät.
 */

import type { Category, UserSettings } from "../types";
import { LocalEncryptionLockedError, localEncryption } from "./local-crypto";
import { DEFAULT_LOCAL_CATEGORIES } from "./default-categories";
import { mergeCategoryTemplate, type CategoryTemplate } from "@/lib/category-template";
import { NAV_FEATURE_PATHS, type NavFeatureId } from "@/lib/life-situations";
import { gentleLevelFromLegacy } from "@/lib/gentle-mode";
// Zentrale Key-Registry (VE-6). Re-Export hält bestehende Importe funktionsfähig.
import { LOCAL_CATEGORIES_KEY, LOCAL_SETTINGS_KEY } from "./local-storage-keys";
import { t } from "../i18n/serviceT";

export { LOCAL_CATEGORIES_KEY, LOCAL_SETTINGS_KEY };

/** Pseudo-Identität für lokale Datensätze (Muster wie debt-/account-service). */
export const LOCAL_USER_ID = "local";

function assertClient() {
  if (typeof window === "undefined") {
    throw new Error(t("localSettingsService.clientOnly"));
  }
}

function assertUnlocked() {
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }
}

// -----------------------------------------------------------------------------
// Kategorien (lokal)
// -----------------------------------------------------------------------------

/**
 * Rohdaten wie gespeichert — Migrationen angewandt, Namen NICHT uebersetzt.
 *
 * Alle Schreibpfade muessen diese Fassung benutzen. Wuerden sie die uebersetzte
 * Liste zurueckschreiben, landete der englische Anzeigename dauerhaft in der
 * Datenbank und `name_key` liefe ins Leere.
 */
async function readLocalCategoriesRaw(): Promise<Category[]> {
  assertClient();
  assertUnlocked();

  const stored = await localEncryption.loadAndMaybeDecrypt<Category[]>(LOCAL_CATEGORIES_KEY);
  if (Array.isArray(stored) && stored.length > 0) {
    // Migriere fehlende parent_id-Informationen: Kategorien, die vor der Hierarchie-Umstrukturierung
    // (20260614120000_restructure_categories_hierarchy) gespeichert wurden, haben möglicherweise
    // keine parent_id. Wir füllen diese aus den Default-Kategorien nach.
    const { categories: migrated, changed: parentIdMigrated } = migrateParentIds(stored);

    // Bestandsdaten nachrüsten: Kategorien, die vor Einführung der
    // Ausgabenklasse geseedet wurden, haben kein `ausgabenklasse`-Attribut.
    // Ohne dieses Feld zeigt das Sunburst nur "essenziell"/"unkategorisiert".
    // Wir füllen fehlende Werte aus den Default-Kategorien (per ID) nach.
    const { categories: backfilled, changed: backfillChanged } = backfillAusgabenklasse(migrated);

    // Migriere die einzelne "Einkommen"-Hauptkategorie auf mehrere
    // Einkommens-Hauptkategorien (Anstellung, Verkäufe, Kapitalerträge, …).
    const { categories: incomeMigrated, changed: incomeChanged } = migrateIncomeTaxonomy(backfilled);

    // Rüste Steuer-Rubrik-Defaults nach (neue Handwerker-/Spenden-Kategorien +
    // default_tax_category_id auf bestehenden Defaults).
    const { categories: taxMigrated, changed: taxChanged } = backfillTaxDefaults(incomeMigrated);

    // Präzisiere Steuer-Defaults: Haftpflicht/Hausrat-Split + Vereine ohne
    // pauschalen Spenden-Default.
    const { categories: insuranceMigrated, changed: insuranceChanged } = migrateInsuranceTaxSplit(taxMigrated);

    // Kategorien-Paket 2026 (Kinder & Familie, Bildung, Steuern & Abgaben).
    const { categories: packMigrated, changed: packChanged } = migrateCategoryPack2026(insuranceMigrated);

    // Klassen-Korrektur: Therapie/Sehhilfen sind essenziell.
    const { categories: healthMigrated, changed: healthChanged } = migrateEssentialHealthClasses(packMigrated);

    // Lokalisierbare Kategorienamen: `name_key` bei unveraenderten
    // Standard-Kategorien nachtragen (umbenannte bleiben unberuehrt).
    const { categories: nameKeyMigrated, changed: nameKeyChanged } = backfillCategoryNameKeys(healthMigrated);

    // Nur zurückschreiben, wenn sich WIRKLICH etwas geändert hat. Früher wurde
    // `migrated !== stored` geprüft — das ist nach .map() immer true und schrieb
    // die komplette verschlüsselte Liste bei JEDEM Lesen neu (F-CAT).
    if (parentIdMigrated || backfillChanged || incomeChanged || taxChanged || insuranceChanged || packChanged || healthChanged || nameKeyChanged) {
      await writeLocalCategories(nameKeyMigrated);
    }
    return nameKeyMigrated;
  }

  // Erster Aufruf: Standard-Kategorien einmalig persistieren (Seed)
  const seeded = DEFAULT_LOCAL_CATEGORIES.map((c) => ({ ...c }));
  await localEncryption.encryptAndStore(LOCAL_CATEGORIES_KEY, seeded);
  return seeded;
}

/**
 * Uebersetzt die Anzeigenamen von Standard-Kategorien in die aktive Sprache.
 *
 * Nur `name` wird ersetzt und nur dort, wo `name_key` gesetzt ist — also bei
 * Standard-Kategorien, die die Nutzerin NICHT umbenannt hat. `filters` (die
 * Such-Stichwoerter) bleiben unangetastet: sie matchen deutschen
 * Kontoauszugstext, eine Uebersetzung wuerde die automatische Kategorisierung
 * zerstoeren.
 */
export function localizeCategories(categories: Category[]): Category[] {
  return categories.map((category) =>
    category.name_key ? { ...category, name: t(category.name_key, category.name) } : category,
  );
}

/**
 * Kategorien fuer die Anzeige: wie gespeichert, aber mit uebersetzten Namen.
 *
 * Die Uebersetzung passiert bewusst hier und nicht an den Renderstellen —
 * dieselbe Begruendung wie beim Sprachstil-Overlay in `t()`: so muss keine der
 * vielen Verwendungsstellen davon wissen.
 */
export async function getLocalCategories(): Promise<Category[]> {
  return localizeCategories(await readLocalCategoriesRaw());
}

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
 * Rüstet fehlende `ausgabenklasse`/`essenziell`-Attribute bei gespeicherten
 * Kategorien nach. Default-Kategorien werden per stabiler ID abgeglichen;
 * für übrige Kategorien wird die Ausgabenklasse von der Hauptkategorie geerbt.
 * Reine Funktion (testbar), gibt zurück ob sich etwas geändert hat.
 */
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

async function writeLocalCategories(categories: Category[]): Promise<void> {
  assertClient();
  assertUnlocked();
  await localEncryption.encryptAndStore(LOCAL_CATEGORIES_KEY, categories);
}

function generateLocalCategoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-cat-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Stellt Kategorien aus einem Backup wieder her — Merge per ID (Original-IDs
 * bleiben erhalten). Anders als `saveLocalCategory` wird KEINE neue ID vergeben
 * und der Namens-Dedup-Check NICHT angewandt: sonst würden wiederhergestellte
 * Transaktionen auf nicht existierende Kategorie-IDs zeigen bzw. Default-
 * Kategorien den Import blockieren (T1.4). Bereits vorhandene IDs werden
 * übersprungen (idempotent).
 */
export async function restoreLocalCategories(incoming: Category[]): Promise<number> {
  if (incoming.length === 0) return 0;
  const existing = await readLocalCategoriesRaw();
  const knownIds = new Set(existing.map((c) => c.id).filter(Boolean));
  const added: Category[] = [];
  for (const cat of incoming) {
    if (!cat.id || knownIds.has(cat.id)) continue;
    added.push({
      ...cat,
      user_id: cat.user_id ?? LOCAL_USER_ID,
      filters: cat.filters ?? [],
      attributes: cat.attributes ?? {},
      parent_id: cat.parent_id ?? null,
    });
    knownIds.add(cat.id);
  }
  if (added.length) await writeLocalCategories([...existing, ...added]);
  return added.length;
}

/** Lokal gemerkte Version des zuletzt angewandten Kategorien-Templates (Weg B). */
const CATEGORY_TEMPLATE_VERSION_KEY = "ausgabentracker_category_template_version";

export function getAppliedCategoryTemplateVersion(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(CATEGORY_TEMPLATE_VERSION_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Wendet ein globales Kategorien-Template additiv auf die lokalen Kategorien an
 * (Weg B): neue Kategorien und Filterwörter werden ergänzt, Nutzer-Overrides
 * (is_default:false) nie angetastet. Idempotent und versionsgesichert — nur
 * höhere Versionen greifen, sodass ein erneuter Sync nichts doppelt tut.
 */
export async function applyCategoryTemplate(
  template: CategoryTemplate,
): Promise<{ applied: boolean; added: number; filtersExtended: number; version: number }> {
  const appliedVersion = getAppliedCategoryTemplateVersion();
  if (template.version <= appliedVersion) {
    return { applied: false, added: 0, filtersExtended: 0, version: appliedVersion };
  }

  const local = await readLocalCategoriesRaw();
  const result = mergeCategoryTemplate(local, template.categories);
  if (result.changed) {
    await writeLocalCategories(result.categories);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CATEGORY_TEMPLATE_VERSION_KEY, String(template.version));
  }
  return {
    applied: result.changed,
    added: result.added.length,
    filtersExtended: result.filtersExtended.length,
    version: template.version,
  };
}

export async function saveLocalCategory(category: Partial<Category>): Promise<Category> {
  const categories = await readLocalCategoriesRaw();

  const name = category.name || t("localSettingsService.defaultCategoryName");
  // Gegen die ANGEZEIGTEN Namen pruefen: die Nutzerin sieht bei Standard-
  // Kategorien den uebersetzten Text, also muss sich die Dublettenwarnung auch
  // darauf beziehen.
  if (localizeCategories(categories).some((c) => c.name === name)) {
    throw new Error(t("localSettingsService.categoryNameExists"));
  }

  const next: Category = {
    id: generateLocalCategoryId(),
    user_id: LOCAL_USER_ID,
    name,
    color: category.color || "#2e7d72",
    icon: category.icon || "🛒",
    filters: category.filters || [],
    is_default: false,
    // Selbst angelegte Kategorien tragen nie einen i18n-Key.
    name_key: null,
    parent_id: category.parent_id || null,
    attributes: category.attributes || {},
  };

  await writeLocalCategories([...categories, next]);
  return next;
}

export async function updateLocalCategory(category: Category): Promise<Category> {
  const categories = await readLocalCategoriesRaw();
  const existing = categories.find((c) => c.id === category.id);

  // Standard-Kategorie wird beim Bearbeiten zur Nutzer-Kopie (Verhalten wie Cloud-Pfad)
  if (existing?.is_default) {
    return saveLocalCategory({
      name: category.name,
      color: category.color,
      icon: category.icon,
      filters: category.filters || [],
      parent_id: category.parent_id || null,
      attributes: category.attributes || {},
    });
  }

  if (!existing) {
    throw new Error(t("localSettingsService.categoryNotFound"));
  }

  const duplicate = localizeCategories(categories).some(
    (c) => c.id !== category.id && c.name === category.name,
  );
  if (duplicate) {
    throw new Error(t("localSettingsService.categoryNameExists"));
  }

  const updated: Category = {
    ...existing,
    name: category.name,
    // Ab der ersten Umbenennung gewinnt der Text der Nutzerin; ein
    // Sprachwechsel fasst ihn nicht mehr an.
    name_key: null,
    color: category.color,
    icon: category.icon,
    filters: category.filters || [],
    parent_id: category.parent_id || null,
    attributes: category.attributes || {},
  };

  await writeLocalCategories(categories.map((c) => (c.id === updated.id ? updated : c)));
  return updated;
}

export async function deleteLocalCategory(id: string): Promise<void> {
  const categories = await readLocalCategoriesRaw();
  // Direkte Kinder mitlöschen (Verhalten wie Cloud-Pfad)
  await writeLocalCategories(
    categories.filter((c) => c.id !== id && c.parent_id !== id),
  );
}

// -----------------------------------------------------------------------------
// Nutzereinstellungen (lokal)
// -----------------------------------------------------------------------------

export function buildDefaultLocalSettings(): UserSettings {
  return {
    user_id: LOCAL_USER_ID,
    auto_confirm_mapping: false,
    retention_months: 36,
    default_currency: "EUR",
    enable_subcategories: true,
    theme: "legacy",
    kpi_prefs: {
      order: ["savings_rate", "average_daily_expenses"],
      active: ["savings_rate", "average_daily_expenses"],
    },
    tax_reserve_percent: 30,
  };
}

/**
 * Einmalige Migration des abgelösten `business_mode`-Flags in die
 * Bereichsauswahl (`enabled_nav_features`).
 *
 * Der Einzelunternehmer-Modus lief früher über ein eigenes Flag; heute leitet
 * er sich aus dem Bereich `euer` ab. Ein Bestandsnutzer mit aktivem Modus
 * verlöre ohne diesen Schritt nicht nur die EÜR in der Navigation, sondern
 * auch die Steuer-Stufe im Liquiditäts-Wasserfall.
 *
 * Er hatte nie eine Bereichsauswahl getroffen, sah also alles — deshalb wird
 * die volle Liste gesetzt und nicht nur `euer`. Eine bereits getroffene
 * Auswahl bleibt unangetastet.
 *
 * Gibt `null` zurück, wenn nichts zu migrieren war.
 */
function migrateLegacyBusinessMode(settings: UserSettings): UserSettings | null {
  if (settings.business_mode === undefined) return null;

  const { business_mode: legacy, ...rest } = settings;
  const migrated: UserSettings = { ...rest };
  if (legacy === true && rest.enabled_nav_features == null) {
    migrated.enabled_nav_features = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];
  }
  return migrated;
}

/**
 * Einmalige Migration des abgelösten `gentle_mode`-Schalters auf die Stufe
 * {@link UserSettings.gentle_level}.
 *
 * Der Sanfte Modus war ein Ja/Nein und ist heute eine Annäherungsleiter
 * (`docs/debt-avoidance-recovery.md`). `true` wird zu Stufe 3 — wer den Modus
 * an hatte, hat bisher ALLES verdeckt gesehen; eine Migration, die dabei
 * Beträge aufdeckt, wäre genau der Schreck, den der Modus verhindern soll.
 *
 * Eine bereits gesetzte Stufe gewinnt: Sie ist die neuere Aussage.
 *
 * Gibt `null` zurück, wenn nichts zu migrieren war.
 */
function migrateLegacyGentleMode(settings: UserSettings): UserSettings | null {
  if (settings.gentle_mode === undefined) return null;

  const { gentle_mode: legacy, ...rest } = settings;
  const migrated: UserSettings = { ...rest };
  if (rest.gentle_level === undefined) {
    migrated.gentle_level = gentleLevelFromLegacy(legacy);
  }
  return migrated;
}

/**
 * Räumt Bereiche aus der gespeicherten Auswahl, die es nicht mehr gibt.
 *
 * Anlass ist die Finanzstadt: Sie war ein wählbarer Bereich und ist heute
 * Kernbereich (`docs/tutorial-sequence.md`). Wirkungslos ist der Altwert schon
 * — `isNavPathVisible` prüft `ALWAYS_VISIBLE_NAV_PATHS` vor der
 * Feature-Zuordnung —, aber ein Fremdwert in einem typisierten Array gehört
 * weggeräumt, bevor ihn jemand für gültig hält.
 *
 * Bewusst allgemein statt auf `'city'` verdrahtet: Der nächste entfallende
 * Bereich braucht dann keine zweite Migration.
 *
 * Gibt `null` zurück, wenn nichts zu räumen war.
 */
function migrateRemovedNavFeatures(settings: UserSettings): UserSettings | null {
  const stored = settings.enabled_nav_features;
  if (stored == null) return null;

  const known = new Set(Object.keys(NAV_FEATURE_PATHS));
  const cleaned = stored.filter((f) => known.has(f));
  if (cleaned.length === stored.length) return null;

  return { ...settings, enabled_nav_features: cleaned };
}

export async function getLocalUserSettings(): Promise<UserSettings> {
  assertClient();
  assertUnlocked();

  const stored = await localEncryption.loadAndMaybeDecrypt<UserSettings>(LOCAL_SETTINGS_KEY);
  if (stored && typeof stored === "object") {
    const merged = { ...buildDefaultLocalSettings(), ...stored, user_id: LOCAL_USER_ID };
    // Nacheinander, jede auf dem Ergebnis der vorigen: die erste kann eine
    // Auswahl erst anlegen, die die zweite dann räumt.
    const afterBusinessMode = migrateLegacyBusinessMode(merged);
    const afterRemoved = migrateRemovedNavFeatures(afterBusinessMode ?? merged);
    const afterGentleMode = migrateLegacyGentleMode(afterRemoved ?? afterBusinessMode ?? merged);
    const migrated = afterGentleMode ?? afterRemoved ?? afterBusinessMode;
    if (migrated) {
      await localEncryption.encryptAndStore(LOCAL_SETTINGS_KEY, migrated);
      return migrated;
    }
    return merged;
  }

  const defaults = buildDefaultLocalSettings();
  await localEncryption.encryptAndStore(LOCAL_SETTINGS_KEY, defaults);
  return defaults;
}

export async function updateLocalUserSettings(
  settings: Partial<UserSettings>,
): Promise<UserSettings> {
  const current = await getLocalUserSettings();
  const next: UserSettings = { ...current, ...settings, user_id: LOCAL_USER_ID };
  await localEncryption.encryptAndStore(LOCAL_SETTINGS_KEY, next);
  return next;
}

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
import { DEFAULT_LOCAL_CATEGORIES } from "@/lib/default-categories";
// Kategorien-Migrationen sind reine Funktionen und liegen seit WP 6.6 in
// `src/lib/` (AGENTS.md §3). Dieser Service ruft sie nur noch auf.
import {
  backfillAusgabenklasse,
  backfillCategoryNameKeys,
  backfillTaxDefaults,
  migrateCategoryPack2026,
  migrateEssentialHealthClasses,
  migrateIncomeTaxonomy,
  migrateInsuranceTaxSplit,
  migrateParentIds,
} from "@/lib/category-migrations";
import { mergeCategoryTemplate, type CategoryTemplate } from "@/lib/category-template";
import { NAV_FEATURE_PATHS, withFeatureUnlocked, type NavFeatureId } from "@/lib/life-situations";
import { chapterById, type TutorialChapterId } from "@/lib/tutorial-sequence";
import { gentleLevelFromLegacy } from "@/lib/gentle-mode";
import { withKeyLock } from "@/lib/key-mutex";
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


async function writeLocalCategories(categories: Category[]): Promise<void> {
  assertClient();
  assertUnlocked();
  await localEncryption.encryptAndStore(LOCAL_CATEGORIES_KEY, categories);
}

/**
 * Lesen, Ändern und Schreiben der Kategorien in einem Lock (Issue #311).
 *
 * Ohne die Serialisierung lesen zwei gleichzeitige Aufrufe denselben Stand und
 * der zweite schreibt eine Liste ohne die Kategorie des ersten — lautlos.
 * `readLocalCategoriesRaw`/`writeLocalCategories` nehmen den Lock bewusst
 * NICHT selbst: sie werden hier drinnen gerufen, und `withKeyLock` ist nicht
 * wiedereintrittsfähig.
 */
async function mutiereKategorien<T>(
  aendern: (categories: Category[]) => T | Promise<T>,
): Promise<T> {
  return withKeyLock(LOCAL_CATEGORIES_KEY, async () => {
    const categories = await readLocalCategoriesRaw();
    return aendern(categories);
  });
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
  return mutiereKategorien(async (existing) => {
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
  });
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

  return mutiereKategorien(async (local) => {
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
  });
}

export async function saveLocalCategory(category: Partial<Category>): Promise<Category> {
  return mutiereKategorien(async (categories) => saveInKategorien(categories, category));
}

/**
 * Der Anlege-Schritt ohne Lock — er läuft IMMER innerhalb eines fremden Locks
 * (`saveLocalCategory`). Ohne diese Trennung nähme der Umweg den Lock ein
 * zweites Mal und verklemmte.
 *
 * `updateInKategorien` ruft ihn seit der Behebung NICHT mehr: Das Bearbeiten
 * einer Standard-Kategorie war als Neuanlage verdrahtet und erzeugte damit
 * entweder einen Dublettenfehler oder eine zweite Zeile.
 */
async function saveInKategorien(
  categories: Category[],
  category: Partial<Category>,
): Promise<Category> {
  const name = category.name || t("localSettingsService.defaultCategoryName");
  // Gegen die ANGEZEIGTEN Namen pruefen: die Nutzerin sieht bei Standard-
  // Kategorien den uebersetzten Text, also muss sich die Dublettenwarnung auch
  // darauf beziehen. Die Pruefung liegt INNERHALB des Locks — davor koennten
  // zwei gleichzeitige Anlagen desselben Namens beide an ihr vorbeikommen.
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
  return mutiereKategorien(async (categories) => updateInKategorien(categories, category));
}

async function updateInKategorien(categories: Category[], category: Category): Promise<Category> {
  const existing = categories.find((c) => c.id === category.id);

  if (!existing) {
    throw new Error(t("localSettingsService.categoryNotFound"));
  }

  const duplicate = localizeCategories(categories).some(
    (c) => c.id !== category.id && c.name === category.name,
  );
  if (duplicate) {
    throw new Error(t("localSettingsService.categoryNameExists"));
  }

  // Bis hierher wurde eine Standard-Kategorie beim Bearbeiten an die NEUANLAGE
  // umgeleitet — mit neuer ID, waehrend die alte in der Liste stehen blieb.
  // Zwei Folgen, beide gemessen: Bleibt der Name gleich, schlaegt die
  // Dublettenpruefung gegen die eigene Ursprungszeile an und das Speichern
  // bricht mit "Eine Kategorie mit diesem Namen existiert bereits" ab. Wird
  // umbenannt, stehen danach ZWEI Kategorien da, und saemtliche Buchungen,
  // Budgets und Haendlerregeln haengen weiter an der alten. Da alle 112
  // ausgelieferten Kategorien `is_default: true` tragen, war damit der
  // Normalfall betroffen: "ich aendere die Stichwoerter von Lebensmittel".
  //
  // Bearbeiten bearbeitet jetzt — die ID bleibt, und damit bleibt alles daran
  // haengen. Das "Kopieren beim Schreiben" war nie als zweite ZEILE gemeint,
  // sondern als Uebergang der Eigentuemerschaft, und der wird durch das
  // Zuruecksetzen von `is_default` ausgedrueckt.
  const warStandard = existing.is_default === true;

  // `is_default: false` ist in diesem Baum kein Herkunftsvermerk, sondern ein
  // VERTRAG: Jede Migration und jedes Kategoriepaket laesst genau die Zeilen in
  // Ruhe, die so markiert sind (`if (cat.is_default === false) return cat` an
  // acht Stellen in category-migrations.ts und category-template.ts). Wer eine
  // ausgelieferte Kategorie aendert, soll seine Aenderung behalten — also wird
  // die Marke hier gesetzt und nicht bloss mitgeschleppt.
  // Den ANGEZEIGTEN Namen ueber `localizeCategories` aufloesen statt ueber ein
  // zweites Aufloesen ueber eine Schluessel-VARIABLE: So ein Schluessel laesst sich von
  // der Aufrufstellen-Pruefung nicht mehr gegen den Sprachbaum halten, und
  // `call-site-keys.test.ts` haelt ihre Zahl als Ratsche fest. Es gibt bereits
  // genau eine Stelle, die das tut — eine zweite waere derselbe Dienst zweimal.
  const [angezeigt] = localizeCategories([existing]);
  const umbenannt = category.name !== angezeigt.name;

  const updated: Category = {
    ...existing,
    name: category.name,
    // Ab der ersten Umbenennung gewinnt der Text der Nutzerin; ein
    // Sprachwechsel fasst ihn nicht mehr an. UNVERAENDERT bleibt der
    // Uebersetzungsschluessel dagegen, wenn nur Farbe, Symbol oder Filter
    // geaendert wurden — sonst verloere eine Standard-Kategorie ihre
    // Uebersetzung, weil jemand sie umgefaerbt hat.
    name_key: umbenannt ? null : existing.name_key,
    is_default: warStandard ? false : existing.is_default,
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
  await mutiereKategorien(async (categories) => {
    // Direkte Kinder mitlöschen (Verhalten wie Cloud-Pfad)
    await writeLocalCategories(categories.filter((c) => c.id !== id && c.parent_id !== id));
  });
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

/**
 * Der einzige Schreibpunkt der Einstellungen — benannt, damit
 * `pnpm check:store-serialization` das Lese-/Schreibpaar überhaupt erkennen
 * kann. Ein direkter `encryptAndStore`-Aufruf auf `LOCAL_SETTINGS_KEY` wäre für
 * den Wächter nur einer von vielen und damit unsichtbar.
 */
async function schreibeLokaleEinstellungen(settings: UserSettings): Promise<void> {
  await localEncryption.encryptAndStore(LOCAL_SETTINGS_KEY, settings);
}

/**
 * Liest die Einstellungen und wendet fällige Migrationen an — **ohne** Lock.
 *
 * Wird sowohl vom öffentlichen Lesezugriff als auch aus dem Schreib-Lock
 * heraus gerufen. Deshalb darf sie den Lock nicht selbst nehmen:
 * `withKeyLock` ist nicht wiedereintrittsfähig, und ein Aufruf aus dem
 * Schreib-Lock heraus würde sich selbst blockieren.
 */
async function leseLokaleEinstellungenOhneLock(): Promise<UserSettings> {
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
      await schreibeLokaleEinstellungen(migrated);
      return migrated;
    }
    return merged;
  }

  const defaults = buildDefaultLocalSettings();
  await schreibeLokaleEinstellungen(defaults);
  return defaults;
}

/**
 * Liest die Einstellungen. Nimmt denselben Lock wie der Schreibpfad, damit ein
 * Lesevorgang nie den Stand *vor* einem gerade laufenden Schreibvorgang sieht.
 */
export async function getLocalUserSettings(): Promise<UserSettings> {
  return withKeyLock(LOCAL_SETTINGS_KEY, leseLokaleEinstellungenOhneLock);
}

/**
 * [REGRESSION #293] Lesen, Mergen und Schreiben in einem Lock.
 *
 * Zuvor lagen zwischen Lesen und Schreiben zwei `await`s. Zwei kurz
 * aufeinanderfolgende Aufrufe — etwa `DataSourceDialog` und `OnboardingDialog`,
 * die beide hierher schreiben — lasen denselben Stand, und der zweite schrieb
 * eine Fassung ohne das Feld des ersten. `tutorial_source` ging so verloren.
 */
/**
 * Hält ein abgeschlossenes Tutorial-Kapitel fest — Anhängen und Freischalten
 * INNERHALB des Locks.
 *
 * [REGRESSION] Warum das nicht die Aufrufstelle tun darf: Sie kannte die
 * bisherige Liste nur aus dem Query-Cache, und der hinkt einer gerade
 * geschriebenen Änderung hinterher. Beim zusammenhängenden Tutorial folgen
 * zwei Abschlüsse unmittelbar aufeinander — der zweite las die Liste ohne das
 * erste Kapitel und schrieb sie so zurück. Der Fortschritt des ersten Kapitels
 * war damit weg, lautlos und ohne Fehler (dieselbe Klasse wie #293,
 * `pnpm check:store-serialization`).
 *
 * Der freizuschaltende Bereich kommt aus `TUTORIAL_ORDER`; eine zweite Liste
 * „Kapitel → Bereich" wäre eine zweite Wahrheit.
 */
export async function completeTutorialChapter(
  chapter: TutorialChapterId,
): Promise<UserSettings> {
  return withKeyLock(LOCAL_SETTINGS_KEY, async () => {
    const current = await leseLokaleEinstellungenOhneLock();
    const done = current.tutorial_completed_chapters ?? [];
    if (done.includes(chapter)) return current;

    const next: UserSettings = {
      ...current,
      tutorial_completed_chapters: [...done, chapter],
      user_id: LOCAL_USER_ID,
    };

    // `withFeatureUnlocked` lässt „alles freigeschaltet" (null) bewusst
    // unangetastet — ein Kapitelabschluss darf daraus keine einelementige
    // Liste machen.
    const feature = chapterById(chapter)?.feature ?? null;
    if (feature) {
      const unlocked = withFeatureUnlocked(current.unlocked_features ?? null, feature);
      if (unlocked !== (current.unlocked_features ?? null)) next.unlocked_features = unlocked;
    }

    await schreibeLokaleEinstellungen(next);
    return next;
  });
}

export async function updateLocalUserSettings(
  settings: Partial<UserSettings>,
): Promise<UserSettings> {
  return withKeyLock(LOCAL_SETTINGS_KEY, async () => {
    const current = await leseLokaleEinstellungenOhneLock();
    const next: UserSettings = { ...current, ...settings, user_id: LOCAL_USER_ID };
    await schreibeLokaleEinstellungen(next);
    return next;
  });
}

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

export const LOCAL_CATEGORIES_KEY = "ausgabentracker_categories_v1";
export const LOCAL_SETTINGS_KEY = "ausgabentracker_user_settings_v1";

/** Pseudo-Identität für lokale Datensätze (Muster wie debt-/account-service). */
export const LOCAL_USER_ID = "local";

function assertClient() {
  if (typeof window === "undefined") {
    throw new Error("Lokale Daten können nur im Client verarbeitet werden.");
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

export async function getLocalCategories(): Promise<Category[]> {
  assertClient();
  assertUnlocked();

  const stored = await localEncryption.loadAndMaybeDecrypt<Category[]>(LOCAL_CATEGORIES_KEY);
  if (Array.isArray(stored) && stored.length > 0) {
    // Migriere fehlende parent_id-Informationen: Kategorien, die vor der Hierarchie-Umstrukturierung
    // (20260614120000_restructure_categories_hierarchy) gespeichert wurden, haben möglicherweise
    // keine parent_id. Wir füllen diese aus den Default-Kategorien nach.
    let migrated = stored.map((cat) => {
      // Wenn parent_id bereits gesetzt (null oder string), nicht verändern
      if (cat.parent_id !== undefined) return cat;
      // Sonst: versuche aus Default-Kategorien zu laden
      const defaultCat = DEFAULT_LOCAL_CATEGORIES.find((d) => d.id === cat.id);
      const resolvedParentId = defaultCat?.parent_id ?? null;
      return { ...cat, parent_id: resolvedParentId };
    });

    // Bestandsdaten nachrüsten: Kategorien, die vor Einführung der
    // Ausgabenklasse geseedet wurden, haben kein `ausgabenklasse`-Attribut.
    // Ohne dieses Feld zeigt das Sunburst nur "essenziell"/"unkategorisiert".
    // Wir füllen fehlende Werte aus den Default-Kategorien (per ID) nach.
    const { categories: backfilled, changed: backfillChanged } = backfillAusgabenklasse(migrated);
    const parentIdMigrated = migrated !== stored;
    if (parentIdMigrated || backfillChanged) {
      await writeLocalCategories(backfilled);
    }
    return backfilled;
  }

  // Erster Aufruf: Standard-Kategorien einmalig persistieren (Seed)
  const seeded = DEFAULT_LOCAL_CATEGORIES.map((c) => ({ ...c }));
  await localEncryption.encryptAndStore(LOCAL_CATEGORIES_KEY, seeded);
  return seeded;
}

/**
 * Rüstet fehlende `ausgabenklasse`/`essenziell`-Attribute bei gespeicherten
 * Kategorien nach. Default-Kategorien werden per stabiler ID abgeglichen;
 * für übrige Kategorien wird die Ausgabenklasse von der Hauptkategorie geerbt.
 * Reine Funktion (testbar), gibt zurück ob sich etwas geändert hat.
 */
export function backfillAusgabenklasse(categories: Category[]): { categories: Category[]; changed: boolean } {
  const defaultsById = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.id, c]));
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

export async function saveLocalCategory(category: Partial<Category>): Promise<Category> {
  const categories = await getLocalCategories();

  const name = category.name || "Kategorie";
  if (categories.some((c) => c.name === name)) {
    throw new Error("Eine Kategorie mit diesem Namen existiert bereits");
  }

  const next: Category = {
    id: generateLocalCategoryId(),
    user_id: LOCAL_USER_ID,
    name,
    color: category.color || "#2e7d72",
    icon: category.icon || "🛒",
    filters: category.filters || [],
    is_default: false,
    parent_id: category.parent_id || null,
    attributes: category.attributes || {},
  };

  await writeLocalCategories([...categories, next]);
  return next;
}

export async function updateLocalCategory(category: Category): Promise<Category> {
  const categories = await getLocalCategories();
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
    throw new Error("Kategorie nicht gefunden");
  }

  const duplicate = categories.some((c) => c.id !== category.id && c.name === category.name);
  if (duplicate) {
    throw new Error("Eine Kategorie mit diesem Namen existiert bereits");
  }

  const updated: Category = {
    ...existing,
    name: category.name,
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
  const categories = await getLocalCategories();
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
  };
}

export async function getLocalUserSettings(): Promise<UserSettings> {
  assertClient();
  assertUnlocked();

  const stored = await localEncryption.loadAndMaybeDecrypt<UserSettings>(LOCAL_SETTINGS_KEY);
  if (stored && typeof stored === "object") {
    return { ...buildDefaultLocalSettings(), ...stored, user_id: LOCAL_USER_ID };
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

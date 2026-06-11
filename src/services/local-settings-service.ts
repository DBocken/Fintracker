"use client";

/**
 * Lokaler Fallback für Kategorien und Nutzereinstellungen im anonymen Modus
 * (Issue #26, Epic #19).
 *
 * Im anonymen Modus gibt es keine Supabase-Identität — Kategorien und
 * Einstellungen leben dann (wie Transaktionen, Konten, Schulden bereits)
 * verschlüsselbar im lokalen Speicher. transaction-service/category-service
 * verzweigen hierher, wenn getCurrentUserId() null liefert.
 */

import type { Category, UserSettings } from "../types";
import { LocalEncryptionLockedError, localEncryption } from "./local-crypto";
import { DEFAULT_LOCAL_CATEGORIES } from "./default-categories";

const LOCAL_CATEGORIES_KEY = "ausgabentracker_categories_v1";
const LOCAL_SETTINGS_KEY = "ausgabentracker_user_settings_v1";

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
  if (Array.isArray(stored) && stored.length > 0) return stored;

  // Erster Aufruf: Standard-Kategorien einmalig persistieren (Seed)
  const seeded = DEFAULT_LOCAL_CATEGORIES.map((c) => ({ ...c }));
  await localEncryption.encryptAndStore(LOCAL_CATEGORIES_KEY, seeded);
  return seeded;
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
    color: category.color || "#22c55e",
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
      order: ["net_cashflow", "savings_rate", "transactions_count"],
      active: ["net_cashflow", "savings_rate", "transactions_count"],
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

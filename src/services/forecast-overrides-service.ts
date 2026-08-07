/**
 * Forecast-Overrides (Stufe 2: Planbarkeit)
 *
 * Nutzerseitige Planungs-Annahmen, die der Auto-Seed nicht aus den Daten
 * ableiten kann: Sicherheitspuffer, Horizont, Tagesgeld-Zinssätze,
 * Budget-Overrides, geplante Einmalposten, Rücklagen, Transfers und
 * Overrides für auto-erkannte wiederkehrende Zahlungen.
 *
 * Persistenz läuft über den lokalen verschlüsselbaren IndexedDB-Store. Der
 * frühere localStorage-Key wird beim Lesen/Schreiben lazy migriert und danach
 * gelöscht, damit finanzielle Planungsdaten nicht dauerhaft in localStorage
 * verbleiben.
 */
import { DEFAULT_FORECAST_OVERRIDES, type ForecastOverrides } from '@/lib/forecast-types';
import { localEncryption } from './local-crypto';
import { LOCAL_FINANCE_KEYS } from './local-storage-keys';

export const FORECAST_OVERRIDES_STORAGE_KEY = LOCAL_FINANCE_KEYS.forecastOverrides;

function cloneDefaults(): ForecastOverrides {
  return { ...DEFAULT_FORECAST_OVERRIDES };
}

function normalize(raw: Partial<ForecastOverrides> | null | undefined): ForecastOverrides {
  return {
    months: raw?.months ?? DEFAULT_FORECAST_OVERRIDES.months,
    safetyBuffer: raw?.safetyBuffer ?? DEFAULT_FORECAST_OVERRIDES.safetyBuffer,
    bufferBasis: raw?.bufferBasis ?? DEFAULT_FORECAST_OVERRIDES.bufferBasis,
    accountInterest: raw?.accountInterest ?? {},
    categoryBudgets: raw?.categoryBudgets ?? {},
    plannedEvents: Array.isArray(raw?.plannedEvents) ? raw!.plannedEvents! : [],
    sinkingFunds: Array.isArray(raw?.sinkingFunds) ? raw!.sinkingFunds! : [],
    transfers: Array.isArray(raw?.transfers) ? raw!.transfers! : [],
    recurringFlowOverrides: raw?.recurringFlowOverrides ?? {},
    scenarios: Array.isArray(raw?.scenarios) ? raw!.scenarios! : [],
  };
}

function readLegacyLocalStorage(): Partial<ForecastOverrides> | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(FORECAST_OVERRIDES_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Partial<ForecastOverrides>;
}

function clearLegacyLocalStorage(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FORECAST_OVERRIDES_STORAGE_KEY);
  }
}

/**
 * Migriert Forecast-Overrides aus dem früheren localStorage-Key in den
 * verschlüsselbaren IndexedDB-Store und löscht die Klartext-Kopie erst nach
 * erfolgreichem Schreiben.
 */
export async function migrateForecastOverridesFromLocalStorage(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const legacy = readLegacyLocalStorage();
    if (!legacy) return false;
    await localEncryption.encryptAndStore(FORECAST_OVERRIDES_STORAGE_KEY, normalize(legacy));
    clearLegacyLocalStorage();
    return true;
  } catch {
    return false;
  }
}

/** Liest die gespeicherten Overrides (mit Defaults für fehlende Felder). */
export async function getForecastOverrides(): Promise<ForecastOverrides> {
  if (typeof window === 'undefined') return cloneDefaults();
  try {
    await migrateForecastOverridesFromLocalStorage();
    const stored = await localEncryption.loadAndMaybeDecrypt<Partial<ForecastOverrides>>(FORECAST_OVERRIDES_STORAGE_KEY);
    return normalize(stored);
  } catch {
    return cloneDefaults();
  }
}

/** Persistiert die Overrides im verschlüsselbaren lokalen Store. */
export async function saveForecastOverrides(overrides: ForecastOverrides): Promise<void> {
  if (typeof window === 'undefined') return;
  await localEncryption.encryptAndStore(FORECAST_OVERRIDES_STORAGE_KEY, normalize(overrides));
  clearLegacyLocalStorage();
}

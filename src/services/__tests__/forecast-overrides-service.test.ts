import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearLocalKvStore, idbGet, idbSet } from '../idb-kv';
import { localEncryption, LocalEncryptionLockedError, VaultCorruptError } from '../local-crypto';
import { FORECAST_OVERRIDES_STORAGE_KEY, getForecastOverrides, saveForecastOverrides } from '../forecast-overrides-service';
import { DEFAULT_FORECAST_OVERRIDES } from '@/lib/forecast-types';

describe('forecast-overrides-service', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  afterEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it('[PRIVACY] sollte Forecast-Overrides in IndexedDB statt localStorage speichern', async () => {
    await saveForecastOverrides({
      ...DEFAULT_FORECAST_OVERRIDES,
      safetyBuffer: 2500,
      categoryBudgets: { lebensmittel: 450 },
      plannedEvents: [
        {
          id: 'event-1',
          name: 'Autoreparatur',
          date: '2026-08-01',
          amount: -900,
          accountId: 'konto-1',
        },
      ],
    });

    expect(localStorage.getItem(FORECAST_OVERRIDES_STORAGE_KEY)).toBeNull();
    const raw = await idbGet(FORECAST_OVERRIDES_STORAGE_KEY);
    expect(raw).toContain('Autoreparatur');

    await expect(getForecastOverrides()).resolves.toMatchObject({
      safetyBuffer: 2500,
      categoryBudgets: { lebensmittel: 450 },
    });
  });

  it('[PRIVACY] [REGRESSION] sollte Legacy-localStorage-Overrides migrieren und löschen', async () => {
    localStorage.setItem(
      FORECAST_OVERRIDES_STORAGE_KEY,
      JSON.stringify({
        months: 12,
        safetyBuffer: 3000,
        categoryBudgets: { miete: 1100 },
      }),
    );

    await expect(getForecastOverrides()).resolves.toMatchObject({
      months: 12,
      safetyBuffer: 3000,
      categoryBudgets: { miete: 1100 },
    });

    expect(localStorage.getItem(FORECAST_OVERRIDES_STORAGE_KEY)).toBeNull();
    expect(await idbGet(FORECAST_OVERRIDES_STORAGE_KEY)).toContain('miete');
  });

  it('[PRIVACY] sollte Forecast-Overrides bei aktiver Verschlüsselung nicht als Klartext speichern', async () => {
    await localEncryption.enable('correct horse battery staple');

    await saveForecastOverrides({
      ...DEFAULT_FORECAST_OVERRIDES,
      safetyBuffer: 1800,
      categoryBudgets: { geheimKategorie: 1234 },
    });

    const raw = await idbGet(FORECAST_OVERRIDES_STORAGE_KEY);
    expect(localStorage.getItem(FORECAST_OVERRIDES_STORAGE_KEY)).toBeNull();
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('geheimKategorie');
    expect(JSON.parse(raw!).type).toBe('ausgabentracker.enc');
    await expect(getForecastOverrides()).resolves.toMatchObject({
      safetyBuffer: 1800,
      categoryBudgets: { geheimKategorie: 1234 },
    });
  });

  // WP 1.7 — die Fehlkette, die WP 1.1 fuer 29 von 30 Collections schon
  // schliesst, war fuer forecastOverrides noch offen: `getForecastOverrides()`
  // fing JEDEN Fehler und lieferte Defaults, auch einen `VaultCorruptError`.

  it('[REGRESSION] sollte bei korruptem Envelope werfen statt Defaults zu liefern', async () => {
    await localEncryption.enable('correct horse battery staple');
    // Rohwert ist vorhanden, aber kein gueltiges JSON -> Korruption, kein
    // Leerzustand (RES-1 in local-crypto.ts).
    await idbSet(FORECAST_OVERRIDES_STORAGE_KEY, '{nicht-valides-json');

    // `.rejects` ist hier der entscheidende Teil: die alte Implementierung
    // haette `.resolves.toEqual(DEFAULT_FORECAST_OVERRIDES)` erfuellt — genau
    // das darf jetzt NICHT mehr passieren.
    await expect(getForecastOverrides()).rejects.toBeInstanceOf(VaultCorruptError);
  });

  it('sollte ohne vorhandenen Key weiterhin Defaults liefern, ohne zu werfen', async () => {
    // Kein `beforeEach`-Schreibvorgang zuvor -> der Key existiert schlicht
    // nicht. Das ist der echte Leerzustand, kein Fehler.
    await expect(getForecastOverrides()).resolves.toEqual(DEFAULT_FORECAST_OVERRIDES);
  });

  it('sollte bei gesperrtem Vault weiterhin LocalEncryptionLockedError durchreichen', async () => {
    await localEncryption.enable('correct horse battery staple');
    await saveForecastOverrides({ ...DEFAULT_FORECAST_OVERRIDES, safetyBuffer: 1800 });
    localEncryption.lock();

    // Ein gesperrter Vault ist keine Korruption — die Fläche muss „entsperren"
    // von „Backup einspielen" unterscheiden können.
    await expect(getForecastOverrides()).rejects.toBeInstanceOf(LocalEncryptionLockedError);
  });
});

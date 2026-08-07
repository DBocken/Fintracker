import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearLocalKvStore, idbGet } from '../idb-kv';
import { localEncryption } from '../local-crypto';
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
});

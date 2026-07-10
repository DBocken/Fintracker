import { describe, it, expect, beforeEach } from 'vitest';
import { getTaxYearProfile, saveTaxYearProfile } from '../tax-profile-service';
import { writeLocalFinanceList } from '../local-finance-store';

describe('tax-profile-service', () => {
  beforeEach(async () => {
    await writeLocalFinanceList('taxYearProfiles', []);
  });

  it('sollte ein Jahres-Profil anlegen und wieder lesen', async () => {
    await saveTaxYearProfile(2025, { commuteDaysPerYear: 220, commuteOneWayKm: 30, homeofficeDays: 40 });
    const loaded = await getTaxYearProfile(2025);
    expect(loaded?.commuteDaysPerYear).toBe(220);
    expect(loaded?.commuteOneWayKm).toBe(30);
    expect(loaded?.homeofficeDays).toBe(40);
  });

  it('sollte per Upsert dasselbe Jahr aktualisieren statt duplizieren (stabile ID)', async () => {
    await saveTaxYearProfile(2025, { commuteDaysPerYear: 100, commuteOneWayKm: 10, homeofficeDays: 0 });
    await saveTaxYearProfile(2025, { commuteDaysPerYear: 220, commuteOneWayKm: 30, homeofficeDays: 0 });
    const loaded = await getTaxYearProfile(2025);
    expect(loaded?.commuteDaysPerYear).toBe(220);
  });

  it('sollte negative Eingaben auf null normalisieren', async () => {
    await saveTaxYearProfile(2025, { commuteDaysPerYear: -5, commuteOneWayKm: 30, homeofficeDays: 0 });
    const loaded = await getTaxYearProfile(2025);
    expect(loaded?.commuteDaysPerYear).toBeNull();
  });

  it('sollte für ein nicht existierendes Jahr null liefern', async () => {
    expect(await getTaxYearProfile(2099)).toBeNull();
  });
});

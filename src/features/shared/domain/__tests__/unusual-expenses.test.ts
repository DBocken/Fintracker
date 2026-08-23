import { describe, expect, it } from 'vitest';
import { findeAusreisser, median } from '../unusual-expenses';

describe('findeAusreisser', () => {
  const serie = (betraege: number[]) =>
    new Map([['kat', betraege.map((betrag, i) => ({ monat: `2026-0${i + 1}`, betrag }))]]);

  it('sollte einen Monat deutlich über dem eigenen Median melden', () => {
    const funde = findeAusreisser(serie([100, 110, 105, 300]));
    expect(funde).toHaveLength(1);
    expect(funde[0]).toMatchObject({ monat: '2026-04', betrag: 300 });
    expect(funde[0].prozent).toBeGreaterThan(150);
  });

  it('sollte BEIDE Schwellen verlangen — Prozent UND Absolutbetrag', () => {
    // 5 € über einem 3-€-Median sind +166 %, aber kein Befund; 60 € über
    // 4.000 € sind viel Geld, aber +1,5 %.
    expect(findeAusreisser(serie([3, 3, 8]))).toHaveLength(0);
    expect(findeAusreisser(serie([4000, 4000, 4060]))).toHaveLength(0);
  });

  it('sollte unter drei Monaten Historie nichts behaupten', () => {
    expect(findeAusreisser(serie([100, 500]))).toHaveLength(0);
  });
});

describe('median', () => {
  it('sollte gerade und ungerade Längen beherrschen', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

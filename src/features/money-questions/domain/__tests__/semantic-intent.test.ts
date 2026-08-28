import { describe, expect, it } from 'vitest';
import {
  quantisiere,
  kosinus,
  klassenScore,
  semantischeVorschlaege,
  vektorAusBase64,
  MIN_SCORE,
  MAX_VORSCHLAEGE,
  type SemantischeKlasse,
} from '@/features/money-questions/domain/semantic-intent';

/** L2-normierter Testvektor. */
function norm(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / n);
}

describe('semantic-intent (Router-Stufe 3, reine Logik)', () => {
  it('sollte Quantisierung und base64 verlustarm hin- und zurückführen', () => {
    const v = norm([0.3, -0.5, 0.8, 0.1]);
    const q = quantisiere(v);
    let b = '';
    for (let i = 0; i < q.length; i += 1) b += String.fromCharCode(q[i] & 0xff);
    const zurueck = vektorAusBase64(Buffer.from(b, 'binary').toString('base64'));
    expect([...zurueck]).toEqual([...q]);
    // Kosinus mit sich selbst bleibt 1 — die Rundung verschiebt die Norm,
    // aber kosinus() rechnet sie neu.
    expect(kosinus(q, zurueck)).toBeCloseTo(1, 5);
  });

  it('sollte den kNN-3-Score als Mittel der drei ähnlichsten Paraphrasen rechnen', () => {
    const frage = quantisiere(norm([1, 0, 0]));
    const klasse: SemantischeKlasse = {
      klasse: 'x',
      vektoren: [
        quantisiere(norm([1, 0, 0])), // ~1.0
        quantisiere(norm([1, 1, 0])), // ~0.707
        quantisiere(norm([0, 1, 0])), // ~0.0
        quantisiere(norm([-1, 0, 0])), // ~-1.0 — darf im top-3-Mittel nicht landen
      ],
    };
    expect(klassenScore(frage, klasse)).toBeCloseTo((1 + Math.SQRT1_2 + 0) / 3, 2);
  });

  it('sollte mit weniger als drei Paraphrasen über die vorhandenen mitteln', () => {
    const frage = quantisiere(norm([1, 0]));
    expect(
      klassenScore(frage, { klasse: 'x', vektoren: [quantisiere(norm([1, 0]))] }),
    ).toBeCloseTo(1, 3);
  });

  it('sollte unter MIN_SCORE nichts vorschlagen', () => {
    const frage = quantisiere(norm([1, 0, 0]));
    const fern: SemantischeKlasse = { klasse: 'fern', vektoren: [quantisiere(norm([0, 1, 0]))] };
    expect(semantischeVorschlaege(frage, [fern])).toEqual([]);
  });

  it('sollte höchstens MAX_VORSCHLAEGE Klassen anbieten, beste zuerst', () => {
    const frage = quantisiere(norm([1, 0.01, 0]));
    const klassen: SemantischeKlasse[] = ['a', 'b', 'c', 'd'].map((k, i) => ({
      klasse: k,
      vektoren: [quantisiere(norm([1, i * 0.02, 0]))],
    }));
    const v = semantischeVorschlaege(frage, klassen);
    expect(v.length).toBe(MAX_VORSCHLAEGE);
    expect(v[0].score).toBeGreaterThanOrEqual(v[1].score);
    expect(v.every((x) => x.score >= MIN_SCORE)).toBe(true);
  });

  it('[REGRESSION] sollte die Pseudo-Klasse __luecke__ verwerfen, statt einen Platz zu verschenken', () => {
    // Laufzeit-Fund mit dem echten Modell: `__luecke__` ist der
    // Trainings-Marker für benannte Lücken, keine Antwortfamilie. Der Router
    // verwirft ihn ohnehin — aber er BELEGTE einen der drei Plätze und
    // verdrängte damit einen echten Kandidaten.
    const frage = quantisiere(norm([1, 0, 0]));
    const naeher = quantisiere(norm([1, 0.02, 0]));
    const klassen: SemantischeKlasse[] = [
      { klasse: '__luecke__', vektoren: [quantisiere(norm([1, 0, 0]))] },
      { klasse: 'a', vektoren: [naeher] },
      { klasse: 'b', vektoren: [naeher] },
      { klasse: 'c', vektoren: [naeher] },
    ];
    const v = semantischeVorschlaege(frage, klassen);
    expect(v.map((x) => x.klasse)).toEqual(['a', 'b', 'c']);
  });

  it('[SECURITY] sollte Aktions-Klassen auch bei perfekter Ähnlichkeit verwerfen', () => {
    const frage = quantisiere(norm([1, 0, 0]));
    const aktion: SemantischeKlasse = {
      klasse: 'budget.aktion',
      vektoren: [quantisiere(norm([1, 0, 0]))],
    };
    expect(semantischeVorschlaege(frage, [aktion])).toEqual([]);
  });
});

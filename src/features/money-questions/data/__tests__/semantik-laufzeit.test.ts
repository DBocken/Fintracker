// @vitest-environment node
/**
 * Laufzeit-Nachweis mit dem ECHTEN Modell — läuft nur auf Zuruf:
 *
 *     SEMANTIK_E2E=1 pnpm vitest run src/features/money-questions/data/__tests__/semantik-laufzeit.test.ts
 *
 * Jede andere Prüfung dieses Pfads arbeitet mit Doppeln oder mit
 * eingefrorenen Embeddings. Keine davon beweist, dass die Kette WIRKLICH
 * läuft: Bibliothek laden, echte Vektoren rechnen, daraus eine Auswahl
 * bauen — und dass eine Frage, die der deterministische Router NICHT
 * versteht, danach bei der richtigen Familie landet.
 *
 * Bewusst in der **Node-Umgebung**: `transformers.js` hält jsdom für einen
 * Browser und sucht dort eine Cache-API, die es nicht gibt — der Lauf bleibt
 * dann ohne Fehlermeldung hängen (nachgemessen: zwei Abbrüche nach je zehn
 * Minuten). Der Cache-Storage-Teil ist deshalb mit einem Doppel geprüft
 * (`services/__tests__/semantic-intent-service.test.ts`), die Rechnung hier.
 *
 * In CI übersprungen — dort misst die Fixture-Ratsche ohne Download.
 */
import { describe, expect, it } from 'vitest';
import { paraphrasenFuer, intentBeispieleFuer } from '../paraphrases';
import { questionCatalog } from '../question-catalog';
import { erweitereUmSemantik, routeFrage, zerlegeAusloeser } from '@/lib/question-matcher';
import type { QuestionVocabulary } from '@/lib/question-matcher';
import { predictIntent, trainIntentModel } from '@/lib/question-intent-model';
import { translations } from '@/i18n/translations';

const laeuft = process.env.SEMANTIK_E2E === '1';
const JETZT = new Date('2026-08-23T12:00:00Z');

function ausloeserWorte(key: string): string[] {
  let knoten: unknown = translations.de;
  for (const teil of key.split('.')) {
    knoten = (knoten as Record<string, unknown> | undefined)?.[teil];
  }
  return typeof knoten === 'string' ? zerlegeAusloeser(knoten) : [];
}

const VOKABULAR: QuestionVocabulary = {
  kategorien: [],
  konten: [],
  haendler: [{ wort: 'netflix', wert: 'netflix' }],
  ausloeser: new Map(
    questionCatalog.entries.map((e) => [e.id, e.ausloeser.flatMap(ausloeserWorte)]),
  ),
  verstaerker: new Map(
    questionCatalog.entries.map((e) => [e.id, (e.verstaerker ?? []).flatMap(ausloeserWorte)]),
  ),
};

const MODELL = trainIntentModel(intentBeispieleFuer('de'));

/**
 * Fragen, die Stufe 0–2 NACHWEISLICH nicht tragen — der Test prüft das
 * ausdrücklich, bevor er das Modell befragt. Sonst misse er die Stufen
 * davor und wäre grün, ohne je ein Embedding gerechnet zu haben.
 */
const FRAGEN: readonly { frage: string; erwartet: string }[] = [
  { frage: 'was kostet mich streaming im monat', erwartet: 'ausgaben' },
  { frage: 'hab ich noch luft diesen monat', erwartet: 'forecast' },
];

/**
 * NICHT jede umgangssprachliche Frage trägt — und das ist richtig so.
 * Gemessen mit dem echten Modell: „sag mal, was schluckt mein streaming
 * eigentlich so" landet bei `vermoegen.entwicklung` (0.859), „was geht bei
 * netflix so weg" bei `kategorie.begruendung` (0.844) — beide inhaltlich
 * daneben. Beide liegen unter
 * der Schwelle und werden deshalb stumm — eine falsche Familie anzubieten
 * wäre schlechter als zu schweigen. Diese Zeilen halten fest, dass die
 * Schwelle ihren Zweck erfüllt.
 */
const ZU_WEIT_WEG: readonly string[] = [
  'sag mal, was schluckt mein streaming eigentlich so',
  'was geht bei netflix so weg',
];

describe.skipIf(!laeuft)('Router-Stufe 3 mit dem ECHTEN Modell', () => {
  it('sollte tatsächlich über das Modell routen', { timeout: 1_800_000 }, async () => {
    const { semantikVorschlaegeFuer } = await import('@/services/semantic-intent-service');
    const paraphrasen = paraphrasenFuer('de');
    const protokoll: string[] = [];

    for (const { frage, erwartet } of FRAGEN) {
      const vorher = routeFrage(
        frage,
        VOKABULAR,
        questionCatalog.entries,
        'de',
        JETZT,
        predictIntent(MODELL, frage),
      );
      const leerVorher =
        vorher.art === 'unverstanden' ||
        (vorher.art === 'kandidaten' &&
          (vorher as { nurVermutung?: boolean }).nurVermutung === true);
      expect(
        leerVorher,
        `Stufen 0-2 verstehen „${frage}" bereits — als Prüffall untauglich`,
      ).toBe(true);

      const vorschlaege = await semantikVorschlaegeFuer(frage, paraphrasen);
      expect(vorschlaege.length, `keine Vorschläge für „${frage}"`).toBeGreaterThan(0);

      const nachher = erweitereUmSemantik(
        vorher,
        frage,
        VOKABULAR,
        questionCatalog.entries,
        'de',
        JETZT,
        vorschlaege,
      );
      expect(nachher.art, 'Stufe 3 hat still geantwortet statt zu fragen').toBe('kandidaten');
      if (nachher.art !== 'kandidaten') return;
      expect(nachher.nurVermutung).toBe(true);

      const ids = nachher.top.map((k) => k.entryId);
      protokoll.push(`${frage}\n   -> ${ids.join(', ')}`);
      expect(
        ids.some((id) => id.startsWith(erwartet)),
        `erwartet eine ${erwartet}-Familie, bekommen: ${ids.join(', ')}`,
      ).toBe(true);

      // Ein schreibender Eintrag darf hier nie auftauchen — an keiner Frage.
      expect(ids.some((id) => id.endsWith('.aktion'))).toBe(false);
    }

    // Und die Gegenprobe: Wo das Modell danebenliegt, schweigt es.
    for (const frage of ZU_WEIT_WEG) {
      const vorschlaege = await semantikVorschlaegeFuer(frage, paraphrasen);
      protokoll.push(`${frage}\n   -> (stumm, ${vorschlaege.length} Vorschläge)`);
      expect(
        vorschlaege.length,
        `„${frage}" liegt unter der Schwelle und darf nichts vorschlagen`,
      ).toBe(0);
    }

    // Kein Vorschlag darf je eine Pseudo-Klasse sein (Laufzeit-Fund).
    for (const { frage } of FRAGEN) {
      const vorschlaege = await semantikVorschlaegeFuer(frage, paraphrasen);
      expect(vorschlaege.some((v) => v.klasse.startsWith('__'))).toBe(false);
    }

    // Beleg des Laufzeit-Nachweises; sichtbar mit `--reporter=verbose`.
    console.log(`\nECHTES MODELL — Routing:\n${protokoll.join('\n')}\n`);
  });
});

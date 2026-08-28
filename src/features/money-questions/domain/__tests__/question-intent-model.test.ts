import { describe, expect, it } from 'vitest';
import {
  intentMerkmale,
  LUECKE_KLASSE,
  predictIntent,
  trainIntentModel,
  type IntentBeispiel,
} from '@/features/money-questions/domain/question-intent-model';

const BEISPIELE: IntentBeispiel[] = [
  { klasse: 'ausgaben.kategorie', text: 'wie viel habe ich für lebensmittel ausgegeben' },
  { klasse: 'ausgaben.kategorie', text: 'was habe ich für kleidung bezahlt' },
  { klasse: 'ausgaben.kategorie', text: 'meine ausgaben für freizeit diesen monat' },
  { klasse: 'schulden.restschuld', text: 'wie hoch sind meine schulden' },
  { klasse: 'schulden.restschuld', text: 'wie viel restschuld habe ich offen' },
  { klasse: 'schulden.restschuld', text: 'was bin ich noch schuldig' },
  { klasse: LUECKE_KLASSE, text: 'was soll ich tun um reich zu werden' },
  { klasse: LUECKE_KLASSE, text: 'welche strategie empfiehlst du mir' },
  { klasse: LUECKE_KLASSE, text: 'wie plane ich meine zukunft am besten' },
];

describe('question-intent-model', () => {
  const model = trainIntentModel(BEISPIELE);

  it('sollte eine Umschreibung der richtigen Klasse zuordnen', () => {
    // Kein Wort der Trainingssätze muss wörtlich vorkommen — die Subword-
    // Gramme tragen („bezahlt"/„ausgegeben" teilen nichts, „lebensmittel"
    // schon).
    expect(predictIntent(model, 'wieviel gingen für lebensmittel drauf')?.klasse).toBe(
      'ausgaben.kategorie',
    );
  });

  it('[REGRESSION] sollte Tippfehler über Zeichen-Gramme überleben', () => {
    // Die 25 Korpus-Fragen mit kaputter Rechtschreibung sind der Grund für
    // die Subword-Entscheidung: „schuldne" teilt fast alle Gramme mit
    // „schulden".
    expect(predictIntent(model, 'wie hoch sind meine schuldne')?.klasse).toBe(
      'schulden.restschuld',
    );
  });

  it('sollte Beratungssprache der Lücken-Klasse geben', () => {
    expect(predictIntent(model, 'welche strategie ist für mich am besten')?.klasse).toBe(
      LUECKE_KLASSE,
    );
  });

  it('sollte ohne bekanntes Merkmal nichts behaupten', () => {
    expect(predictIntent(model, 'xyz qqq')).toBeNull();
  });

  it('sollte deterministisch sein — gleiche Eingabe, gleiches Modell', () => {
    const gemischt = trainIntentModel([...BEISPIELE].reverse());
    expect(predictIntent(gemischt, 'wie hoch sind meine schulden')).toEqual(
      predictIntent(model, 'wie hoch sind meine schulden'),
    );
  });

  it('sollte Ziffern falten — 5000 und 3000 stellen dieselbe Frage', () => {
    const m = intentMerkmale('urlaub für 5000');
    expect(m).toEqual(intentMerkmale('urlaub für 3000'));
  });
});

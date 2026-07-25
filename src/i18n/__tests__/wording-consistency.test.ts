import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '../translations';
import { lookupWorded } from '../I18nProvider';
import { overlayFor } from '../overlays';
import { glossaryTermKey, type GlossaryTermId } from '../glossary';

/**
 * Derselbe Fachbegriff muss in der Alltagssprache überall dasselbe Wort
 * bekommen.
 *
 * Welle 1 hat das an zwei Stellen verletzt, und zwar sichtbar: das Dashboard
 * nannte die Kennzahl weiter „Sparquote", während das Coach-Raster daneben auf
 * DEMSELBEN Bildschirm schon „Wie viel du sparst" sagte. Ebenso sagte die
 * Nettovermögen-Kachel „Verfügbares Geld", ihr eigener Erklärtext aber weiter
 * „Liquidität".
 *
 * Ein Overlay kann so etwas nicht von sich aus verhindern — es ist eine Liste
 * einzelner Keys, die nichts voneinander wissen. Deshalb dieser Test: er
 * gruppiert die Keys, die dasselbe Konzept benennen, und besteht darauf, dass
 * sie im selben Register auch denselben Text tragen.
 */

/**
 * Keys, die dasselbe Konzept beschriften — im Alltagsregister wortgleich.
 *
 * `term` ist optional: nicht jedes wiederholte Label hat ein Glossar-Stichwort.
 * „Kennzahlen" etwa steht an zwei Stellen derselben Ansicht, gehört aber nicht
 * ins Glossar — es ist Oberflächen-Chrome, kein Fachbegriff. Solche Gruppen
 * prüft nur der Gleichheits-Test, nicht der Glossar-Abgleich.
 */
type ConceptGroup = {
  term?: GlossaryTermId;
  keys: string[];
  /**
   * `equal` (Standard): alle Keys tragen exakt denselben Text — für Labels, die
   * dasselbe Ding benennen. `startsWith`: der erste Key ist die Kurzform, die
   * übrigen bauen darauf auf — für Paare wie Nav-Eintrag + Untertitel, die
   * nebeneinander stehen und deshalb dasselbe Wort führen müssen, aber nicht
   * derselbe Satz sein können.
   */
  matcher?: 'equal' | 'startsWith';
};

const SAME_CONCEPT: ConceptGroup[] = [
  {
    term: 'savingsRate',
    keys: [
      'kpi.savingsRate.label',
      'health.savingsRate',
      'coach.statusGridSavingsLabel',
      'financialHealthService.savingsRateLabel',
      'premium.smartInsights.savingsRate',
    ],
  },
  {
    term: 'liquidity',
    keys: [
      'netWorth.liquidity',
      'health.liquidity',
      'other.liquidityTitle',
      'coach.statusGridLiquidityLabel',
      'financialHealthService.liquidityLabel',
    ],
  },
  {
    // Abschnittsüberschrift und Auswahl-Label derselben Dashboard-Sektion.
    keys: ['kpi.sectionTitle', 'kpi.kpisLabel'],
  },
  {
    // Nav-Eintrag und sein eigener Untertitel stehen direkt untereinander.
    keys: ['nav.items.trading', 'nav.subtitles.trading'],
    matcher: 'startsWith',
  },
];

describe('Begriffs-Konsistenz in der Alltagssprache', () => {
  it('[REGRESSION] sollte dasselbe Konzept ueberall gleich benennen', () => {
    const drifts: string[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      if (!overlayFor('everyday', locale)) continue; // Locales ohne Overlay: Basis
      for (const { keys, matcher = 'equal' } of SAME_CONCEPT) {
        const rendered = keys.map((key) => lookupWorded(locale, key, 'everyday') ?? '');
        const [head, ...rest] = rendered;
        const ok =
          matcher === 'equal'
            ? rest.every((text) => text === head)
            : rest.every((text) => text.startsWith(head));
        if (!ok) {
          drifts.push(`${locale}: ${keys.map((k, i) => `${k}="${rendered[i]}"`).join(' | ')}`);
        }
      }
    }

    expect(drifts).toEqual([]);
  });

  it('sollte das Glossar-Stichwort mit der Oberflaeche in Einklang halten', () => {
    // Wer im Glossar „Wie viel du sparst" liest, muss genau das auch auf dem
    // Dashboard wiederfinden — sonst erklaert das Glossar ein Wort, das
    // nirgends steht.
    const mismatches: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      if (!overlayFor('everyday', locale)) continue;
      for (const { term, keys } of SAME_CONCEPT) {
        if (!term) continue; // Oberflaechen-Chrome ohne Glossar-Stichwort
        const glossary = lookupWorded(locale, glossaryTermKey(term), 'everyday');
        const surface = lookupWorded(locale, keys[0], 'everyday');
        if (glossary !== surface) {
          mismatches.push(`${locale}/${term}: Glossar="${glossary}" vs. ${keys[0]}="${surface}"`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '../translations';
import { overlayFor } from '../overlays';
import { everydayDe } from '../overlays/everyday/de';

/**
 * Jede unterstützte Sprache braucht ein Alltagssprache-Overlay.
 *
 * Der Sprachstil ist ein Barrierefreiheits-Versprechen: wer die Fachsprache
 * nicht kennt, soll die App trotzdem verstehen. Eine Sprache ohne Overlay
 * bekommt dieses Versprechen NICHT — sie sieht ausschließlich die Fachsprache,
 * und der Schalter in den Einstellungen ist für sie tot. Das war für Russisch
 * eine Weile der Fall, ohne dass irgendetwas rot wurde: `overlayFor()` gibt
 * dann einfach `undefined` zurück und `t()` fällt still auf die Basis durch.
 *
 * Deshalb dieser Test. Er ist die Bremse für den naheliegenden Fehler, eine
 * neue Sprache in `SUPPORTED_LOCALES` einzutragen und das Overlay zu
 * vergessen — die neue Sprache wäre sonst ab Tag eins die einzige ohne
 * Alltagssprache.
 */
function countLeaves(node: unknown): number {
  if (typeof node === 'string') return 1;
  if (!node || typeof node !== 'object') return 0;
  return Object.values(node as Record<string, unknown>).reduce<number>(
    (sum, child) => sum + countLeaves(child),
    0,
  );
}

describe('Overlay-Abdeckung der Alltagssprache', () => {
  it('sollte fuer jede unterstuetzte Sprache ein Overlay haben', () => {
    const missing = SUPPORTED_LOCALES.filter((locale) => !overlayFor('everyday', locale));
    expect(missing).toEqual([]);
  });

  it('sollte in keiner Sprache ein Feigenblatt-Overlay sein', () => {
    // Ein Overlay mit fuenf Eintraegen wuerde den obigen Test bestehen und das
    // Versprechen trotzdem nicht einloesen. Deutsch ist die Referenz-Sprache;
    // die anderen duerfen kleiner sein (im Englischen ist „Fixed costs"
    // bereits Alltagssprache), aber nicht beliebig klein.
    const reference = countLeaves(everydayDe);
    const thin = SUPPORTED_LOCALES.map((locale) => ({
      locale,
      leaves: countLeaves(overlayFor('everyday', locale)),
    })).filter(({ leaves }) => leaves < reference * 0.5);

    expect(thin).toEqual([]);
  });
});

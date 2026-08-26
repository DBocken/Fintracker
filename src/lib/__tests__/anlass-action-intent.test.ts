import { describe, expect, it } from 'vitest';
import { extrahiereAnlassAktion } from '../anlass-action-intent';

/**
 * Der Prüfpunkt, der über die Grammatik hinausgeht: die **Abgrenzung zum
 * Kategorisier-Befehl**. „Ordne Rewe zu Lebensmitteln" und „Ordne die
 * Buchungen dem Anlass Urlaub zu" tragen dasselbe Verb und dieselbe
 * Satzform; die falsche Achse zu treffen hiesse, eine Kategorie zu ändern,
 * wo eine Anlass-Zuordnung gemeint war.
 */

describe('extrahiereAnlassAktion', () => {
  it('sollte das Anlegen eines Anlasses erkennen', () => {
    const a = extrahiereAnlassAktion('Leg einen Anlass Urlaub Italien an');
    expect(a?.art).toBe('anlegen');
    expect(a?.anlassText).toContain('urlaub');
  });

  it('sollte das Zuordnen zu einem Anlass erkennen', () => {
    const a = extrahiereAnlassAktion('Ordne die Buchungen dem Anlass Hochzeit zu');
    expect(a?.art).toBe('zuordnen');
    expect(a?.anlassText).toContain('hochzeit');
  });

  it('[REGRESSION] sollte ohne Anlass-Wort NICHT greifen', () => {
    // Sonst fienge dieser Befehl die Kategorie-Zuordnung ab — dasselbe Verb,
    // dieselbe Satzform, die andere Achse.
    expect(extrahiereAnlassAktion('Ordne Rewe zu Lebensmitteln')).toBeNull();
  });

  it('[REGRESSION] sollte eine FRAGE nie als Befehl deuten', () => {
    expect(extrahiereAnlassAktion('Welche Buchungen gehören zum Anlass Urlaub?')).toBeNull();
    expect(extrahiereAnlassAktion('Wie lege ich einen Anlass an')).toBeNull();
  });

  it('sollte ohne Aktionsverb nichts erkennen', () => {
    // „Der Anlass Urlaub war teuer" ist eine Feststellung, kein Befehl.
    expect(extrahiereAnlassAktion('Der Anlass Urlaub war teuer')).toBeNull();
  });
});

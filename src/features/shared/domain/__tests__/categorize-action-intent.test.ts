import { describe, expect, it } from 'vitest';
import { extrahiereKategorieAktion } from '@/features/shared/domain/categorize-action-intent';

/**
 * Der Kern dieser Grammatik ist die Unterscheidung zwischen einer KORREKTUR
 * am Bestand und einer DAUERREGEL für die Zukunft. Beides zu verwechseln
 * wäre kein Schönheitsfehler: Wer „ordne zu" sagt und eine Dauerregel
 * bekommt, hat eine Automatik eingeschaltet, um die er nicht gebeten hat.
 */

describe('extrahiereKategorieAktion', () => {
  it('sollte eine einmalige Zuordnung erkennen', () => {
    const a = extrahiereKategorieAktion('Ordne die Rewe-Buchungen zu Lebensmitteln');
    expect(a?.art).toBe('zuordnen');
    expect(a?.haendlerText).toContain('rewe');
    expect(a?.kategorieText).toContain('lebensmittel');
  });

  it('sollte ein ausdrückliches Dauer-Signal als Regel erkennen', () => {
    const a = extrahiereKategorieAktion('Ordne Rewe immer zu Lebensmitteln');
    expect(a?.art).toBe('merken');
  });

  it('sollte „merk dir" als Regel erkennen', () => {
    const a = extrahiereKategorieAktion('Merk dir: Rewe ist Kategorie Lebensmittel');
    expect(a?.art).toBe('merken');
  });

  it('[REGRESSION] sollte eine FRAGE nie als Befehl deuten', () => {
    // Das Imperativ-Gate. Eine falsch beantwortete Frage zeigt eine falsche
    // Zahl; ein falsch gedeuteter Befehl schlägt eine Änderung an den Daten
    // vor.
    expect(extrahiereKategorieAktion('Welche Buchungen soll ich Lebensmitteln zuordnen?')).toBeNull();
    expect(extrahiereKategorieAktion('Wie ordne ich Rewe zu Lebensmitteln')).toBeNull();
    expect(extrahiereKategorieAktion('Ordne Rewe zu Lebensmitteln?')).toBeNull();
  });

  it('sollte ein blosses „immer" ohne Kategorie-Bezug NICHT zur Aktion machen', () => {
    // Sonst löste jedes „immer" im Satz eine Schreib-Vorschau aus.
    expect(extrahiereKategorieAktion('Bei Rewe kaufe ich immer zu viel ein')).toBeNull();
  });

  it('sollte ohne Trenner den Rest als Händler führen und die Kategorie offen lassen', () => {
    // Raten wäre hier besonders teuer: Eine falsch zugeordnete Kategorie
    // verfälscht jede spätere Summe. Die Fläche fragt dann nach.
    const a = extrahiereKategorieAktion('Ordne Rewe zu');
    expect(a?.art).toBe('zuordnen');
    expect(a?.kategorieText).toBeUndefined();
  });
});

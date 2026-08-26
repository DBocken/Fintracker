import { describe, expect, it } from 'vitest';
import { extrahiereTransferAktion } from '../transfer-action-intent';

/**
 * Das strengste Gate der drei Aktions-Grammatiken — und der Grund steht in
 * der Wirkung: Ein markierter Übertrag verschwindet aus JEDER Auswertung.
 * Wer ihn versehentlich auslöst, sucht die Ursache in den Zahlen und findet
 * sie dort nie.
 */

describe('extrahiereTransferAktion', () => {
  it('sollte den Markier-Befehl erkennen', () => {
    expect(extrahiereTransferAktion('Markiere die Umbuchungen als Überträge')?.art).toBe('markieren');
    expect(extrahiereTransferAktion('Verknüpfe die erkannten Überträge')?.art).toBe('markieren');
  });

  it('[REGRESSION] sollte ohne Übertrags-Wort NICHT greifen', () => {
    // „Markiere die Buchung" könnte alles Mögliche meinen.
    expect(extrahiereTransferAktion('Markiere die Buchung')).toBeNull();
  });

  it('sollte ohne Markier-Verb NICHT greifen', () => {
    // Das Wort allein ist eine Feststellung, kein Befehl.
    expect(extrahiereTransferAktion('Da sind ein paar Umbuchungen dabei')).toBeNull();
  });

  it('[REGRESSION] sollte eine FRAGE nie als Befehl deuten', () => {
    expect(extrahiereTransferAktion('Soll ich die Umbuchungen markieren?')).toBeNull();
    expect(extrahiereTransferAktion('Welche Umbuchungen soll ich markieren')).toBeNull();
  });
});

/**
 * Eine ausgelieferte Kategorie zu bearbeiten muss sie BEARBEITEN.
 *
 * Der Befund: `updateInKategorien` leitete jede Kategorie mit
 * `is_default: true` an die NEUANLAGE um — mit neuer ID, während die alte in
 * der Liste stehen blieb. Zwei Folgen, beide gemessen:
 *
 * - Bleibt der Name gleich, schlägt die Dublettenprüfung gegen die eigene
 *   Ursprungszeile an und das Speichern bricht ab.
 * - Wird umbenannt, stehen danach ZWEI Kategorien da, und sämtliche
 *   Buchungen, Budgets und Händlerregeln hängen weiter an der alten.
 *
 * Alle ausgelieferten Kategorien tragen `is_default: true`. Betroffen war
 * damit der Normalfall — „ich ändere die Stichwörter von Lebensmittel".
 *
 * Geprüft wird gegen den ECHTEN Speicher und die ECHTEN Saat-Kategorien, nicht
 * gegen ein Doppel: Der Befund hängt genau daran, wie die Saat aussieht.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLocalCategories,
  updateLocalCategory,
  saveLocalCategory,
} from '../local-settings-service';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import type { Category } from '@/lib/category-types';

async function ersteAusgelieferte(): Promise<Category> {
  const alle = await getLocalCategories();
  const standard = alle.find((c) => c.is_default === true && c.parent_id === null);
  if (!standard) throw new Error('Keine ausgelieferte Hauptkategorie in der Saat gefunden');
  return standard;
}

describe('Ausgelieferte Kategorie bearbeiten', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it('sollte ueberhaupt ausgelieferte Kategorien haben', async () => {
    // Wenn diese Annahme faellt, pruefen die Tests darunter etwas anderes,
    // als sie sagen.
    const alle = await getLocalCategories();

    expect(alle.length).toBeGreaterThan(50);
    expect(alle.filter((c) => c.is_default === true).length).toBeGreaterThan(50);
  });

  it('[REGRESSION] sollte nicht am eigenen Namen scheitern', async () => {
    // Der haeufigste Fall ueberhaupt: Stichwoerter ergaenzen, Name unveraendert.
    // Vorher warf das "Eine Kategorie mit diesem Namen existiert bereits" —
    // die Pruefung lief gegen die eigene Ursprungszeile.
    const vorher = await ersteAusgelieferte();

    await expect(
      updateLocalCategory({ ...vorher, filters: [...(vorher.filters ?? []), 'neuesstichwort'] }),
    ).resolves.toBeDefined();

    const nachher = await getLocalCategories();
    const gleiche = nachher.find((c) => c.id === vorher.id)!;
    expect(gleiche.filters).toContain('neuesstichwort');
  });

  it('[REGRESSION] sollte die ID behalten, damit Buchungen daran haengen bleiben', async () => {
    // Das ist der teure Teil des Befunds: Eine neue ID heisst, dass jede
    // Buchung, jedes Budget und jede Haendlerregel weiter auf die ALTE Zeile
    // zeigt — die Aenderung wirkt sich auf nichts aus.
    const vorher = await ersteAusgelieferte();

    const ergebnis = await updateLocalCategory({ ...vorher, name: 'Selbst benannt' });

    expect(ergebnis.id).toBe(vorher.id);
    const nachher = await getLocalCategories();
    expect(nachher.find((c) => c.id === vorher.id)!.name).toBe('Selbst benannt');
  });

  it('[REGRESSION] sollte keine zweite Zeile anlegen', async () => {
    const vorZahl = (await getLocalCategories()).length;
    const vorher = await ersteAusgelieferte();

    await updateLocalCategory({ ...vorher, name: 'Selbst benannt', color: '#ff0000' });

    expect((await getLocalCategories()).length).toBe(vorZahl);
  });

  it('sollte die Kategorie danach als vom Nutzer ueberschrieben markieren', async () => {
    // `is_default: false` ist in diesem Baum kein Herkunftsvermerk, sondern ein
    // Vertrag: Migrationen und Kategoriepakete lassen genau die Zeilen in Ruhe,
    // die so markiert sind. Ohne dieses Zuruecksetzen wuerde das naechste
    // Kategoriepaket die Aenderung der Nutzerin wieder ueberschreiben.
    const vorher = await ersteAusgelieferte();

    const ergebnis = await updateLocalCategory({
      ...vorher,
      filters: [...(vorher.filters ?? []), 'meins'],
    });

    expect(ergebnis.is_default).toBe(false);
  });

  it('sollte den Uebersetzungsschluessel behalten, wenn nur die Farbe geaendert wurde', async () => {
    // Sonst verloere eine ausgelieferte Kategorie ihre Uebersetzung, weil
    // jemand sie umgefaerbt hat — beim naechsten Sprachwechsel staende dort
    // der zuletzt angezeigte Name fest.
    const alle = await getLocalCategories();
    const mitSchluessel = alle.find((c) => c.is_default === true && c.name_key);
    if (!mitSchluessel) throw new Error('Keine uebersetzte Saat-Kategorie gefunden');

    const ergebnis = await updateLocalCategory({ ...mitSchluessel, color: '#123456' });

    expect(ergebnis.name_key).toBe(mitSchluessel.name_key);
  });

  it('sollte den Uebersetzungsschluessel loeschen, wenn umbenannt wurde', async () => {
    // Ab der ersten Umbenennung gewinnt der Text der Nutzerin; ein
    // Sprachwechsel darf ihn nicht mehr anfassen.
    const alle = await getLocalCategories();
    const mitSchluessel = alle.find((c) => c.is_default === true && c.name_key)!;

    const ergebnis = await updateLocalCategory({ ...mitSchluessel, name: 'Ganz anders' });

    expect(ergebnis.name_key).toBeNull();
    expect(ergebnis.name).toBe('Ganz anders');
  });

  it('sollte eine echte Dublette weiterhin abweisen', async () => {
    // Die Pruefung muss bleiben — sie darf nur nicht mehr gegen die eigene
    // Zeile laufen.
    await saveLocalCategory({ name: 'Voellig Neuer Name' });
    const vorher = await ersteAusgelieferte();

    await expect(
      updateLocalCategory({ ...vorher, name: 'Voellig Neuer Name' }),
    ).rejects.toThrow();
  });
});

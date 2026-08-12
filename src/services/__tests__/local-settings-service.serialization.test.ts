import { describe, it, expect, beforeEach } from 'vitest';
import {
  completeTutorialChapter,
  getLocalUserSettings,
  updateLocalUserSettings,
  getLocalCategories,
  saveLocalCategory,
  deleteLocalCategory,
} from '../local-settings-service';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';

/**
 * Gleichzeitige Schreibvorgänge auf Einstellungen und Kategorien
 * (Issue #293, Ursachenklasse #311).
 *
 * Der Auslöser stand im Betrieb: `DataSourceDialog` und `OnboardingDialog`
 * schreiben beide über `updateUserSettings`. Wurden sie unmittelbar
 * nacheinander bestätigt, ging `tutorial_source` verloren und die
 * Datenquellen-Weiche stand beim nächsten Seitenwechsel wieder da.
 */
describe('local-settings-service: gleichzeitige Schreibvorgänge', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearLocalKvStore();
    localEncryption.lock();
  });

  it('[REGRESSION] sollte bei zwei gleichzeitigen updateUserSettings kein Feld verlieren', async () => {
    await Promise.all([
      updateLocalUserSettings({ tutorial_source: 'csv' }),
      updateLocalUserSettings({ retention_months: 12 }),
    ]);

    const settings = await getLocalUserSettings();
    expect(settings.tutorial_source).toBe('csv');
    expect(settings.retention_months).toBe(12);
  });

  it('[REGRESSION] sollte bei vielen gleichzeitigen Änderungen jedes Feld behalten', async () => {
    await Promise.all([
      updateLocalUserSettings({ tutorial_source: 'bank' }),
      updateLocalUserSettings({ retention_months: 24 }),
      updateLocalUserSettings({ auto_confirm_mapping: true }),
      updateLocalUserSettings({ enable_subcategories: false }),
      updateLocalUserSettings({ tax_reserve_percent: 42 }),
    ]);

    const settings = await getLocalUserSettings();
    expect(settings).toMatchObject({
      tutorial_source: 'bank',
      retention_months: 24,
      auto_confirm_mapping: true,
      enable_subcategories: false,
      tax_reserve_percent: 42,
    });
  });

  it('sollte den zuletzt geschriebenen Wert desselben Feldes behalten', async () => {
    // Bei gleichem Feld gibt es keinen „richtigen" Gewinner — wohl aber die
    // Zusicherung, dass einer der beiden Werte vollständig gewinnt und nicht
    // ein Mischzustand entsteht.
    await Promise.all([
      updateLocalUserSettings({ retention_months: 6 }),
      updateLocalUserSettings({ retention_months: 48 }),
    ]);

    const settings = await getLocalUserSettings();
    expect([6, 48]).toContain(settings.retention_months);
  });

  it('[REGRESSION] sollte bei zwei gleichzeitigen Kategorie-Anlagen beide behalten', async () => {
    const vorher = (await getLocalCategories()).length;

    await Promise.all([
      saveLocalCategory({ name: 'Angeln' }),
      saveLocalCategory({ name: 'Imkerei' }),
    ]);

    const namen = (await getLocalCategories()).map((c) => c.name);
    expect(namen).toContain('Angeln');
    expect(namen).toContain('Imkerei');
    expect(namen).toHaveLength(vorher + 2);
  });

  it('[REGRESSION] sollte zwei kurz aufeinanderfolgende Kapitelabschlüsse beide behalten', async () => {
    // Das zusammenhängende Tutorial schließt Kapitel unmittelbar
    // hintereinander ab. Rechnete die Aufrufstelle die neue Liste aus ihrem
    // (hinterherhinkenden) Query-Cache, überschrieb der zweite Abschluss den
    // ersten — lautlos, ohne Fehler. Deshalb hängt der Store selbst an.
    await Promise.all([
      completeTutorialChapter('transactions'),
      completeTutorialChapter('dashboard'),
    ]);

    const done = (await getLocalUserSettings()).tutorial_completed_chapters ?? [];
    expect(done).toContain('transactions');
    expect(done).toContain('dashboard');
  });

  it('sollte dasselbe Kapitel nicht zweimal führen', async () => {
    await completeTutorialChapter('transactions');
    await completeTutorialChapter('transactions');
    const done = (await getLocalUserSettings()).tutorial_completed_chapters ?? [];
    expect(done.filter((c) => c === 'transactions')).toHaveLength(1);
  });

  it('sollte den Dublettenschutz auch bei gleichzeitiger Anlage halten', async () => {
    // Die Prüfung liegt INNERHALB des Locks — läge sie davor, kämen beide
    // Aufrufe an ihr vorbei und der Name existierte doppelt.
    const ergebnisse = await Promise.allSettled([
      saveLocalCategory({ name: 'Angeln' }),
      saveLocalCategory({ name: 'Angeln' }),
    ]);

    expect(ergebnisse.filter((e) => e.status === 'fulfilled')).toHaveLength(1);
    expect(ergebnisse.filter((e) => e.status === 'rejected')).toHaveLength(1);
    expect((await getLocalCategories()).filter((c) => c.name === 'Angeln')).toHaveLength(1);
  });

  it('[REGRESSION] sollte eine gleichzeitige Löschung nicht durch eine Anlage rückgängig machen', async () => {
    const zuLoeschen = await saveLocalCategory({ name: 'Angeln' });

    await Promise.all([
      deleteLocalCategory(zuLoeschen.id),
      saveLocalCategory({ name: 'Imkerei' }),
    ]);

    const namen = (await getLocalCategories()).map((c) => c.name);
    expect(namen).not.toContain('Angeln');
    expect(namen).toContain('Imkerei');
  });
});

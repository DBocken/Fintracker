import { describe, expect, it } from 'vitest';
import { withKeyLock } from '../key-mutex';

/**
 * Warteschlange je Speicherschlüssel (Issue #311).
 *
 * Die Tests stellen das Rennen absichtlich her: zwei Abläufe, die beide erst
 * lesen, dann (nach einem echten await) schreiben. Ohne Serialisierung lesen
 * beide denselben Stand und der zweite überschreibt den ersten.
 */

/** Gibt die Kontrolle mehrfach ab — simuliert IndexedDB + AES-GCM dazwischen. */
async function tick(times = 3): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('withKeyLock', () => {
  it('sollte Abläufe auf demselben Schlüssel nacheinander ausführen', async () => {
    const ablauf: string[] = [];

    const einer = withKeyLock('konten', async () => {
      ablauf.push('A:start');
      await tick();
      ablauf.push('A:ende');
    });
    const zwei = withKeyLock('konten', async () => {
      ablauf.push('B:start');
      await tick();
      ablauf.push('B:ende');
    });

    await Promise.all([einer, zwei]);

    expect(ablauf).toEqual(['A:start', 'A:ende', 'B:start', 'B:ende']);
  });

  it('[REGRESSION] sollte bei Lesen-Ändern-Schreiben keinen Eintrag verlieren', async () => {
    let gespeichert: string[] = [];
    const lesenAendernSchreiben = (eintrag: string) =>
      withKeyLock('buchungen', async () => {
        const aktuell = gespeichert;
        await tick();
        gespeichert = [...aktuell, eintrag];
      });

    await Promise.all([lesenAendernSchreiben('a'), lesenAendernSchreiben('b')]);

    expect(gespeichert).toEqual(['a', 'b']);
  });

  it('sollte verschiedene Schlüssel nicht gegeneinander blockieren', async () => {
    const ablauf: string[] = [];

    await Promise.all([
      withKeyLock('konten', async () => {
        ablauf.push('konten:start');
        await tick();
        ablauf.push('konten:ende');
      }),
      withKeyLock('buchungen', async () => {
        ablauf.push('buchungen:start');
        await tick();
        ablauf.push('buchungen:ende');
      }),
    ]);

    // Verschränkt statt hintereinander: beide starten, bevor einer endet.
    expect(ablauf.slice(0, 2)).toEqual(['konten:start', 'buchungen:start']);
  });

  it('sollte den Rückgabewert des Ablaufs durchreichen', async () => {
    await expect(withKeyLock('konten', async () => 42)).resolves.toBe(42);
  });

  it('sollte einen Fehler an die Aufrufstelle weitergeben', async () => {
    await expect(
      withKeyLock('konten', async () => {
        throw new Error('kaputt');
      }),
    ).rejects.toThrow('kaputt');
  });

  it('sollte nach einem Fehler den nächsten Ablauf trotzdem starten (keine Verklemmung)', async () => {
    const gescheitert = withKeyLock('konten', async () => {
      await tick();
      throw new Error('kaputt');
    });
    const danach = withKeyLock('konten', async () => 'gelaufen');

    await expect(gescheitert).rejects.toThrow('kaputt');
    await expect(danach).resolves.toBe('gelaufen');
  });

  it('sollte einen frei gewordenen Schlüssel nicht dauerhaft vorhalten', async () => {
    // Ohne Aufräumen wüchse die interne Ablage mit jedem je benutzten Schlüssel.
    // Geprüft über das beobachtbare Verhalten: ein später Aufruf auf denselben
    // Schlüssel startet sofort, statt an einer alten Kette zu hängen.
    await withKeyLock('einmalig', async () => undefined);
    let sofortGestartet = false;
    const lauf = withKeyLock('einmalig', async () => {
      sofortGestartet = true;
    });
    await tick(1);
    expect(sofortGestartet).toBe(true);
    await lauf;
  });
});

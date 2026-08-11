/**
 * Warteschlange je Schlüssel — Serialisierung von Lesen-Ändern-Schreiben
 * (Issue #311).
 *
 * ## Warum das hier liegt
 *
 * Reine Nebenläufigkeits-Logik ohne React und ohne I/O — nach AGENTS.md §3
 * gehört sie damit nach `src/lib/`, obwohl heute nur Services sie rufen.
 *
 * ## Wogegen sie schützt
 *
 * Jeder lokale Schreibpfad hat dieselbe Form: Liste lesen, Element einfügen,
 * Liste zurückschreiben. Zwischen Lesen und Schreiben liegt ein echtes `await`
 * (IndexedDB, AES-GCM). Zwei gleichzeitige Aufrufe lesen deshalb denselben
 * Stand, und der zweite Schreibvorgang schreibt eine Fassung, die das Element
 * des ersten nicht enthält — lautlos, ohne Fehler.
 *
 * `withKeyLock` reiht Abläufe auf **demselben** Schlüssel hintereinander.
 * Verschiedene Schlüssel laufen weiter parallel: Konten müssen nicht warten,
 * weil Buchungen geschrieben werden.
 *
 * ## Was sie nicht ist
 *
 * Kein Schutz über Tab-Grenzen hinweg. Zwei offene Tabs derselben App teilen
 * sich diese Warteschlange nicht — dafür bräuchte es eine Sperre im Speicher
 * selbst (IndexedDB-Transaktion) oder einen `BroadcastChannel`. Für den Fall
 * aus #293/#311 (zwei Abläufe in *einem* Dokument) reicht dies; der Tab-Fall
 * ist bewusst nicht adressiert und wäre ein eigener Befund.
 */

/**
 * Letzter Ablauf je Schlüssel. Der Eintrag wird entfernt, sobald er der Letzte
 * war — sonst wüchse die Ablage mit jedem je berührten Schlüssel.
 */
const warteschlangen = new Map<string, Promise<unknown>>();

/**
 * Führt `ablauf` aus, sobald kein anderer Ablauf auf `schluessel` mehr läuft.
 *
 * Rückgabewert und Fehler gehen unverändert an die Aufrufstelle. Ein Fehler
 * hält die Warteschlange **nicht** an: der nächste Ablauf startet trotzdem,
 * sonst würde ein einzelner Fehlschlag den Schlüssel dauerhaft verklemmen.
 */
export function withKeyLock<T>(schluessel: string, ablauf: () => Promise<T>): Promise<T> {
  const vorheriger = warteschlangen.get(schluessel) ?? Promise.resolve();

  // Beide Zweige rufen `ablauf`: ob der Vorgänger erfolgreich war, geht diesen
  // Ablauf nichts an — er wartet nur, dass der Speicher wieder frei ist.
  const lauf = vorheriger.then(ablauf, ablauf);

  // Die Kette selbst darf nie im Fehlerzustand stehen bleiben, sonst gilt ein
  // abgelehntes Promise als unbehandelt und der nächste Aufruf erbt den Fehler.
  const abgeschlossen = lauf.then(
    () => undefined,
    () => undefined,
  );
  warteschlangen.set(schluessel, abgeschlossen);

  void abgeschlossen.then(() => {
    if (warteschlangen.get(schluessel) === abgeschlossen) {
      warteschlangen.delete(schluessel);
    }
  });

  return lauf;
}

/**
 * Kernlogik des i18n-Wächters (AGENTS.md §6).
 *
 * Getrennt vom Runner, damit sie ohne Dateisystem und ohne git testbar ist —
 * dieselbe Aufteilung wie bei `layers-core.mjs` und `decimal-input-core.mjs`.
 *
 * Diese Fassung schließt drei Lücken, an denen die Vorgängerversion
 * systematisch vorbeigesehen hat. Alle drei waren still: kein Test wurde rot,
 * kein Lauf hat gemeckert.
 *
 * 1. **Template-Literale.** Gesucht wurde nach `"Wort` und `'Wort`. Ein
 *    Backtick kam darin nicht vor, also war jeder interpolierte Text
 *    unsichtbar — und interpoliert wird gerade das, was einen Namen oder
 *    Betrag einsetzt, also besonders oft echter Bildschirmtext. Allein in
 *    einem einzigen Durchgang (PR #287) sind so drei Verstöße durchgelaufen.
 *
 * 2. **JSX-Text.** `<span>Verträge</span>` steht in gar keinen
 *    Anführungszeichen. Der Wächter suchte nach Zeichenketten und hat deshalb
 *    den häufigsten Fall überhaupt nie gesehen.
 *
 * 3. **Der Pauschal-Filter `constants`.** Jeder Pfad, der diese Zeichenfolge
 *    enthielt, wurde übersprungen — ein Namensfilter mit einem ganzen blinden
 *    Fleck dahinter.
 *
 * Der Preis dafür ist Fehlalarm-Risiko, und ein Wächter mit Fehlalarmen wird
 * abgeschaltet statt befolgt. Deshalb entscheidet nicht ein Wortschatz allein,
 * sondern die FORM: Es muss nach Prosa aussehen (mehrere Wörter oder ein
 * deutscher Umlaut) und darf nicht nach Bezeichner, Klassenliste, Pfad oder
 * Typwert aussehen.
 */

/**
 * Deutsche Wörter, die in diesem Projekt TYPWERTE sind und keine Texte.
 *
 * `Cycle` (`src/lib/contract-types.ts`) und `DashboardRange`
 * (`src/features/dashboard/domain/overview-types.ts`) sind auf Deutsch
 * benannt. Ob das eine gute Entscheidung war, ist eine andere Frage — sie ist
 * getroffen, die Werte stehen in persistierten Daten, und an den Rändern wird
 * gemappt.
 */
const DOMAIN_VALUE_TERMS = [
  'Woechentlich', 'Wöchentlich', 'Monatlich', 'Vierteljährlich',
  'Halbjährlich', 'Jährlich', 'Unbekannt',
  "'Jahr'", "'Quartal'", "'Monat'", "'Gesamt'", "'Benutzerdefiniert'",
];

/**
 * Vollständige Werte von `DashboardRange` (`features/shared/domain/
 * dashboard-filters.ts`). Sie stehen in der URL und in gespeicherten Filtern,
 * werden also nie übersetzt — an den Rändern wird gemappt (`RANGE_TO_TOKEN`).
 */
const RANGE_VALUES = new Set([
  'Gesamt', 'Jahr', 'Quartal', 'Monat',
  '7 Tage', '30 Tage', '90 Tage', '6 Monate', '1 Jahr', 'Benutzerdefiniert',
  // Buchungsrichtung — ebenfalls Typwert, nicht Bildschirmtext.
  'Ausgabe', 'Einnahme',
]);

/** Verdächtige deutsche Wörter (Heuristik, bewusst UI-Vokabular). */
const GERMAN_KEYWORDS = [
  'Willkommen', 'Fehler', 'Speichern', 'Abbrechen', 'Zurück', 'Weiter',
  'Löschen', 'Bearbeiten', 'Hinzufügen', 'Keine', 'Daten', 'nicht',
  'Schulden', 'Kategorie', 'Transaktion', 'Monat', 'Jahr', 'Heute',
  'Morgen', 'Gestern', 'Überschrift', 'Beschreibung', 'Titel',
  'Vertrag', 'Verträge', 'Konto', 'Konten', 'Betrag', 'Buchung',
  'Budget', 'Sparen', 'Rücklage', 'Einnahme', 'Ausgabe', 'Ausgaben',
  'nötig', 'möglich', 'Einsparung', 'Prüfen', 'prüfen', 'Anzahl',
];

const ENGLISH_KEYWORDS = [
  'Welcome', 'Error', 'Save', 'Cancel', 'Back', 'Next',
  'Delete', 'Edit', 'Add', 'No', 'Data', 'not',
  'Debt', 'Category', 'Transaction', 'Month', 'Year', 'Today',
  'Tomorrow', 'Yesterday', 'Heading', 'Description', 'Title',
];

/**
 * Dateien, die der Wächter gar nicht erst ansieht — jeweils mit Grund.
 *
 * Die Liste ist absichtlich kurz und benennt Pfade, nicht Zeichenfolgen. Der
 * frühere Filter `file.includes('constants')` war ein Namensfilter: Er hat
 * `filter-constants.ts` mit sichtbaren Labels genauso verschluckt wie jede
 * andere Datei, in deren Pfad das Wort zufällig vorkam.
 */
function istAusgenommen(relPath) {
  // Testdateien prüfen bilingual und zitieren deshalb Text beider Sprachen.
  if (/\.(test|spec)\.[jt]sx?$/.test(relPath) || relPath.includes('__tests__/')) return true;
  // `src/i18n/` IST die Übersetzungsschicht (inkl. Sprachstil-Overlays).
  if (relPath.includes('src/i18n/')) return true;
  // §9a EStG ist die Sache selbst, nicht ihre Übersetzung — eine russische
  // Fassung des deutschen Steuerrechts gibt es nicht.
  if (relPath.includes('src/data/tax-catalog')) return true;
  // `src/test-utils/` beschreibt Zustaende fuer Entwickler, nicht fuer Nutzer.
  if (relPath.includes('src/test-utils/')) return true;
  if (!/\.tsx?$/.test(relPath)) return true;
  return false;
}

/** Zeilen, die nie Bildschirmtext tragen. */
function istRauschzeile(trimmed, umfeld) {
  return (
    trimmed === '' ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    /^import\b|^export .*\bfrom\b/.test(trimmed) ||
    /^(type|interface)\s/.test(trimmed) ||
    // Vergleiche und `case`: der deutsche Wortlaut ist ein Typwert.
    /===|!==|\.includes\(|^case\s|switch\s*\(/.test(trimmed) ||
    // Fallback-Muster `{ label: 'Schulden', labelKey: 'nav.items.debts' }` —
    // der Schlüssel gewinnt, der Text ist nur die Notfassung. Er steht oft
    // erst in der NÄCHSTEN Zeile, deshalb das Umfeld.
    /\b\w+(Key|Fallback)\b\s*[:=]/.test(umfeld) ||
    // `console.*` und `logger.*` sind Entwickler-Meldungen, nie Bildschirmtext.
    /\bconsole\.|\blogger\.|STORAGE_KEY|_KEY\s*=|queryKey/.test(trimmed) ||
    // CSV-Spaltenzuordnung: `categoryColumn: 'Kategorie'` benennt die
    // Spaltenüberschrift eines deutschen Bank-Exports. Übersetzt bräche der Import.
    /\w+Column\s*[:?]/.test(trimmed)
  );
}

/**
 * Kann der Inhalt überhaupt Bildschirmtext sein?
 *
 * Das ist der NEGATIVE Filter, der Fehlalarme verhindert — er sagt nur, was
 * sicher kein Text ist: ein Bezeichner ohne Abstand (`not-found`), eine
 * Klassenliste (`text-muted-foreground`), ein Pfad, eine Zahl. Ob es
 * tatsächlich Text IST, entscheidet danach das Vokabular.
 */
function kannTextSein(text) {
  const roh = text.trim();
  if (roh.length < 3) return false;
  // Kein einziger Buchstabe → Zahl, Symbol, Satzzeichen.
  if (!/[A-Za-zÄÖÜäöüß]/.test(roh)) return false;
  // Typwerte des Dashboards („6 Monate", „1 Jahr", „Ausgabe") — Bezeichner.
  if (RANGE_VALUES.has(roh)) return false;
  // Modulpfade: `@/pages/BudgetsPage`, `./foo`, `../lib/bar`. Ein dynamischer
  // `import()` steht mitten in der Zeile und wird vom `^import`-Filter nicht
  // erfasst — der Pfad ist aber nie Bildschirmtext.
  if (/^[@.~]?\/?[\w@.-]+(\/[\w@.-]+)+$/.test(roh) && !/\s/.test(roh)) return false;
  // Bezeichner-Formen: kebab-case, snake_case, Pfade, Dateiendungen.
  if (/^[A-Za-z0-9]+([-_.:/][A-Za-z0-9]+)+$/.test(roh)) return false;
  // Klassenlisten (Tailwind) und andere Kleinschreib-Token-Ketten ohne Umlaut.
  // `disabled:cursor-not-allowed` enthaelt `not` mit Wortgrenzen — ohne diese
  // Zeile meldete der Waechter jede zweite shadcn-Komponente.
  if (/^[a-z0-9[\]&>~*+-]+(\s+[a-z0-9[\]&>~*+:/._=%,()#-]+)*$/.test(roh) && !/[ÄÖÜäöüß]/.test(roh)) return false;
  return true;
}

/**
 * Schneidet einen Kommentar am ZEILENENDE ab.
 *
 * Nicht einfach `//` suchen: `https://…` in einer Zeichenkette hat dieselbe
 * Form. Deshalb wird bis zum `//` gezählt, ob die Anführungszeichen aufgehen —
 * steht es innerhalb einer Zeichenkette, bleibt es stehen.
 */
function ohneZeilenkommentar(line) {
  let inStr = null;
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

/**
 * Trägt der Text erkennbar deutsches/englisches UI-Vokabular?
 *
 * Zwei Wege zum Treffer, und der zweite ist der, der die Wortliste vor ihrer
 * eigenen Lückenhaftigkeit rettet: Ein Umlaut in mehreren Wörtern ist deutsche
 * Prosa, ganz gleich ob das Wort in der Liste steht.
 */
function traegtVokabular(text, relPath) {
  const woerter = GERMAN_KEYWORDS.filter((k) => new RegExp(`\\b${k}`).test(text));
  if (woerter.length > 0) return { sprache: 'de', keyword: woerter[0] };

  const anzahlWoerter = text.trim().split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß]/.test(w)).length;
  if (/[ÄÖÜäöüß]/.test(text) && anzahlWoerter >= 2) {
    return { sprache: 'de', keyword: text.trim().slice(0, 30) };
  }

  if (relPath.includes('components/')) {
    const en = ENGLISH_KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`).test(text));
    if (en.length > 0) return { sprache: 'en', keyword: en[0] };
  }
  return null;
}

/** Entfernt `${…}`-Interpolationen, damit nur der feste Text übrig bleibt. */
function ohneInterpolation(text) {
  return text.replace(/\$\{[^}]*\}/g, ' ');
}

/**
 * Findet hardcodierten UI-Text in einer Quelldatei.
 *
 * @param relPath repo-relativer Pfad (entscheidet über Ausnahmen und Meldung)
 * @param source  Dateiinhalt
 * @returns Fundstellen mit Zeilennummer, Art und auslösendem Wort
 */
export function findHardcodedStrings(relPath, source) {
  if (istAusgenommen(relPath)) return [];

  const funde = [];
  const lines = source.split('\n');
  const istTsx = relPath.endsWith('.tsx');

  // Blockkommentare erstrecken sich über mehrere Zeilen; ihre Fortsetzungen
  // erkennt `istRauschzeile` an `*`, ihr Anfang an `/*`. Eine Zeile MITTEN in
  // einem Kommentar ohne `*` faellt sonst durch — deshalb wird der Zustand
  // ueber die Datei mitgefuehrt.
  let imBlockkommentar = false;

  // Ein `t(…)`- oder `console.…(…)`-Aufruf kann sich ueber mehrere Zeilen
  // ziehen — und genau so steht das haeufigste Muster im Bestand:
  //
  //     {t(
  //       'onboarding.subtitle',
  //       'Wir blenden dann nur die Bereiche ein, die dazu passen.',
  //     )}
  //
  // Eine zeilenweise Erkennung sieht nur die Notfassung und meldet sie. Deshalb
  // wird die Klammertiefe solcher Aufrufe ueber die Zeilen mitgefuehrt.
  let offeneTiefe = 0;

  /** Klammerbilanz einer Zeile, Zeichenketten ausgenommen. */
  const klammerbilanz = (text) => {
    let tiefe = 0;
    let inStr = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') inStr = c;
      else if (c === '(') tiefe++;
      else if (c === ')') tiefe--;
    }
    return tiefe;
  };

  lines.forEach((rawLine, index) => {
    // Kommentar am Zeilenende faellt weg, BEVOR irgendetwas gesucht wird.
    // Sonst gilt `setPathIndex(0); // neue Zelle -> …` als JSX-Text.
    const trimmed = ohneZeilenkommentar(rawLine).trim();
    // Umfeld in BEIDE Richtungen: Beim Fallback-Muster steht der Schluessel mal
    // unter, mal ueber dem Text (`{ labelKey: …, label: … }`). Wer nur nach
    // vorn sieht, meldet genau die Haelfte der Paare.
    const umfeld = [
      ohneZeilenkommentar(lines[index - 1] ?? ''),
      trimmed,
      ohneZeilenkommentar(lines[index + 1] ?? ''),
    ]
      .map((l) => l.trim())
      .join('\n');

    if (imBlockkommentar) {
      if (trimmed.includes('*/')) imBlockkommentar = false;
      return;
    }
    if (/\/\*/.test(trimmed) && !trimmed.includes('*/')) {
      imBlockkommentar = true;
      return;
    }

    const oeffnetHier = /\b(t|serviceT|translate)\s*\(|\b(console|logger)\.\w+\s*\(/.test(trimmed);
    const stehtInOffenem = offeneTiefe > 0;
    const hatUebersetzung = oeffnetHier || stehtInOffenem;
    if (oeffnetHier || stehtInOffenem) {
      offeneTiefe = Math.max(0, (stehtInOffenem ? offeneTiefe : 0) + klammerbilanz(trimmed));
    }

    if (istRauschzeile(trimmed, umfeld)) return;

    // Typwerte des Projekts — ausgenommen NUR ausserhalb von JSX. Ein
    // `<span>Monatlich</span>` waere sehr wohl ein Verstoss.
    const wirktWieJsx = istTsx && /<\/?[A-Za-z]/.test(trimmed);
    if (!wirktWieJsx && DOMAIN_VALUE_TERMS.some((term) => trimmed.includes(term))) return;

    const melde = (kind, text) => {
      const sauber = ohneInterpolation(text);
      if (!kannTextSein(sauber)) return;
      const treffer = traegtVokabular(sauber, relPath);
      if (!treffer) return;
      funde.push({
        file: relPath,
        line: index + 1,
        kind,
        sprache: treffer.sprache,
        keyword: treffer.keyword,
        snippet: trimmed.slice(0, 90),
      });
    };

    // Ein bereits uebersetzter Aufruf deckt die Zeile ab. Das ist grob, aber
    // die Alternative — jedes Argument einzeln zuordnen — braeuchte einen
    // Parser, und die Fehlalarme daraus kosten mehr, als sie einbringen.
    // `translate(` ist der uebliche Alias: `import { t as translate } from
    // '@/i18n/serviceT'`. Ohne ihn meldete der Waechter ausgerechnet die
    // uebersetzten Stellen — mitsamt ihrer Notfassung als zweitem Parameter.


    // --- Zeichenketten ------------------------------------------------------
    if (!hatUebersetzung) {
      for (const m of trimmed.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"/g)) {
        melde('string', m[1] ?? m[2] ?? '');
      }
      // --- Template-Literale (Lücke 1) --------------------------------------
      for (const m of trimmed.matchAll(/`([^`\\]*)`/g)) {
        melde('template', m[1] ?? '');
      }
    }

    // --- JSX-Text (Lücke 2) -------------------------------------------------
    // Text zwischen `>` und `<` bzw. `{`. Bewusst nur in `.tsx`, und bewusst
    // ohne Parser: Was zwischen den Klammern steht, wird von
    // `siehtNachProsaAus` gefiltert, nicht von einer Grammatik.
    if (istTsx && !hatUebersetzung) {
      // `(?<![=\-!<])` haelt den Pfeil einer Arrow-Funktion heraus: `=>` endet
      // auf `>`, und ohne diese Bedingung galt der halbe Callback-Quelltext als
      // JSX-Text. Dasselbe fuer `->` im Text und `<>`-Fragmente.
      for (const m of trimmed.matchAll(/(?<![=\-!<])>([^<>{}\n]+)(?=<|\{|$)/g)) {
        melde('jsx-text', m[1] ?? '');
      }
      // Mehrzeiliger JSX-Text: eine Zeile ganz ohne Klammern, deren Nachbarn
      // JSX sind. `<p …>` oben, Text hier, `</p>` unten.
      if (!/[<>{}]/.test(trimmed) && !/[=;,]$/.test(trimmed)) {
        const davor = (lines[index - 1] ?? '').trim();
        const danach = (lines[index + 1] ?? '').trim();
        if (/>$/.test(davor) && /^<\//.test(danach)) melde('jsx-text', trimmed);
      }
    }
  });

  return funde;
}

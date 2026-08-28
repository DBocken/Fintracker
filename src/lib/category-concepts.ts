/**
 * Oberbegriffe auf eine MENGE von Kategorien abbilden (WP-G).
 *
 * Der Befund, der diese Datei nötig macht: „Essen" ist beim Nutzer keine
 * Kategorie, sondern eine Gruppe — und die Gruppe spannt über
 * HAUPTKATEGORIEN hinweg. Die Standard-Taxonomie führt „Lebensmittel"
 * (Supermarkt, Wochenmarkt, Bäckerei) und „Essen & Trinken" (Restaurant,
 * Fast Food, Café) getrennt; „Auto" verteilt sich sogar über Mobilität,
 * Versicherungen und Finanzen. Die Eltern-Kette, die `isCategoryInFilter`
 * ohnehin abläuft, hilft dort also nicht.
 *
 * **Warum das ein Wissens- und kein Rechenproblem ist.** Der gelernte
 * Klassifikator (WP-B) bildet Buchungstext auf Kategorien ab — „REWE"
 * enthält aber kein „essen". Die Oberbegriffs-Beziehung steht in keiner
 * Buchung und lässt sich aus ihnen nicht ableiten. Sie muss von irgendwoher
 * kommen, und lokal gibt es genau zwei ehrliche Quellen:
 *
 * 1. **Diese kuratierte Tabelle** — sie deckt die geläufigen Oberbegriffe ab
 *    Tag eins ab, auch für einen Nutzer ohne eine einzige bestätigte Buchung.
 * 2. **Die Stichwörter, die die App ohnehin pflegt** (`Category.filters`,
 *    gefüllt aus `data/merchant-keywords.ts`). Deshalb nennt ein Konzept hier
 *    SUCHBEGRIFFE und keine Kategorie-IDs: Begriffe treffen auch die selbst
 *    angelegte Kategorie „Bio-Supermarkt", eine ID-Liste nur den Bestand von
 *    gestern.
 *
 * Was die Tabelle NICHT leistet, leistet die Oberfläche: Die erkannte Menge
 * wird benannt, ist korrigierbar, und die Korrektur wird gelernt (WP-F.5).
 * Ein Oberbegriff, den hier niemand aufgeschrieben hat, ist damit einmal
 * Handarbeit — und danach gelernt.
 */
import type { Category } from '@/types';

/**
 * Oberbegriff → Suchbegriffe. Der SCHLÜSSEL ist das Wort, das der Nutzer
 * tippt; die Werte sind, wonach in Kategorienamen und Stichwörtern gesucht
 * wird.
 *
 * Erkennungsdaten, kein Bildschirmtext — deshalb nicht im Sprachbaum
 * (dieselbe Einordnung wie `question-time-expressions.ts`): `locale-parity`
 * erzwänge sonst Wort-für-Wort-Parität für Vokabular, das je Sprache
 * verschieden sein MUSS.
 */
const KONZEPTE_DE: Readonly<Record<string, readonly string[]>> = {
  essen: [
    'lebensmittel', 'supermarkt', 'getränke', 'getraenke', 'bäckerei', 'baeckerei',
    'metzgerei', 'wochenmarkt', 'essen', 'trinken', 'restaurant', 'fast food',
    'café', 'cafe', 'imbiss', 'lieferdienst',
  ],
  ernährung: ['lebensmittel', 'supermarkt', 'bäckerei', 'baeckerei', 'metzgerei', 'wochenmarkt'],
  auto: [
    'auto', 'kfz', 'pkw', 'tanken', 'kraftstoff', 'benzin', 'diesel', 'werkstatt',
    'tüv', 'tuev', 'parken', 'mobilität', 'mobilitaet', 'leasing', 'carsharing',
  ],
  fahrzeug: ['auto', 'kfz', 'pkw', 'werkstatt', 'tüv', 'tuev', 'leasing'],
  mobilität: ['mobilität', 'mobilitaet', 'tanken', 'kraftstoff', 'parken', 'carsharing', 'taxi', 'bahn', 'ticket'],
  wohnen: [
    'wohnen', 'miete', 'nebenkosten', 'strom', 'energie', 'wasser', 'abwasser',
    'heizung', 'rundfunk', 'hausrat', 'gebäude', 'gebaeude',
  ],
  haushalt: ['haushalt', 'reinigung', 'drogerie', 'hausrat'],
  freizeit: ['freizeit', 'hobby', 'kultur', 'museen', 'verein', 'lotto', 'sport', 'kino'],
  gesundheit: ['gesundheit', 'apotheke', 'arzt', 'ärzt', 'aerzt', 'zahn', 'brille', 'therapie'],
  kinder: ['kinder', 'kita', 'kindergarten', 'schule', 'spielzeug', 'familienleistungen'],
  bildung: ['bildung', 'bücher', 'buecher', 'fachliteratur', 'kurs', 'studium', 'seminar'],
  versicherung: ['versicherung', 'hausrat', 'gebäude', 'gebaeude', 'haftpflicht', 'kfz'],
  abos: ['abo', 'streaming', 'zeitung', 'magazine', 'software', 'cloud'],
  digital: ['software', 'cloud', 'webhosting', 'domains', 'streaming', 'internet'],
  reisen: ['reisen', 'urlaub', 'hotel', 'ausflüge', 'ausfluege', 'flug'],
  kleidung: ['kleidung', 'schuhe', 'mode', 'textil'],
  shopping: ['shopping', 'kleidung', 'elektronik', 'baumarkt', 'einzelhandel'],
  sparen: ['sparen', 'investieren', 'bausparen', 'tagesgeld', 'depot'],
  steuern: ['steuer', 'abgaben', 'grundsteuer', 'kommunale'],
  kommunikation: ['mobilfunk', 'internet', 'telefon', 'handy'],
};

const KONZEPTE_EN: Readonly<Record<string, readonly string[]>> = {
  food: ['groceries', 'supermarket', 'bakery', 'butcher', 'market', 'restaurant', 'fast food', 'café', 'cafe'],
  car: ['car', 'vehicle', 'fuel', 'petrol', 'diesel', 'garage', 'parking', 'leasing', 'mobility'],
  housing: ['housing', 'rent', 'utilities', 'electricity', 'energy', 'water', 'heating'],
  leisure: ['leisure', 'hobby', 'culture', 'museum', 'club', 'sports', 'cinema'],
  health: ['health', 'pharmacy', 'doctor', 'dental', 'therapy'],
  insurance: ['insurance', 'liability', 'contents'],
  travel: ['travel', 'holiday', 'hotel', 'flight'],
};

const KONZEPTE_RU: Readonly<Record<string, readonly string[]>> = {
  еда: ['продукты', 'супермаркет', 'пекарня', 'рынок', 'ресторан', 'кафе'],
  авто: ['авто', 'машина', 'топливо', 'бензин', 'сервис', 'парковка', 'лизинг'],
  жильё: ['жильё', 'аренда', 'электричество', 'вода', 'отопление'],
  досуг: ['досуг', 'хобби', 'культура', 'музей', 'спорт', 'кино'],
  здоровье: ['здоровье', 'аптека', 'врач', 'стоматолог'],
  страховка: ['страховка', 'страхование'],
};

const JE_SPRACHE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  de: KONZEPTE_DE,
  en: KONZEPTE_EN,
  ru: KONZEPTE_RU,
};

/**
 * Ab dieser Länge darf ein Oberbegriff am WORTANFANG treffen; darunter nur
 * exakt.
 *
 * Der Grund ist die Sprache selbst: Deutsch bildet Komposita, „auto" muss
 * „autokosten" treffen. Englisch tut das nicht — ein am Wortanfang
 * greifendes „car" fände „cards", „care" und „career". Kurze Begriffe können
 * sich Präfix-Treffer schlicht nicht leisten.
 */
const MIN_PRAEFIX_LAENGE = 4;

/** Kürzer als das trifft in jeder Sprache zu viel („öl", „tv"). */
const MIN_KONZEPT_LAENGE = 3;

function normalisiere(text: string): string {
  return text.toLowerCase().replace(/ß/g, 'ss');
}

/** Wörter eines Textes — Umlaute bleiben, die Tabelle führt beide Schreibweisen. */
function worte(text: string): string[] {
  return normalisiere(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Trifft ein Suchbegriff dieses Wort? WORTANFANG, nicht Teilzeichenkette —
 * das ist der Unterschied zwischen „auto" → „autohaus" (gewollt) und „auto"
 * → „geldautomat" (Bargeld-Kategorie, grob falsch).
 *
 * Unterhalb von {@link MIN_PRAEFIX_LAENGE} muss das Wort exakt stimmen: Ein
 * dreibuchstabiges „car" fände sonst „cards", „care" und „career".
 */
function trifftWort(wort: string, begriff: string): boolean {
  return begriff.length >= MIN_PRAEFIX_LAENGE ? wort.startsWith(begriff) : wort === begriff;
}

function trifftKategorie(kategorie: Category, begriffe: readonly string[]): boolean {
  const heuhaufen = [kategorie.name, ...(kategorie.filters ?? [])];
  for (const teil of heuhaufen) {
    for (const wort of worte(teil)) {
      for (const begriff of begriffe) {
        if (trifftWort(wort, normalisiere(begriff))) return true;
      }
    }
  }
  return false;
}

export interface KonzeptTreffer {
  /** Der erkannte Oberbegriff, wie er in der Frage stand. */
  konzept: string;
  /** Alle Kategorien der Gruppe — Haupt- wie Unterkategorien, IDs. */
  categoryIds: string[];
}

/**
 * Erkennt einen Oberbegriff im Fragetext und löst ihn in die Kategorien des
 * Nutzers auf.
 *
 * `null`, wenn kein Oberbegriff erkannt wurde ODER die Gruppe im Bestand des
 * Nutzers auf weniger als zwei Kategorien führt: Eine einzelne Kategorie ist
 * keine Gruppe, und dafür ist die vorhandene Einzelauflösung
 * (`resolveKategorieAusText`) die genauere Antwort — sie kennt zusätzlich die
 * eigenen Händlerregeln und den gelernten Klassifikator.
 */
/** Alle Oberbegriffe, die im Text als Wort(anfang) vorkommen, in Tabellenreihenfolge. */
function* konzepteImText(
  text: string,
  locale: string,
): Generator<{ konzept: string; begriffe: readonly string[] }> {
  const tabelle = JE_SPRACHE[locale] ?? KONZEPTE_DE;
  const textworte = worte(text);

  for (const [konzept, begriffe] of Object.entries(tabelle)) {
    if (konzept.length < MIN_KONZEPT_LAENGE) continue;
    const schluessel = normalisiere(konzept);
    // Der Oberbegriff muss als Wort(anfang) vorkommen — „essensausgaben"
    // zählt, „interessen" nicht.
    if (!textworte.some((wort) => trifftWort(wort, schluessel))) continue;
    yield { konzept, begriffe };
  }
}

export function findeKonzeptKategorien(
  text: string,
  categories: readonly Category[],
  locale: string,
): KonzeptTreffer | null {
  for (const { konzept, begriffe } of konzepteImText(text, locale)) {
    const treffer = categories.filter((k) => trifftKategorie(k, begriffe));
    if (treffer.length < 2) continue;

    return { konzept, categoryIds: treffer.map((k) => k.id) };
  }

  return null;
}

/**
 * Nur die TEXT-Hälfte von {@link findeKonzeptKategorien}: Welcher Oberbegriff
 * steht in diesem Text, und welche Suchbegriffe gehören zu ihm? Ohne
 * Kategorien-Auflösung — der Szenario-Baustein (`scenario-intent.ts`) trifft
 * damit VERTRÄGE über deren Namen/Kategorie (`FlowSelector` mit `keyword`),
 * nicht den Kategorienbestand. Gleiche Wortanfangs-Regeln, gleiche Tabelle —
 * eine Zweitliste würde driften.
 */
export function findeKonzeptImText(
  text: string,
  locale: string,
): { konzept: string; begriffe: readonly string[] } | null {
  for (const treffer of konzepteImText(text, locale)) return treffer;
  return null;
}

/** Alle Oberbegriffe einer Sprache — für Kurations-Tests. */
export function konzepteFuer(locale: string): Readonly<Record<string, readonly string[]>> {
  return JE_SPRACHE[locale] ?? KONZEPTE_DE;
}

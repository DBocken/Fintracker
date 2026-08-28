/**
 * Eine Frage auf die Form bringen, in der alle Router-Stufen sie gleich lesen.
 *
 * Die Funktion lag bis hierher als WORTGLEICHE Kopie in vier Dateien
 * (`question-matcher`, `question-intent-model`, `scenario-intent`,
 * `action-intent`). Solange sie nur Umlaute faltete, war das folgenlos —
 * beim ersten Zusatz aber wäre er an einer Stelle gelandet und an drei
 * nicht, und dann sähe die Wortebene eine andere Frage als der
 * Klassifikator. Genau diese Sorte Auseinanderlaufen ist der Grund, warum
 * das Register überhaupt EIN Imperativ-Gate hat statt vier (AGENTS.md §3).
 *
 * Rein und ohne I/O: gehört nach `src/lib/` (§3, „Wohin ein Typ gehört").
 */

/**
 * Zusammengeschriebene Fragewendungen, die dieselbe Absicht tragen wie ihre
 * getrennte Form.
 *
 * Browser-Fund am Prod-Build: „Wieviel geld habe ich" blieb unbeantwortet,
 * „wie viel geld habe ich" traf `konto.gesamt`. Der Unterschied war ein
 * Leerzeichen. „wieviel" ist keine Nachlässigkeit, sondern bis zur
 * Rechtschreibreform die REGELFORM gewesen und heute noch verbreitet — wer
 * so tippt, meint nichts anderes.
 *
 * Die Liste bleibt bewusst kurz und auf Fragewendungen beschränkt: Eine
 * allgemeine Worttrennung würde raten, und ein Router, der rät, ist genau
 * das, was dieses Register nicht sein soll.
 */
const SCHREIBVARIANTEN: readonly [RegExp, string][] = [
  [/\bwieviele\b/g, 'wie viele'],
  [/\bwieviel\b/g, 'wie viel'],
  [/\bsoviel\b/g, 'so viel'],
];

/**
 * Die deutsche **Satzklammer** trennbarer Verben, als Muster je Verb.
 *
 * Browser-Fund am Prod-Build: „Wie viel gebe ich für Netflix aus?" blieb
 * unbeantwortet, „Wie viel habe ich für Netflix ausgegeben" traf sofort. Der
 * Auslöser für Ausgaben lautet `ausgegeben, ausgaben, gekostet, …` — und im
 * Hauptsatz kommt genau dieses Wort NIE vor: Der Stamm steht vorn, die
 * Partikel am Satzende, und dazwischen liegt das, wonach gefragt wird. Die
 * Wortebene sah „gebe" und „aus", und keines von beiden trägt allein eine
 * Absicht (dieselbe Regel, die „noch für" als Auslöser verboten hat).
 *
 * Geschlossen wird die Klammer hier und nicht in der Auslöserliste: Ein
 * Eintrag je finiter Form wäre je Verb ein halbes Dutzend, in jeder Sprache
 * neu — und der Klassifikator der Stufe 2 sähe die Frage weiterhin zerlegt.
 * Eine Umformung vor allen Stufen wirkt für beide.
 *
 * **Die Partikel muss den Teilsatz beenden.** „aus" ist im Deutschen weit
 * häufiger Präposition als Verbpartikel („aus dem Konto"); ohne diese
 * Bedingung würde jeder zweite Satz umgeschrieben. Erkannt wird die Klammer
 * also an ihrer Stellung, nicht am Wort — dieselbe Idee wie die Text-Prop
 * bei `check:i18n` und der Bezeichner-Hinweis bei `check:external-endpoints`.
 */
const SATZKLAMMERN: readonly [RegExp, string][] = [
  // ausgeben → ausgegeben. Der Inhalt der Klammer ($1) bleibt stehen: Dort
  // steht der Händler oder die Kategorie, also der Slot der Frage.
  [/\b(?:gebe|gibst|gibt|geben|gebt)\b([^?.!,;]*?)\baus\b(?=\s*[?.!,;]|\s*$)/g, 'ausgegeben$1'],
];

/** Umlaute falten und Schreibvarianten auflösen — die gemeinsame Lesart. */
export function normalisiereFrage(text: string): string {
  let normalisiert = text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  for (const [muster, ersatz] of SCHREIBVARIANTEN) {
    normalisiert = normalisiert.replace(muster, ersatz);
  }
  for (const [muster, ersatz] of SATZKLAMMERN) {
    normalisiert = normalisiert.replace(muster, ersatz);
  }
  return normalisiert;
}

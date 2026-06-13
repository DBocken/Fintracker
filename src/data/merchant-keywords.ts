/**
 * Umfangreiche Händler-/Schlagwort-Datenbank für die automatische Kategorisierung.
 *
 * Single Source of Truth für:
 * - die `filters[]` der lokalen Standardkategorien (default-categories.ts)
 * - die Supabase-Migration, die die globalen Standardkategorien (user_id IS NULL)
 *   um diese Begriffe ergänzt
 *
 * `category` muss exakt dem `name` der jeweiligen Kategorie entsprechen.
 */

export interface MerchantKeywordGroup {
  category: string;
  keywords: string[];
}

export const MERCHANT_KEYWORDS: MerchantKeywordGroup[] = [
  {
    category: "Einkommen",
    keywords: [
      "gehalt", "lohn", "bezüge", "bezuege", "gehaltszahlung", "lohnzahlung",
      "rente", "deutsche rentenversicherung", "betriebsrente", "pension",
      "kindergeld", "familienkasse", "bafög", "bafoeg", "elterngeld",
      "arbeitslosengeld", "agentur für arbeit", "agentur fuer arbeit", "jobcenter leistung",
      "erstattung", "rückerstattung", "rueckerstattung", "steuererstattung", "finanzamt erstattung",
      "honorar", "umsatzerlös", "umsatzerloes", "trinkgeld", "auszahlung gewinn",
      "wohngeld", "krankengeld",
    ],
  },
  {
    category: "Wohnen",
    keywords: [
      "miete", "kaltmiete", "warmmiete", "nebenkosten", "nebenkostenabrechnung",
      "hausgeld", "wohnungsgenossenschaft", "vonovia", "deutsche wohnen",
      "wbg", "gwg", "leg immobilien", "immobilien verwaltung", "hausverwaltung",
      "stadtwerke", "e.on", "eon energie", "enbw", "vattenfall", "eprimo",
      "lichtblick", "yello strom", "rwe", "techem", "ista", "minol",
      "gasag", "mainova", "naturstrom", "polarstern", "tibber", "octopus energy",
      "wasserwerk", "wasser/abwasser", "abwasser", "gez", "rundfunkbeitrag",
      "grundsteuer", "wohngebäudeversicherung", "wohngebaeudeversicherung",
    ],
  },
  {
    category: "Lebensmittel",
    keywords: [
      "rewe", "edeka", "aldi", "aldi süd", "aldi nord", "lidl", "penny", "netto",
      "netto marken-discount", "kaufland", "real,-", "globus", "tegut", "denns",
      "denn's", "alnatura", "bio company", "feneberg", "hit markt", "combi",
      "famila", "marktkauf", "norma", "nah und gut", "nahkauf", "spar",
      "getränke hoffmann", "getraenke hoffmann", "trinkgut", "fristo",
      "bringmeister", "knuspr", "flink", "gorillas", "picnic",
      "metro", "selgros", "wochenmarkt", "hofladen", "bäckerei", "baeckerei",
      "konditorei", "fleischerei", "metzgerei",
    ],
  },
  {
    category: "Mobilität",
    keywords: [
      "tankstelle", "tanken", "aral", "shell", "esso", "jet", "star tankstelle",
      "agip", "eni", "avia", "hem tankstelle", "om tankstelle", "supermarkt tankstelle",
      "deutsche bahn", "db vertrieb", "db fernverkehr", "db regio", "flixbus", "flixtrain",
      "hvv", "mvg", "mvv", "bvg", "vbb", "vrr", "rmv", "vvs", "kvb", "vrs", "ddsd",
      "free now", "flinkster", "share now", "miles mobility", "uber", "taxi",
      "apcoa", "ehc parken", "parkhaus", "parken", "vinci park",
      "tüv", "tuev", "dekra", "kfz-versicherung", "kfz versicherung", "werkstatt",
      "reifen", "autoteile", "adac",
    ],
  },
  {
    category: "Restaurant & Café",
    keywords: [
      "lieferando", "uber eats", "wolt", "mcdonald", "mcdonalds", "burger king",
      "kfc", "subway", "starbucks", "vapiano", "nordsee", "pizza",
      "dean & david", "dean&david", "five guys", "l'osteria", "losteria",
      "asia bistro", "döner", "doener", "imbiss", "restaurant", "gastronomie",
      "café", "cafe", "bistro", "coffee fellows", "balzac", "tchibo café",
      "ristorante", "sushi", "bäckerei café",
    ],
  },
  {
    category: "Versicherungen",
    keywords: [
      "versicherung", "allianz", "huk-coburg", "huk24", "huk coburg", "axa",
      "ergo", "debeka", "signal iduna", "generali", "wgv", "devk", "gothaer",
      "barmenia", "hanse merkur", "württembergische", "wuerttembergische",
      "cosmosdirekt", "verti versicherung", "alte leipziger", "ottonova",
      "zurich versicherung", "ihre versicherung", "r+v versicherung", "ruv",
      "lvm versicherung", "vhv", "continentale", "nürnberger versicherung",
      "nuernberger versicherung", "beitrag versicherung", "haftpflicht",
    ],
  },
  {
    category: "Abos & Streaming",
    keywords: [
      "netflix", "spotify", "amazon prime", "disney+", "disneyplus", "apple.com/bill",
      "apple.com bill", "youtube premium", "dazn", "sky deutschland", "wow tv",
      "rtl+", "rtl plus", "joyn", "audible", "paramount+", "paramount plus",
      "deezer", "tidal", "crunchyroll", "rundfunk", "abo", "abonnement",
      "adobe", "microsoft 365", "office 365", "icloud", "google one",
      "1&1", "1und1", "telekom", "vodafone", "o2", "congstar", "freenet",
      "fitness abo", "zeitschriftenabo", "zeitungsabo", "tagesspiegel abo",
      "spiegel plus", "patreon", "onlyfans",
    ],
  },
  {
    category: "Gesundheit",
    keywords: [
      "apotheke", "dm apotheke", "shop-apotheke", "shop apotheke", "docmorris",
      "medpex", "arztpraxis", "zahnarzt", "augenarzt", "hausarzt", "facharzt",
      "physiotherapie", "ergotherapie", "logopädie", "logopaedie",
      "barmer", "aok", "techniker krankenkasse", "tk krankenkasse", "dak",
      "ikk", "knappschaft", "krankenkasse", "private krankenversicherung",
      "fitnessstudio", "mcfit", "fitx", "clever fit", "urban sports club",
      "yoga", "krankenhaus", "klinik", "labor diagnostik", "sehtest", "optiker",
      "hörgeräte", "hoergeraete",
    ],
  },
  {
    category: "Shopping",
    keywords: [
      "amazon", "amzn", "zalando", "otto", "ebay", "mediamarkt", "saturn",
      "dm-drogerie", "dm drogerie", "rossmann", "ikea", "obi", "hornbach",
      "bauhaus", "toom baumarkt", "h&m", "c&a", "primark", "tk maxx",
      "decathlon", "thalia", "müller markt", "mueller markt", "tedi", "kik",
      "takko", "vinted", "kleinanzeigen", "temu", "shein", "wish",
      "apple store", "fielmann", "lovoo", "buecher.de", "bücher.de",
      "conrad electronic", "expert", "euronics", "real.de", "notebooksbilliger",
    ],
  },
  {
    category: "Sonstiges",
    keywords: [],
  },
];

/**
 * Generische Regex-Fallback-Regeln, die als letzte Stufe angewendet werden,
 * falls kein Treffer über die Keyword-Filter erzielt wurde. Greifen auf
 * normalisierten Payee + Description.
 */
export interface RegexFallbackRule {
  category: string;
  pattern: RegExp;
}

export const REGEX_FALLBACK_RULES: RegexFallbackRule[] = [
  { category: "Mobilität", pattern: /tankstelle|tanken|kraftstoff/i },
  { category: "Wohnen", pattern: /\b(miete|nebenkosten|hausgeld|wohnung)\b/i },
  { category: "Versicherungen", pattern: /versicherung|beitrag.*vers/i },
  { category: "Abos & Streaming", pattern: /\babo(nnement)?\b|monatsbeitrag/i },
  { category: "Gesundheit", pattern: /apotheke|arzt(praxis)?|krankenkasse/i },
  { category: "Lebensmittel", pattern: /supermarkt|lebensmittel|getränkemarkt|getraenkemarkt/i },
  { category: "Einkommen", pattern: /gehalt|lohn|rente\b/i },
];

/** Liefert die Keyword-Liste für eine Kategorie anhand des Namens (oder leer). */
export function getKeywordsFor(categoryName: string): string[] {
  return MERCHANT_KEYWORDS.find((g) => g.category === categoryName)?.keywords || [];
}

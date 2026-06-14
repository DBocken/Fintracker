/**
 * Hierarchische Händler-/Schlagwort-Taxonomie für die automatische Kategorisierung.
 *
 * Single Source of Truth für:
 * - die lokalen Standardkategorien inkl. Unterkategorien (default-categories.ts)
 * - die Supabase-Migration, die die globalen Standardkategorien (user_id IS NULL)
 *   um Haupt-/Unterkategorien, Keywords und das `essenziell`-Flag ergänzt
 *   (scripts/generate-category-migration.mjs erzeugt die SQL daraus)
 *
 * Aufbau: Hauptkategorie -> Unterkategorie -> Keywords.
 * Die Keywords liegen ausschließlich auf der Unterkategorie-Ebene, damit das
 * spezifischere Match (Unterkategorie) im categorizeTransaction gewinnt und der
 * äußere Ring des Sunburst gefüllt wird. Hauptkategorien tragen keine Filter.
 *
 * `slug` muss [a-z]+ sein (wird zur stabilen lokalen ID `local-cat-<slug>`),
 * `name` muss über die gesamte Taxonomie eindeutig sein.
 */

import type { Ausgabenklasse } from "../types";

export type { Ausgabenklasse };

export interface SubcategoryDef {
  slug: string;
  name: string;
  keywords: string[];
  /** Überschreibt die `klasse` der Hauptkategorie (z. B. Parken in Mobilität). */
  klasse?: Ausgabenklasse;
}

export interface CategoryDef {
  slug: string;
  name: string;
  icon: string;
  color: string;
  /** Default-Ausgabenklasse der Gruppe; pro Unterkategorie überschreibbar. */
  klasse: Ausgabenklasse;
  subcategories: SubcategoryDef[];
}

export const CATEGORY_TAXONOMY: CategoryDef[] = [
  {
    slug: "einkommen",
    name: "Einkommen",
    icon: "💶",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "gehalt",
        name: "Gehalt",
        keywords: [
          "gehalt", "lohn", "bezüge", "bezuege", "gehaltszahlung", "lohnzahlung",
          "honorar", "umsatzerlös", "umsatzerloes", "trinkgeld", "auszahlung gewinn",
        ],
      },
      {
        slug: "rentesoziales",
        name: "Rente & Soziales",
        keywords: [
          "rente", "deutsche rentenversicherung", "betriebsrente", "pension",
          "kindergeld", "familienkasse", "bafög", "bafoeg", "elterngeld",
          "arbeitslosengeld", "agentur für arbeit", "agentur fuer arbeit",
          "jobcenter leistung", "wohngeld", "krankengeld",
        ],
      },
      {
        slug: "erstattungen",
        name: "Erstattungen",
        keywords: [
          "erstattung", "rückerstattung", "rueckerstattung", "steuererstattung",
          "finanzamt erstattung",
        ],
      },
      {
        slug: "zinsertraege",
        name: "Zinserträge",
        keywords: ["zinsen", "tagesgeldzinsen", "zinsgutschrift"],
      },
    ],
  },
  {
    slug: "wohnen",
    name: "Wohnen",
    icon: "🏠",
    color: "#1d5c54",
    klasse: "essenziell",
    subcategories: [
      {
        slug: "miete",
        name: "Miete & Hausgeld",
        keywords: [
          "miete", "kaltmiete", "warmmiete", "nebenkosten", "nebenkostenabrechnung",
          "hausgeld", "wohnungsgenossenschaft", "vonovia", "deutsche wohnen", "wbg",
          "gwg", "leg immobilien", "immobilien verwaltung", "hausverwaltung",
          "vw immobilien", "grundsteuer",
        ],
      },
      {
        slug: "stromenergie",
        name: "Strom & Energie",
        keywords: [
          "stadtwerke", "e.on", "eon energie", "enbw", "vattenfall", "eprimo",
          "lichtblick", "yello strom", "rwe", "gasag", "mainova", "naturstrom",
          "polarstern", "tibber", "octopus energy", "lsw energie", "lsw", "stromnetz",
        ],
      },
      {
        slug: "wasserabwasser",
        name: "Wasser & Abwasser",
        keywords: ["wasserwerk", "wasser/abwasser", "abwasser", "techem", "ista", "minol"],
      },
      {
        slug: "rundfunk",
        name: "Rundfunkbeitrag",
        keywords: ["gez", "rundfunkbeitrag", "ard zdf"],
      },
      {
        slug: "haushaltswaren",
        name: "Haushaltswaren",
        klasse: "diskretionaer",
        keywords: ["tedox", "ikea", "möbel", "moebel"],
      },
    ],
  },
  {
    slug: "kommunikation",
    name: "Kommunikation",
    icon: "📡",
    color: "#3a6ea5",
    klasse: "essenziell",
    subcategories: [
      {
        slug: "mobilfunk",
        name: "Mobilfunk",
        keywords: ["o2", "telefonica", "congstar", "mobilfunk", "prepaid"],
      },
      {
        slug: "internettv",
        name: "Internet & TV",
        keywords: ["vodafone", "telekom", "1&1", "1und1", "freenet", "kabel", "dsl"],
      },
    ],
  },
  {
    slug: "digitales",
    name: "Digitales",
    icon: "💻",
    color: "#5a5a8a",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "softwarecloud",
        name: "Software & Cloud",
        keywords: [
          "adobe", "microsoft", "microsoft 365", "office 365", "icloud",
          "google one", "apple.com/bill", "apple.com bill", "dropbox", "github",
        ],
      },
      {
        slug: "webhostingdomains",
        name: "Webhosting & Domains",
        keywords: ["strato", "webhosting", "domain", "ionos", "hetzner", "netcup"],
      },
    ],
  },
  {
    slug: "lebensmittel",
    name: "Lebensmittel",
    icon: "🛒",
    color: "#8a7d5a",
    klasse: "essenziell",
    subcategories: [
      {
        slug: "supermarkt",
        name: "Supermarkt",
        keywords: [
          "rewe", "edeka", "aldi", "aldi süd", "aldi nord", "lidl", "penny", "netto",
          "netto marken-discount", "kaufland", "real,-", "globus", "tegut", "denns",
          "denn's", "alnatura", "bio company", "feneberg", "hit markt", "combi",
          "famila", "marktkauf", "norma", "nah und gut", "nahkauf", "spar", "metro",
          "selgros", "picnic", "bringmeister", "knuspr", "flink", "gorillas",
        ],
      },
      {
        slug: "getraenkemarkt",
        name: "Getränkemarkt",
        keywords: ["getränke hoffmann", "getraenke hoffmann", "trinkgut", "fristo"],
      },
      {
        slug: "baeckerei",
        name: "Bäckerei",
        keywords: ["bäckerei", "baeckerei", "konditorei", "back-factory", "backfactory"],
      },
      {
        slug: "metzgerei",
        name: "Metzgerei",
        keywords: ["fleischerei", "metzgerei"],
      },
      {
        slug: "wochenmarkt",
        name: "Wochenmarkt",
        keywords: ["wochenmarkt", "hofladen"],
      },
    ],
  },
  {
    slug: "essenundtrinken",
    name: "Essen & Trinken",
    icon: "🍽️",
    color: "#a8845c",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "restaurant",
        name: "Restaurant",
        keywords: [
          "restaurant", "gastronomie", "ristorante", "l'osteria", "losteria",
          "vapiano", "nordsee", "dean & david", "dean&david", "five guys",
          "asia bistro", "sushi", "nem grill", "mongus garden", "pizzeria",
          "döner", "doener", "pizza",
        ],
      },
      {
        slug: "fastfood",
        name: "Fast Food",
        keywords: [
          "mcdonald", "mcdonalds", "burger king", "kfc", "subway", "imbiss",
          "lieferando", "uber eats", "wolt",
        ],
      },
      {
        slug: "cafe",
        name: "Café",
        keywords: ["café", "cafe", "bistro", "coffee fellows", "balzac", "tchibo café", "starbucks"],
      },
    ],
  },
  {
    slug: "mobilitaet",
    name: "Mobilität",
    icon: "🚗",
    color: "#5c7a99",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "kraftstoff",
        name: "Kraftstoff",
        klasse: "essenziell",
        keywords: [
          "tankstelle", "tanken", "aral", "shell", "esso", "jet", "star tankstelle",
          "agip", "eni", "avia", "hem tankstelle", "om tankstelle",
          "supermarkt tankstelle", "kraftstoff",
        ],
      },
      {
        slug: "oepnvbahn",
        name: "ÖPNV & Bahn",
        klasse: "essenziell",
        keywords: [
          "deutsche bahn", "db vertrieb", "db fernverkehr", "db regio", "flixbus",
          "flixtrain", "hvv", "mvg", "mvv", "bvg", "vbb", "vrr", "rmv", "vvs",
          "kvb", "vrs", "ddsd",
        ],
      },
      {
        slug: "kfzversicherung",
        name: "KFZ-Versicherung",
        klasse: "essenziell",
        keywords: ["kfz-versicherung", "kfz versicherung", "volkswagen autoversicherung", "autoversicherung"],
      },
      {
        slug: "parken",
        name: "Parken",
        keywords: ["apcoa", "ehc parken", "parkhaus", "parken", "vinci park"],
      },
      {
        slug: "werkstatttuev",
        name: "Werkstatt & TÜV",
        keywords: ["tüv", "tuev", "dekra", "werkstatt", "reifen", "autoteile", "adac"],
      },
      {
        slug: "carsharingtaxi",
        name: "Carsharing & Taxi",
        keywords: ["free now", "flinkster", "share now", "miles mobility", "uber", "taxi"],
      },
    ],
  },
  {
    slug: "gesundheit",
    name: "Gesundheit",
    icon: "💊",
    color: "#4a9a8d",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "apotheke",
        name: "Apotheke",
        klasse: "essenziell",
        keywords: [
          "apotheke", "dm apotheke", "shop-apotheke", "shop apotheke", "docmorris",
          "medpex", "easyapotheke",
        ],
      },
      {
        slug: "arztzahnarzt",
        name: "Arzt & Zahnarzt",
        klasse: "essenziell",
        keywords: [
          "arztpraxis", "zahnarzt", "augenarzt", "hausarzt", "facharzt",
          "krankenhaus", "klinik", "labor diagnostik",
        ],
      },
      {
        slug: "therapie",
        name: "Therapie",
        keywords: ["physiotherapie", "ergotherapie", "logopädie", "logopaedie"],
      },
      {
        slug: "krankenkasse",
        name: "Krankenkasse",
        klasse: "essenziell",
        keywords: [
          "barmer", "aok", "techniker krankenkasse", "tk krankenkasse", "dak",
          "ikk", "knappschaft", "krankenkasse", "private krankenversicherung",
        ],
      },
      {
        slug: "fitnessstudio",
        name: "Fitnessstudio",
        klasse: "diskretionaer",
        keywords: ["fitnessstudio", "mcfit", "fitx", "clever fit", "urban sports club", "yoga"],
      },
      {
        slug: "optikerhoergeraete",
        name: "Optiker & Hörgeräte",
        keywords: ["sehtest", "optiker", "hörgeräte", "hoergeraete", "fielmann"],
      },
    ],
  },
  {
    slug: "versicherungen",
    name: "Versicherungen",
    icon: "🛡️",
    color: "#7d8a87",
    klasse: "essenziell",
    subcategories: [
      {
        slug: "haftpflichthausrat",
        name: "Haftpflicht & Hausrat",
        keywords: [
          "haftpflicht", "hausratversicherung", "wohngebäudeversicherung",
          "wohngebaeudeversicherung", "vgh",
        ],
      },
      {
        slug: "lebensversicherung",
        name: "Lebensversicherung",
        klasse: "sparen",
        keywords: ["lebensversicherung", "provinzial", "alte leipziger"],
      },
      {
        slug: "sonstigeversicherung",
        name: "Sonstige Versicherung",
        klasse: "diskretionaer",
        keywords: [
          "versicherung", "allianz", "axa", "ergo", "debeka", "signal iduna",
          "generali", "wgv", "devk", "gothaer", "barmenia", "hanse merkur",
          "württembergische", "wuerttembergische", "cosmosdirekt", "verti versicherung",
          "ottonova", "zurich versicherung", "ihre versicherung", "r+v versicherung",
          "ruv", "lvm versicherung", "vhv", "continentale", "nürnberger versicherung",
          "nuernberger versicherung", "beitrag versicherung", "huk-coburg", "huk24",
          "huk coburg",
        ],
      },
    ],
  },
  {
    slug: "abosundstreaming",
    name: "Abos & Streaming",
    icon: "📺",
    color: "#7d6b8a",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "streaming",
        name: "Streaming",
        keywords: [
          "netflix", "spotify", "amazon prime", "disney+", "disneyplus",
          "youtube premium", "dazn", "sky deutschland", "wow tv", "rtl+", "rtl plus",
          "joyn", "audible", "paramount+", "paramount plus", "deezer", "tidal",
          "crunchyroll",
        ],
      },
      {
        slug: "zeitungmagazine",
        name: "Zeitung & Magazine",
        keywords: ["tagesspiegel abo", "spiegel plus", "zeitschriftenabo", "zeitungsabo"],
      },
      {
        slug: "sonstigeabos",
        name: "Sonstige Abos",
        keywords: ["abo", "abonnement", "patreon", "onlyfans", "fitness abo"],
      },
    ],
  },
  {
    slug: "spareninvestieren",
    name: "Sparen & Investieren",
    icon: "💰",
    color: "#c2a14d",
    klasse: "sparen",
    subcategories: [
      {
        slug: "bausparen",
        name: "Bausparen",
        keywords: ["bausparen", "lbs"],
      },
      {
        slug: "wertpapiere",
        name: "Wertpapiere",
        keywords: ["broker", "depot", "wertpapier", "etf", "trade republic", "scalable", "comdirect"],
      },
      {
        slug: "tagesgeld",
        name: "Tagesgeld",
        keywords: ["tagesgeld", "festgeld", "sparbuch"],
      },
    ],
  },
  {
    slug: "freizeithobby",
    name: "Freizeit & Hobby",
    icon: "🎲",
    color: "#b56576",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "lotto",
        name: "Lotto",
        keywords: ["lotto", "toto", "toto-lotto", "eurojackpot"],
      },
      {
        slug: "vereine",
        name: "Vereine",
        keywords: ["verein", "esports", "drk", "mitgliedsbeitrag"],
      },
      {
        slug: "kulturmuseen",
        name: "Kultur & Museen",
        keywords: ["museum", "eintritt", "kino", "theater", "konzert"],
      },
    ],
  },
  {
    slug: "shopping",
    name: "Shopping",
    icon: "🛍️",
    color: "#7bb8ac",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "kleidung",
        name: "Kleidung",
        keywords: [
          "h&m", "c&a", "primark", "tk maxx", "new yorker", "deichmann", "takko",
          "kik", "zalando", "vinted",
        ],
      },
      {
        slug: "drogerie",
        name: "Drogerie",
        klasse: "essenziell",
        keywords: ["dm-drogerie", "dm drogerie", "rossmann", "müller markt", "mueller markt"],
      },
      {
        slug: "elektronik",
        name: "Elektronik",
        keywords: [
          "mediamarkt", "saturn", "conrad electronic", "expert", "euronics",
          "notebooksbilliger", "apple store",
        ],
      },
      {
        slug: "baumarkt",
        name: "Baumarkt",
        keywords: ["obi", "hornbach", "bauhaus", "toom baumarkt"],
      },
      {
        slug: "allgemeinerhandel",
        name: "Allgemeiner Einzelhandel",
        keywords: [
          "amazon", "amzn", "otto", "ebay", "galeria", "thalia", "decathlon", "tedi",
          "kleinanzeigen", "temu", "shein", "wish", "lovoo", "buecher.de", "bücher.de",
          "real.de",
        ],
      },
    ],
  },
  {
    slug: "reisen",
    name: "Reisen",
    icon: "🏨",
    color: "#d08c45",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "hotels",
        name: "Hotels",
        keywords: ["hotel", "übernachtung", "uebernachtung"],
      },
      {
        slug: "urlaubausfluege",
        name: "Urlaub & Ausflüge",
        keywords: ["check24 reisen", "urlaub", "reisebüro", "reisebuero", "booking.com", "airbnb"],
      },
    ],
  },
  {
    slug: "finanzen",
    name: "Finanzen",
    icon: "🏦",
    color: "#6b7a8f",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "kontofuehrung",
        name: "Kontoführung",
        keywords: ["kontoführung", "kontogebühr", "kontofuehrung", "kontoführungsgebühr"],
      },
      {
        slug: "kreditkarte",
        name: "Kreditkarte",
        keywords: ["kreditkartenabrechnung", "miles & more", "kreditkarte"],
      },
      {
        slug: "gebuehrenzinsen",
        name: "Gebühren & Zinsen",
        keywords: ["dispozinsen", "sollzinsen", "gebühr", "sollzins"],
      },
    ],
  },
  {
    slug: "transfers",
    name: "Transfers",
    icon: "🔄",
    color: "#8a8a8a",
    klasse: "sparen",
    subcategories: [
      {
        slug: "eigenuebertrag",
        name: "Eigenübertrag",
        keywords: ["umbuchung", "eigenübertrag", "übertrag", "giro"],
      },
      {
        slug: "bargeld",
        name: "Bargeld",
        keywords: ["geldautomat", "bargeldabhebung", "bargeld", "atm"],
      },
    ],
  },
  {
    slug: "sonstiges",
    name: "Sonstiges",
    icon: "📦",
    color: "#9aa0a6",
    klasse: "diskretionaer",
    subcategories: [],
  },
];

/** Effektive Ausgabenklasse einer Unterkategorie (erbt von der Hauptkategorie). */
export function resolveKlasse(main: CategoryDef, sub?: SubcategoryDef): Ausgabenklasse {
  if (sub && sub.klasse) return sub.klasse;
  return main.klasse;
}

/** Abgeleitetes `essenziell`-Bool (klasse === 'essenziell'). */
export function isEssenziell(main: CategoryDef, sub?: SubcategoryDef): boolean {
  return resolveKlasse(main, sub) === "essenziell";
}

// -----------------------------------------------------------------------------
// Abgeleitete, abwärtskompatible Exporte
// -----------------------------------------------------------------------------

export interface MerchantKeywordGroup {
  category: string;
  keywords: string[];
}

/** Flache Sicht je Hauptkategorie (Vereinigung aller Unterkategorie-Keywords). */
export const MERCHANT_KEYWORDS: MerchantKeywordGroup[] = CATEGORY_TAXONOMY.map((c) => ({
  category: c.name,
  keywords: c.subcategories.flatMap((s) => s.keywords),
}));

/** Liefert die Keyword-Liste einer Hauptkategorie anhand des Namens (oder leer). */
export function getKeywordsFor(categoryName: string): string[] {
  return MERCHANT_KEYWORDS.find((g) => g.category === categoryName)?.keywords || [];
}

/**
 * Generische Regex-Fallback-Regeln (letzte Stufe, falls kein Keyword greift).
 * Verweisen auf die jeweilige Hauptkategorie (per Name).
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

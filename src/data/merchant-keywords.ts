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

import type { Ausgabenklasse, Category } from "../types";

export type { Ausgabenklasse };

export interface SubcategoryDef {
  slug: string;
  name: string;
  keywords: string[];
  /** Überschreibt die `klasse` der Hauptkategorie (z. B. Parken in Mobilität). */
  klasse?: Ausgabenklasse;
  /**
   * Voreingestellte Steuer-Rubrik (ID aus tax-catalog.ts). Buchungen dieser
   * Kategorie werden damit VORGESCHLAGEN (nie automatisch markiert). Setzt
   * zugleich `steuerrelevant: true` auf der erzeugten Standardkategorie.
   */
  taxDefault?: string;
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
    slug: "anstellung",
    name: "Anstellung",
    icon: "💼",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "gehalt",
        name: "Gehalt",
        keywords: [
          "gehalt", "lohn", "bezüge", "bezuege", "gehaltszahlung", "lohnzahlung",
          "entgeltabrechnung", "besoldung", "trinkgeld",
        ],
      },
      {
        slug: "minijob",
        name: "Minijob",
        keywords: [
          "minijob", "aushilfe", "geringfügige beschäftigung", "geringfuegige beschaeftigung",
        ],
      },
      {
        slug: "bonuspraemie",
        name: "Bonus & Prämie",
        keywords: [
          "bonuszahlung", "prämie", "praemie", "weihnachtsgeld", "urlaubsgeld",
          "sonderzahlung", "tantieme", "gewinnbeteiligung",
        ],
      },
    ],
  },
  {
    slug: "nebenerwerb",
    name: "Nebenerwerb & Selbstständigkeit",
    icon: "🧾",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "freelance",
        name: "Freelance & Honorare",
        keywords: [
          "honorar", "honorarnote", "freelance", "freelancer", "freiberuflich",
          "werkvertrag", "upwork", "fiverr",
        ],
      },
      {
        slug: "selbststaendigkeit",
        name: "Selbstständigkeit & Gewerbe",
        keywords: [
          "umsatzerlös", "umsatzerloes", "auszahlung gewinn", "gewerbeeinnahme",
          "kundenzahlung",
        ],
      },
    ],
  },
  {
    slug: "onlinecreator",
    name: "Online & Creator",
    icon: "🎥",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "creatorplattformen",
        name: "Creator-Plattformen",
        keywords: [
          "adsense", "google adsense", "youtube auszahlung", "twitch payout",
          "twitch auszahlung", "patreon payout", "patreon auszahlung", "steady",
          "ko-fi",
        ],
      },
      {
        slug: "affiliatewerbung",
        name: "Affiliate & Werbung",
        keywords: ["affiliate", "awin", "partnerprogramm", "provision", "werbeeinnahmen"],
      },
    ],
  },
  {
    slug: "verkaeufe",
    name: "Verkäufe",
    icon: "🏷️",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "onlineverkauf",
        name: "Online-Verkäufe",
        keywords: [
          "ebay auszahlung", "auszahlung ebay", "ebay commerce", "kleinanzeigen verkauf",
          "onlinepaymentplatform", "vinted auszahlung", "momox", "rebuy",
          "paypal auszahlung",
        ],
      },
      {
        slug: "flohmarkt",
        name: "Flohmarkt & Privatverkauf",
        keywords: ["flohmarkt", "privatverkauf", "verkauf privat"],
      },
    ],
  },
  {
    slug: "kapitalertraege",
    name: "Kapitalerträge",
    icon: "📈",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "zinsertraege",
        name: "Zinserträge",
        keywords: ["zinsen", "tagesgeldzinsen", "zinsgutschrift"],
      },
      {
        slug: "dividenden",
        name: "Dividenden",
        keywords: [
          "dividende", "dividendengutschrift", "ausschüttung", "ausschuettung",
          "ertragsgutschrift", "kapitalertrag",
        ],
      },
    ],
  },
  {
    slug: "staatsoziales",
    name: "Staat & Soziales",
    icon: "🏛️",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "rentesoziales",
        name: "Rente & Pension",
        keywords: [
          "rente", "deutsche rentenversicherung", "betriebsrente", "pension",
          "pensionskasse",
        ],
      },
      {
        slug: "familienleistungen",
        name: "Familienleistungen",
        keywords: [
          "kindergeld", "familienkasse", "elterngeld", "elterngeldstelle",
          "unterhaltsvorschuss",
        ],
      },
      {
        slug: "sozialleistungen",
        name: "Sozialleistungen",
        keywords: [
          "arbeitslosengeld", "bürgergeld", "buergergeld", "agentur für arbeit",
          "agentur fuer arbeit", "jobcenter leistung", "wohngeld", "krankengeld",
          "bafög", "bafoeg",
        ],
      },
    ],
  },
  {
    slug: "erstattungen",
    name: "Erstattungen",
    icon: "↩️",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "steuererstattung",
        name: "Steuererstattung",
        keywords: [
          "steuererstattung", "finanzamt erstattung", "einkommensteuererstattung",
        ],
      },
      {
        slug: "versicherungserstattung",
        name: "Versicherungserstattung",
        keywords: [
          "beitragsrückerstattung", "beitragsrueckerstattung", "schadenerstattung",
          "versicherung erstattung",
        ],
      },
      {
        slug: "rueckzahlungen",
        name: "Rückzahlungen",
        keywords: [
          "erstattung", "rückerstattung", "rueckerstattung", "rückzahlung",
          "rueckzahlung",
        ],
      },
    ],
  },
  {
    // slug bleibt "einkommen" für stabile Legacy-ID local-cat-einkommen (frühere
    // einzige Einkommens-Hauptkategorie, jetzt Auffangkategorie für Sonstiges).
    slug: "einkommen",
    name: "Sonstige Einnahmen",
    icon: "💶",
    color: "#2e7d72",
    klasse: "einkommen",
    subcategories: [
      {
        slug: "geschenkeeinnahmen",
        name: "Geldgeschenke",
        keywords: ["geldgeschenk", "schenkung", "taschengeld"],
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
        // "grundsteuer" ist bewusst NICHT mehr hier (→ Steuern & Abgaben):
        // für Eigentümer ist Grundsteuer keine Miete.
        keywords: [
          "miete", "kaltmiete", "warmmiete", "nebenkosten", "nebenkostenabrechnung",
          "hausgeld", "wohnungsgenossenschaft", "vonovia", "deutsche wohnen", "wbg",
          "gwg", "leg immobilien", "immobilien verwaltung", "hausverwaltung",
          "vw immobilien",
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
        // "möbelhaus"/"moebelhaus" kompensieren die Wortgrenzen-Regel für das
        // kurze Keyword "möbel" (Komposita matchen sonst nicht mehr).
        keywords: ["tedox", "ikea", "möbel", "moebel", "möbelhaus", "moebelhaus"],
      },
      {
        slug: "handwerker",
        name: "Handwerker & Reparaturen",
        klasse: "diskretionaer",
        // §35a Abs. 3: nur der Arbeits-/Fahrtkostenanteil ist begünstigt (Material nicht).
        taxDefault: "tax-35a3-handwerker",
        keywords: [
          "handwerker", "sanitär", "sanitaer", "elektriker", "elektroinstallation",
          "maler", "malerbetrieb", "dachdecker", "schornsteinfeger", "kaminkehrer",
          "heizungswartung", "klempner", "installateur", "tischler", "schreiner",
          "fliesenleger", "rohrreinigung", "schlüsseldienst", "schluesseldienst",
        ],
      },
      {
        slug: "haushaltsdienste",
        name: "Haushaltsnahe Dienstleistungen",
        klasse: "diskretionaer",
        taxDefault: "tax-35a2-dienstleistung",
        keywords: [
          "reinigungsservice", "putzhilfe", "putzkraft", "gebäudereinigung",
          "gebaeudereinigung", "fensterreinigung", "gartenpflege", "gartenservice",
          "winterdienst", "hausmeisterservice", "pflegedienst", "umzugsservice",
        ],
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
        // Sonderausgabe: nur der Kfz-Haftpflicht-Anteil (nicht Kasko).
        taxDefault: "tax-so-versicherungen",
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
        // Außergewöhnliche Belastung: nur ärztlich verordnete Präparate zählen.
        taxDefault: "tax-agb-krankheit",
        keywords: [
          "apotheke", "dm apotheke", "shop-apotheke", "shop apotheke", "docmorris",
          "medpex", "easyapotheke",
        ],
      },
      {
        slug: "arztzahnarzt",
        name: "Arzt & Zahnarzt",
        klasse: "essenziell",
        taxDefault: "tax-agb-krankheit",
        keywords: [
          "arztpraxis", "zahnarzt", "augenarzt", "hausarzt", "facharzt",
          "krankenhaus", "klinik", "labor diagnostik",
        ],
      },
      {
        slug: "therapie",
        name: "Therapie",
        // Medizinische Therapie ist keine Kür — essenziell wie Arzt/Apotheke.
        klasse: "essenziell",
        taxDefault: "tax-agb-krankheit",
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
        // Sehhilfen/Hörgeräte sind medizinische Hilfsmittel — essenziell.
        klasse: "essenziell",
        taxDefault: "tax-agb-krankheit",
        keywords: ["sehtest", "optiker", "hörgeräte", "hoergeraete", "fielmann"],
      },
    ],
  },
  {
    slug: "kinderfamilie",
    name: "Kinder & Familie",
    icon: "👶",
    color: "#c88ba0",
    klasse: "essenziell",
    subcategories: [
      {
        slug: "kinderbetreuung",
        name: "Kinderbetreuung",
        // Sonderausgabe §10 Abs. 1 Nr. 5 EStG (80 % von max. 6.000 €/Kind).
        taxDefault: "tax-so-kinderbetreuung",
        keywords: [
          "kita", "kindergarten", "kindertagesstätte", "kindertagesstaette",
          "kinderhort", "tagesmutter", "babysitter", "kinderbetreuung",
        ],
      },
      {
        slug: "schule",
        name: "Schule",
        // Sonderausgabe §10 Abs. 1 Nr. 9 EStG (Schulgeld 30 %, max. 5.000 €).
        taxDefault: "tax-so-schulgeld",
        keywords: ["schulgeld", "privatschule", "schulbedarf", "klassenfahrt"],
      },
      {
        slug: "spielzeugkind",
        name: "Spielzeug & Kind",
        klasse: "diskretionaer",
        keywords: ["spielzeug", "mytoys", "smyths toys"],
      },
    ],
  },
  {
    slug: "bildung",
    name: "Bildung",
    icon: "🎓",
    color: "#8a6d9c",
    klasse: "diskretionaer",
    subcategories: [
      {
        slug: "fortbildung",
        name: "Fortbildung & Kurse",
        // Werbungskosten (Anlage N): berufliche Fort-/Weiterbildung.
        taxDefault: "tax-n-fortbildung",
        keywords: [
          "seminar", "fortbildung", "weiterbildung", "schulung", "udemy",
          "coursera", "volkshochschule", "vhs", "fernuni", "ihk",
        ],
      },
      {
        slug: "buecher",
        name: "Bücher & Fachliteratur",
        keywords: ["thalia", "hugendubel", "buchhandlung", "fachliteratur", "buecher.de", "bücher.de"],
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
        // Slug bleibt aus ID-Stabilität "haftpflichthausrat" (Bestandsdaten
        // referenzieren local-cat-haftpflichthausrat); fachlich ist die Kategorie
        // jetzt NUR Hausrat/Gebäude — beides steuerlich nicht absetzbar, daher
        // bewusst KEIN taxDefault. Haftpflicht hat eine eigene Kategorie.
        slug: "haftpflichthausrat",
        name: "Hausrat & Gebäude",
        keywords: [
          "hausratversicherung", "hausrat", "wohngebäudeversicherung",
          "wohngebaeudeversicherung",
        ],
      },
      {
        slug: "haftpflicht",
        name: "Haftpflichtversicherung",
        // Sonderausgabe (§10 Abs. 1 Nr. 3a EStG): Haftpflicht ist absetzbar.
        taxDefault: "tax-so-versicherungen",
        keywords: ["haftpflicht", "privathaftpflicht", "haftpflichtversicherung"],
      },
      {
        slug: "lebensversicherung",
        name: "Lebensversicherung",
        klasse: "sparen",
        taxDefault: "tax-so-versicherungen",
        keywords: ["lebensversicherung", "provinzial", "alte leipziger"],
      },
      {
        slug: "sonstigeversicherung",
        name: "Sonstige Versicherung",
        klasse: "diskretionaer",
        taxDefault: "tax-so-versicherungen",
        keywords: [
          "versicherung", "allianz", "axa", "ergo", "debeka", "signal iduna", "vgh",
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
        // Bewusst KEIN bares "depot": kollidiert als eigenständiges Wort mit der
        // Deko-Kette DEPOT (Homonym, Wortgrenzen helfen nicht).
        keywords: ["broker", "depotgebühr", "depotgebuehr", "depotführung", "depotfuehrung", "depotübertrag", "wertpapier", "etf", "trade republic", "scalable", "comdirect"],
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
        // Bewusst KEIN taxDefault: Vereins-/Mitgliedsbeiträge (ADAC, Sportverein)
        // sind meist NICHT gemeinnützig — echte Spenden erkennt die Keyword-Ebene
        // der Steuer-Vorschläge (tax-so-spenden) mit sichtbarem Grund.
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
          "amazon", "amzn", "otto", "ebay", "galeria", "decathlon", "tedi",
          "kleinanzeigen", "temu", "shein", "wish", "lovoo",
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
        // Werbungskosten: 16 € Kontoführungspauschale ohne Einzelnachweis.
        taxDefault: "tax-n-kontofuehrung",
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
    slug: "steuernabgaben",
    name: "Steuern & Abgaben",
    icon: "🏛️",
    color: "#6b7a8f",
    klasse: "essenziell",
    subcategories: [
      {
        // "grundsteuer" ist hier fachlich richtig verortet (früher fälschlich in
        // Miete — für Eigentümer irreführend). Selbstgenutzt nicht absetzbar,
        // daher bewusst KEIN taxDefault (bei Vermietung greift die manuelle
        // Zuordnung zur Anlage-V-Rubrik).
        slug: "grundsteuerabgabe",
        name: "Grundsteuer",
        keywords: ["grundsteuer"],
      },
      {
        slug: "steuerzahlungen",
        name: "Steuerzahlungen",
        keywords: ["finanzamt", "einkommensteuer", "steuernachzahlung", "kfz-steuer", "kfzsteuer"],
      },
      {
        slug: "kommunaleabgaben",
        name: "Kommunale Abgaben",
        keywords: ["abfallwirtschaft", "müllabfuhr", "muellabfuhr", "stadtkasse", "straßenreinigung", "strassenreinigung"],
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
    subcategories: [
      {
        slug: "spenden",
        name: "Spenden",
        // Nur Spenden an steuerbegünstigte Organisationen (Zuwendungsbestätigung).
        taxDefault: "tax-so-spenden",
        keywords: [
          "spende", "betterplace", "unicef", "wwf", "caritas",
          "ärzte ohne grenzen", "aerzte ohne grenzen", "brot für die welt",
          "welthungerhilfe",
        ],
      },
    ],
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

/**
 * Baut die Standardkategorien aus der Taxonomie: Hauptkategorien
 * (parent_id = null, keine Filter) und darunter Unterkategorien mit Keywords.
 * Stabile IDs `local-cat-<slug>`. Eine Quelle der Wahrheit für die gebündelten
 * Defaults (default-categories.ts) UND das Supabase-Template
 * (scripts/generate-category-template.mjs) — so bleiben beide deckungsgleich.
 */
export function buildDefaultCategories(): Category[] {
  return CATEGORY_TAXONOMY.flatMap((main) => {
    const mainId = `local-cat-${main.slug}`;
    const mainCategory: Category = {
      id: mainId,
      user_id: null,
      name: main.name,
      name_key: `categoryNames.${main.slug}.name`,
      color: main.color,
      icon: main.icon,
      filters: [],
      is_default: true,
      parent_id: null,
      attributes: { essenziell: main.klasse === "essenziell", ausgabenklasse: main.klasse },
    };
    const subCategories: Category[] = main.subcategories.map((sub) => ({
      id: `local-cat-${sub.slug}`,
      user_id: null,
      name: sub.name,
      name_key: `categoryNames.${sub.slug}.name`,
      color: main.color,
      icon: main.icon,
      filters: sub.keywords,
      is_default: true,
      parent_id: mainId,
      attributes: {
        essenziell: isEssenziell(main, sub),
        ausgabenklasse: resolveKlasse(main, sub),
        ...(sub.taxDefault ? { steuerrelevant: true, default_tax_category_id: sub.taxDefault } : {}),
      },
    }));
    return [mainCategory, ...subCategories];
  });
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
 * Verweisen auf die jeweilige Hauptkategorie (per SLUG, nicht per Name).
 *
 * Der Slug ist die stabile Identitaet (`local-cat-<slug>`); der Name ist eine
 * Beschriftung, die die Nutzerin umbenennen kann und die seit der
 * Lokalisierung der Kategorienamen ausserdem sprachabhaengig ist. Ein Match
 * ueber den Namen brach in beiden Faellen still.
 */
export interface RegexFallbackRule {
  categorySlug: string;
  pattern: RegExp;
}

export const REGEX_FALLBACK_RULES: RegexFallbackRule[] = [
  { categorySlug: "mobilitaet", pattern: /tankstelle|tanken|kraftstoff/i },
  { categorySlug: "wohnen", pattern: /\b(miete|nebenkosten|hausgeld|wohnung)\b/i },
  { categorySlug: "versicherungen", pattern: /versicherung|beitrag.*vers/i },
  { categorySlug: "abosundstreaming", pattern: /\babo(nnement)?\b|monatsbeitrag/i },
  { categorySlug: "gesundheit", pattern: /apotheke|arzt(praxis)?|krankenkasse/i },
  { categorySlug: "lebensmittel", pattern: /supermarkt|lebensmittel|getränkemarkt|getraenkemarkt/i },
  { categorySlug: "anstellung", pattern: /gehalt|lohn/i },
  { categorySlug: "staatsoziales", pattern: /\brente\b|kindergeld|elterngeld|buergergeld|bürgergeld/i },
];

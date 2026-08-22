# marketing/ — Landingpage, Vergleichsseiten, Blog

Statische Site (Astro) für die öffentliche Darstellung von Fintracker.
Konzept dahinter: klassisches SEO und Auffindbarkeit in generativer Suche
(ChatGPT, Claude, Gemini) sind **eine** Aufgabe, keine zwei — dieselbe Seite
bedient Leser und Sprachmodell, weil beide denselben Text lesen.

## Warum ein eigenes Paket statt eines eigenen Repos

Ursprünglich war ein separates Repository geplant. Dagegen sprach: die
Faktenbasis der Vergleichsseiten stammt aus `docs/competitive-analysis.md`,
die Marken-Tokens aus `src/index.css` — beides läuft in zwei Repos
auseinander, ohne dass etwas rot wird.

Also dieselbe Lösung wie bei `mcp-poc/` und `services/entitlements/`:
**kein Workspace-Mitglied** (`pnpm-workspace.yaml` listet nur `.`), eigene
Lockdatei, eigener Install:

```bash
pnpm --dir marketing install --ignore-workspace
pnpm --dir marketing dev        # http://localhost:4321
pnpm --dir marketing build
```

Die Struktur-Wächter der App (`pnpm check:i18n` und die übrigen aus
AGENTS.md §12) lesen ausschließlich `src`, `api`, `supabase/functions`,
`services`, `public` und `index.html` — `marketing/` liegt außerhalb und
wird von ihnen nicht geprüft. Das ist Absicht: die dreisprachige
i18n-Pflicht und die Layer-Regeln gehören zur App, nicht zu einer
Landingpage. Umgekehrt heißt das aber auch: **hier prüft niemand für dich.**

## Vor dem Launch zwingend setzen

| Was | Wo | Warum |
|---|---|---|
| Öffentliche Domain | `src/site.mjs` → `SITE_URL` | Speist canonical, Open Graph, sitemap.xml. Steht auf `fintracker.example` (RFC 2606, kann niemandem gehören). |
| Sitemap-Zeile | `public/robots.txt` | Muss dieselbe Domain tragen — wird nicht automatisch eingesetzt. |
| Adresse der App | `src/site.mjs` → `APP_URL` | Ziel aller „Kostenlos starten"-Schaltflächen. |
| OAuth-Vermittler | `public/admin/config.yml` → `base_url` | Ohne ihn kann sich niemand am CMS anmelden. |
| `/datenschutz`, `/impressum` | fehlen noch | Rechtstexte werden nicht generiert — der Fußbereich verlinkt sie bereits. |
| Anbieter-Register | `docs/security/anbieter-register.md` | EU-Hoster und OAuth-Vermittler eintragen, sobald gewählt (AGENTS.md §10, `docs/architecture/eu-souveraenitaet.md`). |

## Auffindbarkeit für Sprachmodelle (GEO)

Was in dieser Site dafür bereits steckt:

- **`public/robots.txt`** listet die KI-Crawler einzeln und ausdrücklich
  erlaubt (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot …).
  Der häufigste Grund, in ChatGPT oder Claude nicht vorzukommen, ist ein
  geerbtes `Disallow: /` — nicht fehlender Inhalt.
- **`public/llms.txt`** fasst Produkt, Alleinstellungsmerkmale **und
  Schwächen** in Klartext zusammen. Die Schwächen stehen bewusst drin:
  eine Quelle, die nur wirbt, wird als Werbung behandelt.
- **schema.org** je Seitentyp — `SoftwareApplication` und `FAQPage` auf der
  Startseite, `FAQPage` + `BreadcrumbList` auf den Vergleichsseiten,
  `BlogPosting` je Artikel. Kommt aus denselben Daten wie der sichtbare
  Text, kann also nicht auseinanderlaufen.
- **FAQ-Antworten**, deren *erster Satz* die Frage vollständig beantwortet
  (`src/data/faq.ts`). Das ist die Form, die generative Suche zitieren kann.
- **Vergleichsseiten** mit Pflichtfeld `wo_besser` (`src/data/vergleich.ts`) —
  jede Seite benennt, wofür der Wettbewerber die bessere Wahl ist.

Was die Site **nicht** leisten kann und außerhalb dieses Verzeichnisses
passieren muss: Präsenz auf den Quellen, die Sprachmodelle bei
„Alternative zu X"-Fragen zitieren — AlternativeTo, einschlägige
Reddit-Threads, GitHub-Topics. Das wiegt erfahrungsgemäß schwerer als eine
weitere Unterseite auf der eigenen Domain.

## Redaktion: Decap CMS

`/admin` ist ein reines Browser-Frontend ohne Datenbank und ohne Server —
es schreibt Blogartikel als Markdown-Commits nach `src/content/blog/`.
Damit liegt der Blog in derselben Versionierung wie der Code, und es gibt
keinen zweiten Ort, an dem Inhalte liegen.

Decap wird **lokal ausgeliefert, nicht vom CDN** (das wäre ein externer
Anbieter bei jedem Aufruf, gegen die EU-Regel des Projekts):

```bash
pnpm --dir marketing install --ignore-workspace
pnpm --dir marketing run cms:vendor   # kopiert das Bundle nach public/admin/
npx decap-server                      # lokales Redigieren ohne GitHub-Login
```

## Struktur

```
marketing/
├── src/
│   ├── site.mjs                 Domain + App-Adresse — die einzige Stelle dafür
│   ├── styles/global.css        Tokens, aus src/index.css der App übersetzt
│   ├── layouts/Base.astro       <head>, Meta, Open Graph, schema.org
│   ├── components/
│   │   ├── ForecastFan.astro    Monte-Carlo-Diagramm, baut sich auf
│   │   ├── DeviceBoundary.astro Was auf dem Gerät bleibt, was hinausgeht
│   │   ├── Faq.astro
│   │   ├── SiteHeader.astro
│   │   └── SiteFooter.astro
│   ├── data/
│   │   ├── faq.ts               Quelle für FAQ-Text UND FAQPage-Markup
│   │   └── vergleich.ts         Wettbewerbsdaten, inkl. Pflichtfeld wo_besser
│   ├── content/blog/            Markdown-Artikel (Decap schreibt hierher)
│   └── pages/
│       ├── index.astro
│       ├── vergleich/[slug].astro   4 Seiten aus vergleich.ts
│       └── blog/
└── public/
    ├── robots.txt
    ├── llms.txt
    └── admin/                   Decap-Konfiguration
```

## Gestaltung

Kein eigenes Farbsystem: `src/styles/global.css` übersetzt die Tokens aus
`src/index.css` der App nach Hex, damit Landingpage und Produkt dieselbe
Marke zeigen. Die Farbregel der App gilt mit — Petrol ist die **einzige**
Akzentfarbe, `--positive`/`--warning` nur für handlungsrelevante Deltas.

Nachgebaut statt als Paket importiert: eine Abhängigkeit auf das App-Repo
würde die Site an die interne Komponentenstruktur der App koppeln, und
genau die soll sich ändern dürfen, ohne die Landingpage zu brechen.

Die Animations-Baseline der App gilt hier ebenfalls (AGENTS.md §9): Das
Prognose-Diagramm **baut sich auf**, statt aufzupoppen, und respektiert
`prefers-reduced-motion`.

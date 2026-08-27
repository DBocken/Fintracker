# AGENTS.md — Fintracker

Kanonische Regelquelle für **alle** KI-Agenten (Claude, Codex, Copilot, …), die an
diesem Repository arbeiten. Diese Datei ist in sich vollständig; Details stehen
verweisend in `docs/`. Bei Widerspruch zu jedem anderen Dokument gilt **diese
Datei** — `CLAUDE.md` enthält nur noch Claude-Code-Mechanik, `AI_RULES.md` nur
noch einen Wegweiser hierher (der Dateiname wird von manchen Werkzeugen
erwartet).

**Landkarte der Dokumentation: [`docs/README.md`](docs/README.md).** Sie trennt
geltende Regeln von Protokollen (Audits, Berichte, Momentaufnahmen). Alles unter
`docs/archive/` ist Beleg, keine Vorgabe — es wird nicht nachgeführt und darf
nicht als Grundlage für Entscheidungen dienen.

## Arbeitsweise: Absicht vor Auftrag (verbindlich, übergreifend)

Diese Regel steht bewusst vor allen nummerierten Abschnitten und ohne eigene
Nummer: sie gilt für jeden von ihnen, und die bestehende Nummerierung §1–§12
ist aus Code-Kommentaren heraus referenziert.

Ein Auftrag wird **nicht wörtlich abgearbeitet**, sondern zuerst auf Ziel und
Absicht geprüft. Nichts wird ungeprüft übernommen — keine Bezeichnung, keine
Bibliothek, kein Lösungsweg, auch dann nicht, wenn der Auftrag sie vorgibt.
Anschließend wird die Methode gewählt, die das *Ziel* mit der höchsten
technischen Qualität erreicht, nicht die, die dem Wortlaut am nächsten kommt.

### Wann die Regel greift

| Greift | Greift nicht |
|---|---|
| Bezeichnungen in persistierten Daten, Typen, öffentlichen APIs, i18n-Keys, Dateipfaden | offensichtliche mechanische Arbeit, Tippfehler, Einzeiler mit genau einer sinnvollen Lösung |
| Wahl von Methode, Bibliothek, Architektur, Datenmodell | Anwenden einer hier bereits entschiedenen Regel |
| alles, was nach dem Merge nur noch mit Migration änderbar ist | reines Ausführen eines schon geprüften Plans |

Die Schwelle ist Absicht: Hinterfragen ohne Bleibewirkung ist Reibung, keine
Sorgfalt.

### Was geprüft wird

1. **Ziel dahinter.** Welches Problem soll gelöst werden? Löst der wörtliche
   Auftrag es tatsächlich?
2. **Bessere Methode.** Existiert ein Weg mit weniger Zustand, weniger
   Sonderfällen, besserer Testbarkeit?
3. **Bessere Bezeichnung.** Deckt sich der Name mit der Sprache der
   Oberfläche und der Fachdomäne? Etikettiert er, wo er beschreiben sollte?
4. **Ungenannte Konsequenzen.** Was folgt daraus, das der Auftrag nicht
   erwähnt — für Bestandsdaten, Bestandsnutzer, angrenzende Features, CI?
5. **Letzter günstiger Zeitpunkt.** Was ist jetzt eine Textersetzung und nach
   dem Merge eine Migration? Das wird *vor* dem Merge gesagt, nicht danach.
6. **Weiterdenken.** Gedankengänge, die der Auftraggeber nicht zu Ende geführt
   hat, werden fortgeführt und ihre Folgen benannt — auch ungefragt.

```markdown
❌ „Wird gemacht." → Auftrag wörtlich umgesetzt, Bezeichnung übernommen.
✅ „Der sichtbare Text sagt durchgehend X, der Code Y — das driftet.
    Ich empfehle X, weil […]. Jetzt eine Textersetzung, nach dem Merge
    eine Migration des persistierten Feldes."
```

### Wie das Ergebnis aussieht

- **Eine Empfehlung, keine Optionen-Parade.** Alternativen werden nur genannt,
  soweit sie die Entscheidung tragen, jeweils mit dem Grund für die Absage.
- **Einwand blockiert nicht.** Bedenken werden in ein bis zwei Sätzen benannt,
  danach wird geliefert — unter ausdrücklich genannter Annahme. Eine echte
  Rückfrage nur, wenn jede Annahme das Ergebnis unbrauchbar machen könnte.
- **Bestätigung beendet die Diskussion.** Bekräftigt der Auftraggeber seine
  Vorgabe nach dem Einwand, ist entschieden; das Thema wird nicht erneut
  aufgerollt.

Diese Regel ist **nicht** automatisiert erzwingbar (kein Hook, kein CI-Schritt
kann eine Absicht prüfen) — sie gehört zum Selbst-Review vor jedem Commit.

## 1. Was ist Fintracker

Fintracker ist eine **local-first** Finanz-App. **IndexedDB ist der primäre
Speicher** (optional AES-GCM-verschlüsselt) — Finanzdaten bleiben standardmäßig
auf dem Gerät. **Supabase ist NUR für Auth und explizite Opt-in-Features**
(Cloud-Sync, Markt-Daten) im Einsatz, nicht als primärer Datenspeicher. Das
korrigiert das Cloud-first-Framing älterer Berichte, die deshalb unter
`docs/archive/` liegen (u. a. `technical-improvements-2026-06.md`).
Stack: React 18 + TypeScript (`strict`), Vite, Tailwind CSS, Capacitor für
Android. Details: `docs/coding-guide.md` §1, `docs/security-boundaries.md`.

## 2. Setup & Kommandos

**Nur `pnpm`** (Version 10.12.4 / Node 22, wie in CI) — **npm/yarn nicht
verwenden**.

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Dev-Server (Vite) |
| `pnpm build` | Typecheck (`tsc`) + Produktions-Build — deckt nur `src` ab, siehe die zwei Zeilen darunter |
| `pnpm typecheck:api` | Typecheck der Vercel Serverless Functions (`api/`, eigenes `tsconfig.json`). Das Root-`tsconfig` includiert bewusst nur `src` + `vitest.setup.ts` und zielt auf den Browser (DOM, JSX, `moduleResolution: bundler`) — `api/` läuft in Node und braucht andere Globals. `docs/coding-guide.md` behauptete bis WP 2.4, beides sei im Typecheck; **es war nie so**, und ausgerechnet der Token-Endpunkt kompilierte ungeprüft. Läuft in CI |
| `pnpm typecheck:entitlements` · `pnpm test:entitlements` | Typecheck und Tests des **EntitlementService** (`services/entitlements/`, WP 6.2) — serverseitige Berechtigungen an der internen userId, spricht mit Mollie. Wie `mcp-poc` **kein** Workspace-Paket: eigener Install (`pnpm --dir services/entitlements install --ignore-workspace`), eigene Lockdatei, eigener OSV-Scan-Eintrag. **Eigene `vitest.config.ts` mit `environment: 'node'`**, und die Wurzel-Suite schliesst `services/**` aus — nachgemessen fielen dort 11 von 42 Tests durch, weil die Schlüsselerzeugung der JWT-Prüfung in `jsdom` nicht dieselbe ist. Kein echter Fehler, nur der falsche Runner. Beides läuft in CI; dazu ein eigener CI-Job, der die Migrationen gegen ein **leeres** Postgres anwendet und beweist, dass das Schema allein aus dem Repo entsteht |
| `pnpm typecheck:mcp-poc` | Dasselbe für `mcp-poc/`. Setzt dort einen eigenen Install voraus (`pnpm --dir mcp-poc install --ignore-workspace`): mcp-poc ist **kein** Workspace-Paket (`pnpm-workspace.yaml`, `packages: [.]`) und hat eine eigene Lockdatei — dieselbe Trennung respektiert der OSV-Scan. Ohne `--ignore-workspace` übernimmt der Root-Workspace den Aufruf und installiert nichts. Läuft in CI |
| `pnpm preview` | Build lokal previewen |
| `pnpm lint` | ESLint — keine Warnungen erlaubt |
| `pnpm test` | Alle Vitest-Suiten |
| `pnpm test:watch` | Vitest im Watch-Modus |
| `pnpm test:coverage` | Tests + Coverage (Schwellen in `vitest.config.ts` sind Pflicht) |
| `pnpm test:security` | Security-Wächter-Tests (`[SECURITY]`) |
| `pnpm test:integrity` | Integritäts-Tests (`[INTEGRITY]`) |
| `pnpm test:privacy` | Privacy-Tests (`[PRIVACY]`) |
| `pnpm test:mobile` | Mobile-spezifische Tests (`[MOBILE]`) |
| `pnpm test:e2e` | Playwright-Suite (`e2e-tests/`, Port 5173). Eigener CI-Job, nicht Teil von `pnpm test` |
| `pnpm check:i18n` | Prüft, dass kein sichtbarer UI-Text hardcodiert im Quelltext steht. Erkannt werden **drei Formen**: Zeichenkette, **Template-Literal** (`` `Schuld „${name}" löschen?` ``) und **JSX-Text** (`<span>Verträge</span>`). Die letzten beiden waren bis WP-12.2 unsichtbar — der Wächter suchte nach `"Wort`/`'Wort`, und damit war ausgerechnet interpolierter Text und der häufigste Fall überhaupt nie im Blick. Ebenso weg ist der Pauschalfilter auf jeden Pfad mit `constants`. Seit WP 6.8 zählt zusätzlich das **einzelne** deutsche Wort, sobald seine **Position** es als Bildschirmtext ausweist — bis dahin brauchte ein Fund entweder ein Wort aus der Handliste oder einen Umlaut in **zwei** Wörtern, und damit liefen `{ label: "Aufbewahrung" }`, `<strong>Hinweis:</strong>` und `` `Verbindungsfehler: ${e.message}` `` unbehelligt durch. Drei Positionen gelten als Ausweis: **JSX-Text** (was zwischen zwei Tags steht, wird gerendert), der **Wert einer Text-Prop** (`label`, `title`, `description`, `placeholder`, `alt`, `aria-label`, … — exakt diese Namen; `name`/`value`/`id` gerade nicht, die tragen genauso oft einen Bezeichner) und die **Beschriftungsform „Wort: …"** (ein Wort, das auf einen Doppelpunkt endet, redet einen Leser an; `Content-Type:` und `HH:mm` haben eine andere Wortform). Überall sonst bleibt es bei zwei Wörtern — Einzelwörter pauschal zu melden hätte mehr Fehlalarm als Fund erzeugt. Ebenfalls WP 6.8: Ein `t()`-Aufruf auf einer Zeile deckt **JSX-Text darauf nicht mehr ab** (Argumente von `t()` sind Zeichenketten, JSX-Text kann keines sein) — die Zeilen-Pauschale hatte genau die halb übersetzte Zeile verschluckt, `<strong>Hinweis:</strong> {t('…')}`. **Zwei Modi:** `--staged`/`--range` melden nur Fundstellen auf geänderten Zeilen, `--all` den ganzen Baum — der Diff-Modus kann Altbestand strukturell NIE sehen. Beide laufen in Pre-Commit und CI. Die Erkennung selbst steht in `i18n-core.mjs` und ist ohne git testbar. Die Ausnahmeliste `i18n-allowlist.json` kennt wie die Query-Liste zwei Formen: eine blosse **Zahl** ist offenes Backlog und darf nur sinken; ein Objekt **`{ count, reason }`** ist entschieden (Suchvokabular gegen deutschen Kontoauszugstext, Produktname, Entwicklermeldung). Die **Key-Symmetrie** prüft dagegen `src/i18n/__tests__/locale-parity.test.ts` (vollständiger Blatt-Vergleich aller `SUPPORTED_LOCALES` gegen `de`, unabhängig vom Diff) |
| `pnpm check:i18n-module-consts` | Findet `t()`-Aufrufe im Initializer einer Modul-`const` — die frieren beim Import ein und ignorieren jeden späteren Sprachwechsel. Ganzbaumig über die TypeScript-AST, läuft in Pre-Commit und CI |
| `pnpm check:query-errors` | Verlangt, dass jeder `useQuery`-Aufruf den Fehlerfall in die Hand nimmt. Sonst macht der übliche Fallback `data = []` einen Ladefehler unsichtbar und der Screen behauptet „du hast noch nichts“. **Vier anerkannte Formen:** `isError`/`error`/`status` destrukturieren · `throwOnError` · `return useQuery(…)` (ein Hook reicht durch, statt darzustellen — §3) · `const q = useQuery(…)` mit späterem `q.isError`, auch gesammelt über mehrere Abfragen einer Fläche. Kommentare werden ausgeblendet. Der destrukturierte Name muss auch BENUTZT werden — `isError: _fooError` ist ein Eingeständnis, keine Behandlung. Die Ausnahmeliste `query-error-allowlist.json` kennt zwei Formen: eine blosse **Zahl** ist offenes Backlog und darf nur sinken; ein Objekt **`{ count, reason }`** ist entschieden (Voreinstellung, deren Standard bereits die richtige Antwort ist · Vorschlag, der nichts behauptet, wenn er ausbleibt · `queryFn`, die den Fehler selbst abfängt). Ohne tragfähigen `reason` wird die Objektform abgewiesen. Läuft in Pre-Commit und CI |
| `pnpm check:platform-parity` | Prüft den maschinell fassbaren Teil von §4: Eine Fläche mit `hidden <bp>:*` ohne Gegenstück (`<bp>:hidden`) fehlt auf schmalen Breiten ganz — das ist kein Dichte-Unterschied, sondern ein fehlendes Feature. Legitime Paare über Dateigrenzen stehen mit **Nennung des Partners** in `platform-parity-allowlist.json`. Läuft in Pre-Commit und CI |
| `pnpm check:bundle-size` | Vergleicht die gzip-Grössen aus `dist/assets` gegen `bundle-size-budget.json` (Einzelbudget ab 20 kB, dazu eine Gesamtgrenze über **alle** Bündel). Setzt einen `pnpm build` voraus. Das Budget ist der heutige Stand plus 10 % — es soll Wachstum sichtbar machen, nicht die Vergangenheit verurteilen. Läuft in CI |
| `pnpm check:a11y-names` | Verlangt für jedes `<SelectTrigger>` und jede Schaltfläche, deren einziger Inhalt ein Icon ist, einen zugänglichen Namen (`aria-label`/`aria-labelledby`/`title`). **Ohne Ausnahmeliste** — anders als die übrigen Wächter, weil ein namenloses Bedienelement mit Screenreader schlicht nicht bedienbar ist. Läuft in Pre-Commit und CI |
| `pnpm check:state-coverage` | Verlangt je Fläche einen Test zum **Leer-** und zum **Fehlerzustand**. Die Zeilenabdeckung beantwortet das nicht: Sie lag bei 71 %, und `/debts` behauptete nach einem Lesefehler trotzdem „Noch keine Schulden" — es gab Tests, sie waren grün, und sie prüften, DASS gerendert wird, nicht WAS behauptet wird. Angemeldet wird ein Zustand über einen Tag im Testtitel: `it('[ZUSTAND /debts:fehler] …')`. Nur ein `it`/`test` zählt, kein `describe` und kein Kommentar. Die Ausnahmeliste `state-coverage-allowlist.json` kennt wie die Query-Liste zwei Formen: **`offen`** ist Backlog und darf nur schrumpfen, **`entfaellt`** ist entschieden und braucht je Zustand einen Grund (Flächen ohne Bestand, etwa `/settings`). Läuft in Pre-Commit und CI |
| `pnpm check:store-serialization` | Verlangt, dass eine Funktion, die eine lokale Collection **liest, ändert und zurückschreibt**, den Ablauf serialisiert. Zwischen Lesen und Schreiben liegt ein echtes `await` (IndexedDB, AES-GCM): Zwei gleichzeitige Aufrufe lesen denselben Stand, und der zweite schreibt eine Fassung ohne das Element des ersten — lautlos, ohne Fehler, ohne Log. #293 hat das an einer verlorenen **Einstellung** bemerkt; nachgemessen stand dieselbe Sequenz an **27 Stellen in 12 Dateien**, und dort verliert sie eine **Buchung**. Eine verlorene Einstellung fällt beim nächsten Öffnen des Dialogs auf; eine verlorene Buchung hinterlässt keine Lücke, nach der jemand sucht, und verfälscht ab dann jede Summe. Ersatz ist `mutateLocalFinanceList(key, (items) => …)` (`@/services/local-finance-store`) bzw. `withKeyLock` (`@/lib/key-mutex`) für Kategorien, Einstellungen und den Chunk-Index. **Wichtig:** Prüfungen, die eine Dublette verhindern sollen, gehören INNERHALB des Locks — davor sind sie Zierde, weil zwei gleichzeitige Aufrufe beide an ihnen vorbeikommen. Gemeldet wird die innerste Funktion; reines Lesen (`getX`) und reines Ersetzen der ganzen Liste (`replaceX`) sind ausdrücklich in Ordnung. **Ohne Ausnahmeliste** — wie `check:a11y-names`: Ein begründeter Einzelfall hiesse hier „an dieser Stelle darf gelegentlich eine Buchung verloren gehen". Die Erkennung steht in `store-serialization-core.mjs` (TypeScript-AST) und ist ohne Dateisystem testbar. Läuft in Pre-Commit und CI |
| `pnpm check:money-format` | Meldet gerenderte **Geldbeträge, die den Sanften Modus umgehen** — ein `<formatierer>.format(betrag)` aus einem Währungs-`Intl`, dessen Ergebnis nicht durch `mask()` läuft. Der Sanfte Modus (`docs/debt-avoidance-recovery.md`) ist ein Barrierefreiheits-Versprechen an Menschen mit Vermeidungsverhalten: Ein einziger unmaskierter Betrag auf derselben Fläche hebt es auf. **Gemeldet wird der Aufruf, nicht die Deklaration** — und das ist der Kern: `TransactionTable.tsx` hat einen rohen Formatierer und ist trotzdem richtig, weil sie ihn durch `money.mask(…)` schickt. Ein Wächter gegen jedes rohe `Intl` hätte dort Fehlalarm, und Fehlalarme schalten Wächter ab statt sie durchzusetzen. Dieselbe Lehre wie bei der halb übersetzten Zeile in `check:i18n` (WP 6.8): Eine Datei ist nicht erledigt, weil *irgendwo* darin richtig gearbeitet wird. **Importierte Formatierer zählen mit** (`liquidity/chart-shared`, `forecast/forecast-shared` exportieren ihr `eur`) — sonst wäre ausgerechnet die Bauform ausgenommen, die sich am leichtesten ausbreitet. Prozent- und Dezimalformatierer bleiben unangetastet: Eine Sparquote ist kein Betrag. Nicht gesehen wird fertig formatierter Text aus `src/lib/` (dort gibt es keinen React-Kontext) — benannte Grenze. Ersatz ist `useMoneyFormat().format(betrag)` bzw. `money.mask(fmt.format(betrag))`. **Ohne Ausnahmeliste.** Läuft in Pre-Commit und CI |
| `pnpm check:external-endpoints` | Erzwingt die EU-Regel (`docs/architecture/eu-souveraenitaet.md`) — „Eine Anbieterregel ohne Wächter ist eine Absichtserklärung." Prüft **beide Richtungen**: jeder externe Host im Produktivcode steht im [Anbieter-Register](docs/security/anbieter-register.md), **und** jede aktive Registerzeile kommt im Code oder in der CSP vor. Die zweite Richtung ist nicht Zierde: Das Register ist die Faktenbasis für Subprozessoren-Verzeichnis, VVT (Art. 30) und Datenschutztext — eine Zeile, die einen Anbieter führt, den es nicht mehr gibt, ist schlimmer als keine. **Drei Formen von Fundstelle:** die `https://`-**URL**; der **blanke Host**, aber nur wenn die Position ihn ausweist (ein Bezeichner mit `HOST`/`ORIGIN`/`DOMAIN`/`ENDPOINT` — dieselbe Idee wie die Text-Prop bei `check:i18n`); und die **CSP** in `vercel.json`. Die Positionsregel ist gemessen, nicht geraten: Blanke Domain-Erkennung ohne sie meldet jeden i18n-Schlüssel (`accountService.accountTypeLabelCash` besteht jede Hostname-Prüfung), jede Versionsnummer und jede CSS-Einheit — und sie fand umgekehrt `GOCARDLESS_AUTH_HOST_SUFFIXES = ['gocardless.com']`, das über jedes Redirect-Ziel entscheidet und in keiner URL vorkommt. **Nicht gesehen** werden Tests (dort sind fremde Hosts der Zweck — `safe-url.test.ts` beweist mit `gocardless.com.evil.tld`, dass genau der abgelehnt wird), Kommentare (ein Gegenbeispiel ist kein Datenfluss), Binärdateien (eine PNG mit XMP-Metadaten ruft nichts auf) und Bezeichner-URIs (`$schema`, `$id`, `xmlns` benennen einen Namensraum, sie rufen ihn nicht ab) — benannte Grenzen. Reservierte Namen nach RFC 2606/6761 (`.example`, `.test`, `.invalid`, `localhost`) fallen weg. **Ohne Ausnahmeliste**, wie `check:a11y-names`: Ein Eintrag hiesse „dieser Host darf unerklärt bleiben". Abweichungen werden im **Register** korrigiert, nicht im Wächter weggefiltert. Geprüft werden `src/`, `api/`, `supabase/functions/`, **`services/`** (seit WP 6.2 — sonst wäre ausgerechnet der Dienst ausgenommen, der mit dem Zahlungsdienstleister spricht), `public/` und `index.html` — **und seit dem Tesseract-Fund zusätzlich die ausgelieferten Einstiegs- und `dist`-Dateien der DIREKTEN Abhängigkeiten**. Die waren strukturell unsichtbar: Der Wächter liest den git-Index, und `node_modules` steht dort nicht. Ein Host, der ausschliesslich in der Vorgabekonfiguration einer Bibliothek steht, wurde also nie gemeldet — `tesseract.js` lädt Worker, WASM-Kern und Sprachdaten von `cdn.jsdelivr.net`, ohne dass eine Aufrufstelle das nennt. Dass die Registerzeile dafür trotzdem existiert, war Handarbeit aus dem Audit, nicht Wächterleistung. Erkannt wird über eine **Positivliste bekannter Auslieferungs-CDNs**, nicht über jede URL in `node_modules`: Nachgemessen meldet ein breiter Scan über alle 7845 JS-Dateien der 61 direkten Abhängigkeiten auch Dokumentationslinks und Shader-Quellenangaben — und Fehlalarme schalten Wächter ab, statt sie durchzusetzen. Mit der Positivliste, ohne Kommentare und ohne `examples/`, bleiben exakt zwei Treffer, beide echt. Erkennung in `external-endpoints-core.mjs`, ohne Dateisystem testbar. Läuft in Pre-Commit und CI |
| `pnpm check:test-structure` | Prüft Testdatei-Platzierung (`__tests__/`, Ausnahme `src/security/*.security.test.ts`) — läuft in Pre-Commit und CI |
| `pnpm check:layers` | Erzwingt die Import**richtung** aus §3 — beide Schichtungen (`lib → services → hooks → components → pages` und `domain → data → application → presentation`). TypeScript kennt keine Schichten: ein Import nach oben sieht aus wie einer nach unten, und genau so sind 30 umgedrehte Abhängigkeiten in 14 `lib`-Dateien entstanden, ohne dass je etwas rot wurde. Der Auslöser war nie Absicht, sondern **Ort**: ein fachlicher Typ (`ContractRow`, `ForecastOverrides`, `MerchantRule`) oder eine reine Funktion (`explainCategorization`, `normalizeIban`) lag im I/O-Service oder in der Komponente, weil sie dort zuerst gebraucht wurde — wer sie danach von unten brauchte, hatte nur den Weg nach oben. Seit WP 2.3 gilt auch `hooks-ohne-components`: `src/hooks/` darf nicht nach `src/components/`/`src/pages/` greifen — Live-Fund war `useKpiPreferences.ts`, das `KPI_DEFINITIONS` (Fachdaten) aus `components/kpi/kpis.ts` zog (ARCH-4; die Daten liegen seither in `src/lib/kpi-definitions.ts`). Ausnahme: ein Context-Provider-Lesezugriff (`useAuth` aus `AuthProvider`, `useGentleMode` aus `GentleModeProvider`) — dieselbe übliche Bauform wie in „Wohin ein Typ gehört", erkannt über dasselbe `istInfrastruktur()`-Prädikat wie bei `check:view-data`. Der Wächter löst Alias- (`@/…`) **und** Relativpfade auf; Tests sind ausgenommen (ein `lib/__tests__/`-Test darf einen Service heranziehen, das ist seine Absicht). Ausnahmen stehen in `layer-allowlist.json` und brauchen je Datei `imports` **und** `reason` — die Datei ist heute leer und sollte es bleiben. Läuft in Pre-Commit und CI |
| `pnpm check:view-data` | **Ratsche, kein Verbot.** Zählt die Datenzugriffe, die noch IN der Darstellung stehen (`useQuery`/`useMutation` und direkte Service-Importe unter `src/components/`, `src/pages/`). Eine Komponente DARF laut §3 einen Service benutzen — die Richtung stimmt, der Befund ist ein anderer: Solange eine Fläche ihre eigene Datenschicht **ist**, lässt sich keine zweite Präsentation danebenstellen, ohne die Datenbeschaffung ein zweites Mal zu schreiben. Genau das verspricht §4. Der Ausgangswert war **282** (146 Abfragen + 136 Service-Importe in 84 Flächen); die Zahl in `view-data-budget.json` steht heute auf **220** und **darf nur sinken** — Heraufsetzen macht das Versprechen zur Absichtserklärung. Nicht gezählt werden `features/<slice>/application` (dort gehört der Zugriff hin), Tests und Provider/Gates. Läuft in Pre-Commit und CI |
| `pnpm check:slice-presentation` | **Zweite Ratsche neben `check:view-data`, eine andere Fachfrage.** Zählt Importe aus `src/features/<slice>/presentation/` nach der Alt-Oberfläche (`src/components/`, `src/pages/`) — ARCH-3: Der Referenz-Slice `dashboard` importierte `TransactionCharts.tsx` (564 Zeilen) aus `components/dashboard/`, und `check:layers` hatte dafür keine Regel (seit WP 6.2 liegt die Datei in der Slice). Keine harte Regel, weil `plan.md` (WP 2.3) „zwei begründete Allowlist-Einträge" erwartete, der nachgezählte Bestand aber **24 Importe in 10 Dateien** über alle vier Slices mit `presentation/` war (`docs/qualitaet-2026-08/nachpruefung.md` 0.6) — eine harte Regel wäre am ersten Tag rot gewesen und hätte 24 Einzel-Ausnahmen gebraucht. **Nicht gezählt werden seit WP 6.2 die shadcn-Primitive unter `src/components/ui/`**: §7 schreibt `@/components/ui` als *ausschließliche* UI-Quelle vor — eine zweite Präsentation benutzt dieselben Primitive, sie sind nicht die Alt-Oberfläche. Sichtbar wurde das erst, als WP 6.2 die erste Komponente wirklich in eine Slice schob: `TransactionCharts` löst zwei gezählte Importe auf und bringt als Slice-Datei `ui/card`, `ui/switch` und `common/ChartFigure` mit — die Zahl wäre von 24 auf **25 gestiegen**, die Ratsche hätte also genau die Migration verurteilt, für die sie gebaut wurde. `src/components/common/` blieb dagegen gezählt (app-eigene Bausteine). Der WP-2.3-Bestand entspricht nach dieser Zählweise **18** statt 24 (Differenz: sechs `ui/`-Importe); nach WP 6.2 stand die Ratsche bei 17. **Seit WP 6.3 führt das Budget zwei Spalten**, weil die eine Zahl zwei Befunde mit zwei verschiedenen Antworten vermischte — und die Vermischung ausgerechnet die Migration blockiert hätte, für die die Ratsche wirbt (die Trading-Migration hätte sie von 17 auf 48 getrieben, ohne ein Gramm neuer Kopplung: die 31 zusätzlichen Importe sind die per §8/§9 *vorgeschriebenen* Bausteine `InfoStatStrip`, `InteractiveCard`, `DecimalInput`, `EmptyState`/`FinanceErrorState`, die vorher unter `src/components/trading/` lagen, wo der Wächter sie per Definition nicht sah). **`max`** zählt Importe nach **fremder Feature-UI** (Behebung: den betroffenen Screen migrieren; Stand 12), **`maxBausteine`** zählt Importe nach **`src/components/common/`** (Behebung: EIN Umzug für die ganze App nach `features/shared/presentation/`). **WP 6.7 hat diesen Umzug ausgeführt** — 25 Bausteine samt 23 Testdateien, 194 Importstellen in 123 Dateien; `src/components/common/` existiert nicht mehr, `maxBausteine` steht auf **0**. Nicht mitgezogen ist genau eine Datei: `RequireTier` (deprecated Alias auf `FeatureGate`) liegt jetzt als Gate neben dem Gate unter `src/components/RequireTier.tsx` — Begründung im Kopf der Datei. Die Spalte bleibt trotzdem stehen, ab jetzt als Wächter gegen den Rückfall: Ein neuer app-eigener Baustein unter `src/components/common/`, aus einer Slice benutzt, macht sie sofort rot. Genau deshalb wurde die Vollumstellung einem Übergangs-Barrel vorgezogen — ein Re-Export unter dem alten Pfad hätte weiter unter `src/components/common/` gelegen und die Ratsche bei 36 festgehalten. Beide Zahlen **dürfen nur sinken**; nichts ist ausgenommen, nichts verschwindet — die Rechnung steht im Klartext in `slice-presentation-budget.json`. Import-Erkennung wiederverwendet aus `layers-core.mjs` (`resolveTarget`), damit beide Wächter bei Alias- und Relativpfaden dasselbe sehen. Läuft in Pre-Commit und CI |
| `pnpm check:decimal-inputs` | Verbietet `<input type="number">` für **Dezimalfelder**. Im Browser gemessen (Chromium, `de-DE`): getipptes „12,50" ergibt den Wert `"1250"`, „1.200" ergibt `"1.200"` (→ `parseFloat` liest 1,2), ein Zinssatz „5,5" wird zu **55 %**. Der Browser verstümmelt die Eingabe, **bevor** irgendein Parser sie sieht — `parseGermanNumber` repariert das nicht mehr. Ersatz ist `<DecimalInput>` (`@/features/shared/presentation/DecimalInput`); es gibt eine **Zahl** nach außen, keinen Text, damit die Aufrufstelle gar nicht erst falsch parsen kann. Ganzzahlige Felder (Tag im Monat, Anzahl, Jahr) sind mit `type="number"` richtig. Die Ausnahmeliste `decimal-input-allowlist.json` kennt wie die Query-Liste zwei Formen: eine blosse **Zahl** ist offenes Backlog und darf nur sinken, ein Objekt **`{ count, reason }`** ist entschieden. Läuft in Pre-Commit und CI |
| `pnpm check:money-parsing` | Verbietet zwei Dinge, die `docs/coding-guide.md` untersagt, aber real vorkamen (GOV-1): Roh-`parseFloat`/`Number.parseFloat(x.replace(',', '.'))` für einen getippten Geldbetrag — deutsches Format nutzt den Punkt als Tausendertrenner, getipptes „1.200" wird damit lautlos zu 1,2 (`AskYourMoney.tsx` tat das); und `as unknown as` unter `src/` (außer Tests) — hebelt TypeScript vollständig aus und prüft an einer Datengrenze zur Laufzeit nichts (`BankCallbackPage.tsx` ließ so fremde GoCardless-Bankdaten ungeprüft durch). Ersatz: `parseGermanNumber`/`parseEuroInput` (`@/lib/money`) bzw. `parseAtBoundary`/`safeParseAtBoundary` mit einem zod-Schema (`@/lib/schemas`). Ob eine `as unknown as`-Fundstelle eine echte Datengrenze ist, ist nicht maschinell entscheidbar — die Ausnahmeliste `money-parsing-allowlist.json` kennt wie die Dezimal-Liste zwei Formen: eine blosse **Zahl** ist offenes Backlog und darf nur sinken, ein Objekt **`{ count, reason }`** ist entschieden. Läuft in Pre-Commit und CI |
| `pnpm check:card-rule` | Karten-Chrome ohne Interaktions-Signal (§9 „Karten sind Aktionen"). Ausnahmeliste `card-rule-allowlist.json`, heute leer. Läuft in Pre-Commit und CI |
| `pnpm security:secrets` | Secret-Scan (`scripts/security-check.mjs`) |

## 3. Architektur

Zwei komplementäre Schichtungen, siehe `docs/coding-guide.md` §2 im Detail:

- **Klassische Schichten:** `src/lib/` (pure Domänen-/Berechnungslogik, kein
  React, kein I/O) → `src/services/` (I/O: Storage, Supabase, externe APIs,
  kapselt `lib`) → `src/hooks/` (React-Anbindung) → `src/components/` (UI,
  keine Domänentypen/Geschäftslogik) → `src/pages/` (dünne Routen-Einstiege).
- **Feature-Slices:** `src/features/<name>/{domain,data,application,presentation}`
  für in sich geschlossene Features mit Desktop-/Mobile-Präsentation
  (Referenz: `src/features/dashboard/`). Fachlogik, die von **≥ 2 Slices**
  gebraucht wird, wandert nach `src/features/shared/`. Verbindliches
  Kochrezept inkl. Entscheidungsbaum „gemeinsame Komponente vs. getrennte
  Views": `docs/architecture/feature-structure.md`.

Die Richtung ist maschinell erzwungen (`pnpm check:layers`, §2). Feature-`domain`
liegt dabei auf der Höhe von `lib` — ein Service darf sie benutzen, umgekehrt
nicht.

### Rechnen, schließen, prüfen

> **Berechne, was berechenbar ist. Schließe nur, was geschlossen werden muss.
> Prüfe alles, was prüfbar ist.**

Die Regel entscheidet, wo Inferenz überhaupt sitzen darf — und sie ist der
Grund, warum es in diesem Repo **kein** `src/ai/`, keine Runtime-Adapter und
kein Modellmanagement gibt. Drei Ebenen, in dieser Reihenfolge zu prüfen:

| Ebene | Was | Beispiele im Bestand |
|---|---|---|
| **1. Deterministisch** | Regeln sind eindeutig | Kaskade `merchant_rule`/`category_filter`/`regex` · Integer-Cent (`lib/money.ts`) · Budget-, Tilgungs- und Steuermathematik · IBAN-Mod-97 (`lib/iban.ts`) · Restlaufzeit `12 − 3` (`lib/installments.ts`) · Szenario-Absichts-Grammatik (`lib/scenario-intent.ts`: „Auto verkaufen, 5k Urlaub im Dezember" → Delta-Menge, WP-H — der Einstieg des „KI-Bausteins" beginnt bewusst auf dieser Ebene) |
| **2. Statistisch** | Muster über die Zeit | Vertragserkennung über Median, Streuung und Zyklus (`lib/contract-derivation.ts`) · Ausreißer · Prognose |
| **3. Lernend** | Bedeutung muss gedeutet werden | Complement Naive Bayes aus den **eigenen bestätigten** Buchungen (`lib/category-model.ts`) · Auflösung abstrakter Begriffe (`lib/question-category-resolution.ts`) · Frage-Router-Stufe 2 aus kuratierten Paraphrasen + bestätigten Zuordnungen (`lib/question-intent-model.ts`, Ratsche: 99 % richtig-oder-Rückfrage auf ungesehenen Fragen) |

Eine Aufgabe wandert nur dann eine Ebene höher, wenn die darunter sie
nachweislich nicht löst. Ein wiederkehrendes Abo per Zeitreihe zu erkennen ist
schneller, billiger und reproduzierbar; es einem Modell zu überlassen wäre
keines davon.

**Was geschlossen wurde, wird geprüft.** Ebene 2 und 3 liefern nie ein
Ergebnis ohne Beleg und nie eine Zahl ohne Rückweg: `CategorizationResult`
trägt `confidence` und `reasons[]`, das Abfrage-Register trägt `begruendung`
und einen Deep-Link auf genau die Menge, aus der die Zahl entstand. Wo eine
zweite, unabhängig gelesene Größe existiert, entscheidet sie — beim Beleg
halten Zeilensumme und Gesamtbetrag einander stand
(`services/receipt-parser-service.ts`), und eine Korrektur zählt nur, wenn sie
den Widerspruch auflöst **und** die einzige ist, die das tut.

**Der Chat schreibt nie aus eigener Deutung.** Seit WP-I kann die Chat-Fläche
Budgets anlegen, ändern und löschen — aber die Deutung selbst darf nichts
verändern: Grammatik (`lib/budget-action-intent.ts`) und Vorschau
(Registereintrag `budget.aktion`) sind rein, geschrieben wird ausschliesslich
im Bestätigen-Klick (`use-budget-action.ts`), und jede ausgeführte Aktion
bleibt über einen Schnappschuss zurücknehmbar. Das Imperativ-Gate der
Grammatik trägt dieselbe Last wie das Szenario-Gate beim Lesen: Eine FRAGE
darf nie als Befehl gedeutet werden — eine falsch beantwortete Frage zeigt
eine falsche Zahl, ein falsch gedeuteter Befehl schlägt eine Schreiboperation
vor.

**Ein Gate gehört an JEDE Stufe, die es umgehen könnte.** Das Szenario-Gate
(hypothetische Fragen erreichen nur die Simulation) lag ab WP-F an der
Wortebene — und der Klassifikator der Stufe 2 kannte es nicht. Gemessen bekam
„was wenn ich Freizeit um 200 reduzier …" dadurch `budget.aktion` angeboten,
also eine Schreib-Vorschau als Antwort auf ein Gedankenspiel. Wer eine zweite
Stufe vor eine Entscheidung setzt, prüft deshalb jede Schranke der ersten
darauf, ob sie auch dort gilt; ein Vokabel-Feinschliff hätte den Fund bloss
verschoben.

**Ein Auslöser aus lauter Funktionswörtern ist keiner — auch als Phrase
nicht.** Die Regel galt bis Welle 2 nur für das einzelne Wort, und deshalb
stand „noch für" als Auslöser eines Budget-Eintrags im Sprachbaum und fing
„wie viel muss ich noch fürs Finanzamt zurücklegen" ab. Der Preis der Regel
ist benannt: Das englische „what if i" trägt sehr wohl Absicht und ist
stattdessen aus der Auslöser-Liste gestrichen, weil `SZENARIO_SIGNALE` es
ohnehin erkennt.

**Ein deklarierter Datenbedarf, den niemand erfüllt, ist schlimmer als
keiner.** `allocations` stand ab WP-C in `DataNeed`, vier Budget-Einträge
forderten es an, geladen hat es niemand — und weil die Einträge auf eine leere
Menge zurückfielen, zählte eine gesplittete Buchung mit ihrem VOLLEN Betrag.
Lautlos, ohne Fehler, kein Test rot. Seither gilt: `undefined` heisst „nicht
geladen", nie „leer"; die `application`-Schicht füllt jeden Kanal, den ein
Eintrag anmeldet, und eine Quelle, die nicht lesbar war, wird BENANNT.

**Ein schreibender Eintrag ist AUSSCHLIESSLICH über seine eigene Grammatik
erreichbar.** Das Imperativ-Gate sitzt dort — jeder andere Weg zu ihm umgeht
es. Gemessen hat der Welle-5-Korpus gleich zwei solche Wege gefunden: die
Wortebene holte `kategorie.aktion` über den Auslöser „ordne" herein, obwohl
das Gate die Frage „Wie ordne ich Rewe zu Lebensmitteln?" korrekt abgewiesen
hatte, und der Klassifikator der Stufe 2 konnte einen Befehl ohne jede
Prüfung vorschlagen. Beide Male: eine Schreib-Vorschau als Antwort auf eine
Frage. Wer eine Aktion baut, sperrt sie an JEDER Stufe, die sie sonst
erreichen könnte — und ihre Paraphrasen entfallen damit, statt die übrigen
Klassen zu verdünnen.

**Ein Gate schützt nicht eine FUNKTION, sondern vor einer Verwechslung.** Das
Szenario-Gate hiess bis Welle 3 „nur die Simulation darf hypothetische Fragen
nehmen" — zu eng: `schulden.sondertilgung` rechnet die veränderte Welt
ebenfalls, nur deterministisch, und fiel deshalb durch. Wer ein Gate
formuliert, benennt die VERWECHSLUNG, die es verhindert (hier: eine
Bestandsauswertung, die eine Frage über eine andere Welt mit Ist-Zahlen
beantwortet), nicht die Funktion, die zufällig heute als einzige die
Bedingung erfüllt.

**Eine Datengrundlage ohne Erzeuger ist keine.** Der Depot-Zahlungsstrom war
vollständig gebaut — Typ, Collection, verschlüsselt, im Backup, im Chat
ausgewertet, mit neun Tests auf der Rechnung. Nur konnte ihn niemand
ERFASSEN, und damit fiel die Rendite für jeden Nutzer in ihren
„keine Zahlungen"-Zweig. Alle Prüfungen waren grün, weil sie die Rechnung
prüfen und nicht den Weg zu ihren Daten. Wer eine Collection anlegt, baut im
selben Zug die Stelle, an der sie entsteht — oder benennt ausdrücklich, wer
sie später füllt.

**Eine Ratsche steht auf dem GEMESSENEN Stand, nicht darunter.** Zwei der
fünf Router-Ratschen standen auf 0.8, während sie 1.0 maßen: Zwanzig
Prozentpunkte Verfall wären grün durchgegangen, und die PR-Texte behaupteten
derweil „100 %". Eine Schwelle unter dem Stand misst nichts — sie
dokumentiert nur, dass jemand einmal vorsichtig war.

**Eine neue Datengrundlage wird erst gebaut, wenn die Frage sie WIRKLICH
braucht.** Welle 4 sollte laut Aufriss vier Grundlagen bauen; eine davon war
keine. „Wie viel muss ich monatlich für die Jahresrechnungen zurücklegen?"
liess sich aus dem Bestand rechnen — die Vertragsableitung kennt
`Vierteljährlich`, `Halbjährlich`, `Jährlich`, und `yearlyEquivalent` rechnet
sie um. Ein zweites Sparziel-Modell neben `SinkingFund` wäre genau der
Doppelbestand, gegen den dieses Programm viermal reine Funktionen aus
Diensten gezogen hat. Die Prüfreihenfolge ist dieselbe wie bei den Ebenen:
erst rechnen, dann schliessen, und ein neues Datenmodell zuletzt.

**Ein manuell gepflegter Wert braucht seinen Stichtag.** Eine drei Jahre alte
Fahrzeugschätzung als heutigen Wert auszugeben ist dieselbe stille
Falschaussage wie ein Kontostand ohne Anker. Wo ein Mensch eine Zahl schätzt,
gehört das Datum der Schätzung zur Zahl — und die Fläche sagt, wenn sie alt
ist.

**Eine Kennzahl folgt der gewohnten Konvention, nicht der genaueren.** Der
interne Zinsfuß rechnet mit 365 Tagen wie XIRR in Tabellenkalkulationen; mit
365,25 ergäbe eine Verdopplung über ein Kalenderjahr 100,09 % statt 100 %.
Beides ist vertretbar, aber eine Zahl, die um Zehntelprozent von der
abweicht, die der Nutzer anderswo sieht, kostet mehr Vertrauen, als die
Genauigkeit wert ist.

**Eine Disjunktheits-Regel gilt für die Korpora, die sie LIEST.** Der Grundsatz
„wer auf dem Test trainiert, misst Auswendiglernen" stand seit WP-F als Test —
er verglich die Paraphrasen aber nur mit dem 243er-Bestandskorpus, obwohl es
seit Welle 1 fünf gibt. Nachgemessen standen **18 Paraphrasen wortgleich in den
Wellen-2/3-Korpora**: An diesen Zeilen maßen die Ratschen Wiedererkennung. Nach
der Bereinigung fiel genau eine Musterzeile — die übrigen 17 trug der Router
auch ohne Vorlage, und die eine ist inzwischen deterministisch getragen. Die
Prüfung liest jetzt alle fünf Korpora; wer einen sechsten anlegt, nimmt ihn
dort auf.

**Eine Ratsche, die fällt, NENNT die Zeile.** „97 %" schickt den nächsten Leser
auf die Suche und lässt offen, ob eine Regression vorliegt oder bloß eine
ehrlichere Messung. Die vier Wellen-Ratschen geben die gefallene Frage samt
Zielfamilie in der Fehlermeldung aus — das kostet vier Zeilen und hat in
derselben Sitzung zweimal die Ursache in Minuten statt in Stunden sichtbar
gemacht.

**Eine Invariante prüft nur, was die Fixture füllt.** Das Abfrage-Register hat
eine tragende Zusicherung — genannte Zahl und verlinkte Liste zeigen dieselbe
Menge — und einen generischen Test darüber. Als Welle 2 fünf neue Datenkanäle
öffnete (Vermögen, Depots, Anlässe, Steuer, Konten), blieben sie in der
Fixture leer: Jeder Eintrag darauf fiel in seinen „nichts da"-Zweig und lag
damit ausserhalb JEDER Prüfung. Gemessen betraf das 15 von 61 Einträgen, und
nichts wurde rot — ein Test, der nur den bequemen Zweig erreicht, ist grün aus
demselben Grund, aus dem er nichts wert ist. Wer einen Kanal hinzufügt, füllt
ihn in der Fixture; erzwungen wird das jetzt durch einen Wächter, der jeden
von irgendeinem Eintrag angemeldeten Kanal gegen die Fixture hält.

**Ein unprüfbares Versprechen wird zum Etikett.** Derselbe Fund, eine Ebene
tiefer: `deepLinkArt: 'quelle'` heisst „das ist GENAU die Menge, aus der die
Zahl entstand" — nachrechenbar nur, solange das Ziel eine Buchungsliste ist.
Die Welle-2-Einträge zeigten auf `/accounts`, `/trading`, `/euer`; dort war
der Link zwar die Quelle, aber niemand konnte es nachprüfen. Die Präsentation
hat aus dem Etikett prompt „Aus 2 Buchungen" gemacht, wo zwei KONTEN gezählt
waren. Ein Versprechen, das kein Wächter einlösen kann, wird auf das
zurückgeschnitten, was er prüft — nicht umgekehrt.

**Eine Leer-Regel gilt für das Feld, das sie liest — nicht für die Fläche.**
`anzahl === 0` bedeutet „nichts gefunden", solange `anzahl` Buchungen zählt.
Bei „Wie lange reicht mein Geld?" steht dort bewusst 0, weil die Antwort aus
Saldo und Monatsschnitt entsteht und gar keine Treffermenge hat. Die Fläche
behauptete deshalb „Dazu gibt es keine Buchung", während direkt darunter
Guthaben und Verbrauch ausgewiesen waren — sie widersprach sich selbst.
Dieselbe Bedingung stand zwei Absätze tiefer korrekt an der Zähl-Zeile: Eine
Regel, die an einer von zwei Stellen gilt, ist keine Regel, sondern ein
Zufall.

**Eine Abbruchgrenze ist kein Ergebnis.** `calculatePayoffPlan` läuft
höchstens 600 Monate; decken die Raten die Zinsen nicht, endet sie dort mit
Zahlen ohne Aussagekraft (gemessen: 600 Monate, 399.575.500 € Zinsen). Wer
eine Schleifengrenze einbaut, exportiert sie und prüft die Ausgabe dagegen —
sonst wird aus „ich konnte es nicht rechnen" ein „in 50 Jahren bist du
fertig". Dieselbe Idee wie die Grenzkonstante ohne Prüfstelle weiter oben,
nur andersherum: Diese Grenze WIRKT, und genau deshalb muss ihr Erreichen
sichtbar werden.

**Mehrdeutigkeit ist ein Ergebnis, kein Hindernis.** Wo zwei Deutungen gleich
gut passen, wird zurückgefragt statt geraten — der Matcher tut das, die
Kategorie-Auflösung tut das, die Beleg-Selbstkorrektur tut das. Eine falsche
Zahl ist schlimmer als keine.

**Kein Modellgewicht in der Auslieferung.** `script-src 'self'` verbietet
fremde Gewichte, `bundle-size-budget.json` deckelt eigene. Ein
Klassifikationsziel sind ohnehin die `local-cat-*`-IDs, die der Nutzer selbst
angelegt und in seiner Sprache benannt hat — kein vortrainiertes Modell kennt
sie, und die einzigen Labels dafür liegen auf seinem Gerät. Deshalb wird aus
den eigenen bestätigten Buchungen gelernt, nicht aus einem mitgelieferten Netz.
Ändert sich diese Lage, ist die einzige vorgesehene Naht der
`QuestionMatcher` (Freitext → Kandidaten); `antwort()` inferiert nie.

**Das ViewModel kennt die Oberfläche nicht — auch nicht für einen Typ.**
`features/<slice>/application` darf nicht nach `src/components/` oder
`src/pages/` greifen (Regel `feature-application-ohne-ui`). Daran hängt der
ganze Zweck der Trennung: Wird später eine zweite Präsentation danebengestellt
(Android, anderer Shell), muss das ViewModel unverändert weiterlaufen. Ein
einziges `import type` aus einer Komponentendatei zwingt sonst dazu, die alte
Oberfläche mitzuschleppen. Genau so lag es: `use-etoro-account.ts` holte zwei
Zustandstypen aus `EtoroNewsTab.tsx` und `EtoroDiscoverTab.tsx`, und der
Wächter schwieg, weil seine Regel nur `features/*/presentation` kannte.

### Wohin ein Typ gehört

Der häufigste Weg, die Richtung umzudrehen, ist keine Architektur-Entscheidung,
sondern eine Ablage-Gewohnheit: der Typ landet dort, wo er zuerst gebraucht wird.
Ein `interface` im I/O-Service oder in der Komponente zwingt jeden späteren
Nutzer weiter unten zum Import nach oben.

| Was | Wohin |
|---|---|
| Form persistierter Daten (`ContractDecision`, `MerchantRule`, `TaxYearProfile`) | `src/lib/` — der Service speichert sie, besitzt sie aber nicht |
| Reine Funktion ohne I/O (`explainCategorization`, `normalizeIban`) | `src/lib/`, auch wenn nur ein Service sie heute ruft |
| Typ, den Service **und** Oberfläche brauchen | `src/lib/` |
| Fachlicher Zustand, den **≥ 2 Slices** lesen (`DashboardFilterState`) | `src/features/shared/domain/` |
| Modul, das `localStorage`/IndexedDB/Netz anfasst | `src/services/` — auch wenn es heute in `lib/` liegt |
| Zustandstyp, den ein ViewModel hält (`EtoroNewsFilter`) | `src/features/<slice>/domain/` — nie die Komponentendatei, in der er zuerst gebraucht wurde |
| React-Context-Hook, den auch ein ViewModel liest (`useLocalEncryption`) | `src/hooks/` — der Provider bleibt Komponente, der Lesezugriff nicht |
| Identität des Nutzers (`Identity`, `UserId`) | `src/lib/identity.ts` — **nie** der Anbietertyp (`Session`/`User`). Das IdP-Subject ist ein Anbieterdetail; `userIdFromSubject()` ist die einzige Stelle, die daraus die interne userId macht (heute 1:1). Daran hängt das Versprechen aus WP 7.2: Subject-Wechsel ohne userId-Wechsel, Entitlements bleiben unberührt |

### Was vor der Schleife indiziert wird

Nur **eine** Menge in dieser App wächst unbegrenzt: die Buchungen. Kategorien,
Konten, KPIs und Verträge sind zweistellig — dort ist ein verschachtelter Scan
billiger als der Aufwand, ihn wegzuoptimieren. Laufzeit ist deshalb keine
allgemeine Sorgfaltspflicht, sondern eine Frage an genau eine Stelle:

> **Berührt eine Schleife die Buchungsmenge, wird die Gegenseite VOR der
> Schleife aufbereitet** — als `Map`/`Set` für Nachschlagen, als vorbereitete
> Vergleichsform für wiederholtes Matching.

Der Grund ist nicht die Komplexitätsklasse allein: Die teuerste Operation der
App ist AES-GCM plus IndexedDB-Roundtrip, nicht die CPU-Schleife. Asymptotik
entscheidet, welche Bauform überhaupt in Frage kommt; **die Konstante
entscheidet zwischen den verbleibenden** — die Quartals-Chunks (WP 4.1c) haben
Monats-Chunks bei identischer Klasse rein nach Messung geschlagen. Wer eine
Laufzeit behauptet, misst sie deshalb, statt sie auszurechnen; die Infrastruktur
dafür steht (`@/test-utils/synthetic-transactions`, `*.perf.test.ts`).

Zwei Fallen, die hier schon zugeschlagen haben:

| Falle | Was passiert |
|---|---|
| Index IM Callback statt davor | `explainCategorization` baute seine `byId`-Map je Buchung neu; über einen Import von 10 000 Zeilen war das 10 000-mal derselbe Aufbau. Ersatz: `createCategorizer(categories)` einmal, danach `.explain(tx)` je Buchung |
| Aufbereitung im innersten Vergleich | `matchesKeyword` schrieb bei **jedem** Aufruf beide Seiten klein — bei 200 Kategorien × 3 Filtern × 4 Feldern 2 400-mal je Buchung dasselbe Ergebnis. Ersatz: `prepareKeyword()` einmal je Filter, Buchungstext einmal je Buchung (`matchesPreparedKeyword`) |

Dies ist **bewusst kein Wächter.** Ob `.find()` in einem `.map()` teuer ist,
hängt daran, ob das Array 12 Kategorien oder 40 000 Buchungen enthält — aus der
AST ist das nicht entscheidbar, und ein Wächter mit Fehlalarm wird abgeschaltet
statt durchgesetzt (dieselbe Lehre wie bei `check:money-format`). Die Regel
gehört zum Selbst-Review; abgesichert wird der Einzelfall durch einen Test, der
die **Zugriffe zählt** statt die Uhr zu lesen (Vorbild:
`src/lib/__tests__/categorizer.test.ts`).

Ebenfalls Selbst-Review: **keine Grenzkonstante ohne Prüfstelle.**
`MAX_TRANSACTIONS_LOCAL = 10000` stand jahrelang in `lib/constants.ts` und wurde
nirgends gelesen — sie beruhigte beim Lesen („n ist ja gedeckelt") und schützte
beim Laufen nicht. Entweder die Grenze wird an ihrem Pfad geprüft, oder sie wird
gelöscht.

### Vorentschiedenes zuerst lesen

Für manche Themen liegen Vorüberlegungen bereits schriftlich vor. Sie werden
**vor** der Arbeit daran gelesen, damit getroffene Entscheidungen nicht
versehentlich untergraben und Überlegungen nicht neu erarbeitet werden:

| Thema | Datei |
|---|---|
| Onboarding, Lebenssituationen, Bereichs-Vorauswahl, Einzelunternehmer-Modus | `docs/onboarding-life-situations.md` |
| Tutorial, Freischaltung von Funktionen, behutsame Heranführung | `docs/tutorial-progressive-disclosure.md` |
| Reihenfolge der Tutorial-Kapitel, Datenquellen-Weiche (Datei/Bank/Beispieldaten) | `docs/tutorial-sequence.md` |
| Sanfter Modus, Schulden & Vermeidungsverhalten, Nutzerbefragung, Werbeaussagen | `docs/debt-avoidance-recovery.md` |

## 4. Plattform-Prinzip (verbindlich)

> Mobile = einfaches, sauberes Modell (eine Hauptaussage pro Ansicht,
> progressive Offenlegung, Bottom Sheets). Desktop = dieselben Features, nutzt
> den großen Bildschirm (mehr Information gleichzeitig, Tabellen, Vergleiche).
> JEDES Feature muss in beiden Varianten existieren (Feature-Parität). Gleiche
> Daten, gleiche Berechnungen, gleiches ViewModel — progressive Verzweigung,
> keine doppelten Queries.

## 5. TDD & Teststruktur

Ablauf: **Ziel verstehen → Test schreiben (rot) → minimale Implementierung
(grün) → refactor**. Behobene Bugs bekommen **immer** einen `[REGRESSION]`-Test.

- Tests **nur** in `__tests__/`-Ordnern neben dem Code — einzige Ausnahme:
  `src/security/*.security.test.ts`. Blockierend geprüft durch
  `.claude/hooks/test-structure-check.mjs` (Claude Code) bzw.
  `pnpm check:test-structure` (alle Agenten, Pre-Commit + CI).
- Testtitel deutsch, beschreibend: `it('sollte …')`. Keine `describe('tests')`
  / `it('test 1')`.
- Render-/Hook-Helfer **nur zentral** aus `@/test-utils/render`
  (`renderWithI18n`, `renderWithProviders`, `createHookWrapper`) — keine
  lokalen Kopien pro Datei.
- Tags für besondere Kategorien: `[REGRESSION]` (behobener Bug),
  `[SECURITY]`, `[INTEGRITY]`, `[PRIVACY]`, `[MOBILE]`.
- **Zustands-Tag `[ZUSTAND /route:zustand]`** meldet an, dass dieser Test für
  eine Fläche einen Zustand der Matrix aus §9.1 prüft (`geladen`, `leer`,
  `gefiltert-leer`, `fehler`). Pflicht sind `leer` und `fehler` je Route —
  genau die beiden, die einander zum Verwechseln ähnlich sehen und deshalb
  eine falsche Auskunft erzeugen können. Erzwungen durch
  `pnpm check:state-coverage`.

```typescript
it('[REGRESSION] [ZUSTAND /debts:fehler] sollte den Ladefehler benennen statt „noch keine Schulden"', () => {})
```

**Ein Test je Feature ist das Minimum, aber nicht dasselbe wie „wird rot, wenn
das Feature bricht".** Für Schulden und Vermögen gab es Tests, sie waren grün,
und beide Seiten haben nach einem Lesefehler „du hast noch nichts" behauptet.
Ein Test wird erst dann zum Wächter, wenn er den falschen Zustand vom richtigen
unterscheiden kann — deshalb zählt der Wächter Zustände und nicht Zeilen.

```typescript
// ✅ GUT:
describe('CategoryTwoStepSelect', () => {
  it('sollte Unterkategorien anzeigen wenn Hauptkategorie Kinder hat', () => {})
  it('[REGRESSION] sollte parent_id Migration funktionieren', () => {})
})

// ❌ SCHLECHT:
describe('tests', () => {
  it('test 1', () => {})
})
```

## 6. i18n (verbindlich)

**Kein hardcodierter UI-Text.** Jeder sichtbare String läuft über i18n und
muss in **allen** `SUPPORTED_LOCALES` (aktuell `de`, `en`, `ru` —
definiert in `src/i18n/locale.ts`; die Sprachbäume liegen je Sprache in
`src/i18n/translations/<locale>.ts`, `translations.ts` ist nur noch ein
Barrel für Tests und Typen) vorhanden sein. Klingonisch (`tlh`) steht in
`INACTIVE_LOCALES`: die Übersetzungen bleiben im Baum, die Sprache ist aber
nicht wählbar und **nicht paritätspflichtig**. In Komponenten `useI18n()`
(`t('namespace.key')`), in `src/services/`/`src/lib/`-Modulen (kein React-
Kontext) `serviceT` aus `src/i18n/serviceT.ts`. Komponententests prüfen
**bilingual** (mind. de + en) über `@/test-utils/render`. Durchsetzung
agentenunabhängig via `pnpm check:i18n` (hardcodierte Strings, Pre-Commit + CI)
und `src/i18n/__tests__/locale-parity.test.ts` (Key-Symmetrie). Vollständiger
Workflow inkl. Test-Template, dynamische Strings, neue Sprachen hinzufügen:
`.claude/i18n-workflow.md` + `.claude/templates/i18n-*.template.tsx`.

### Sprachstil (`wording`)

Zweite Achse neben der Sprache: `everyday` (Alltagssprache, **Standard**) und
`technical` (Fachsprache). Der Basisbaum je Sprache in
`translations/<locale>.ts` **ist** die
Fachsprache; `src/i18n/overlays/everyday/<locale>.ts` enthält nur die
Abweichungen. Aufgelöst wird das in `t()` — Aufrufstellen ändern sich nie.
Fehlt ein Overlay-Eintrag, greift der Basistext. Details und Formulierungsregeln:
`src/i18n/wording.ts` und der Kopf von `overlays/everyday/de.ts`.

**Jede Sprache in `SUPPORTED_LOCALES` braucht ein Overlay.** Der Sprachstil ist
ein Barrierefreiheits-Versprechen; eine Sprache ohne Overlay sieht nur die
Fachsprache und hat einen toten Schalter in den Einstellungen — ohne dass
irgendetwas rot wird, denn `overlayFor()` liefert dann still `undefined`.
Erzwungen durch `src/i18n/__tests__/overlay-coverage.test.ts` (Existenz **und**
Mindestumfang, damit ein Feigenblatt-Overlay nicht durchgeht). Der Basisbaum ist
je Sprache eigenständig zu beurteilen: „Fixed costs" ist im Englischen bereits
Alltagssprache und braucht keinen Eintrag, „буфер" im Russischen dagegen ein
technisches Lehnwort — deshalb steht dort „запас", wo Deutsch „Puffer" behält.

```typescript
// ❌ NICHT ERLAUBT:            // ✅ ERFORDERLICH:
<h1>Meine Überschrift</h1>      const { t } = useI18n();
                                 <h1>{t('myFeature.title')}</h1>
```

### Fallen, die hier schon zugeschlagen haben

Alle folgenden Fehler waren **unsichtbar**: kein Test wurde rot, kein Compiler
hat gemeckert. Sie sind jetzt maschinell abgesichert — die Regeln stehen hier,
damit klar ist, *warum* der jeweilige Wächter existiert.

| Falle | Was passiert | Wächter |
|---|---|---|
| `t()` im Initializer einer **Modul-`const`** | Wird EINMAL beim Import aufgelöst; ein Sprachwechsel wirkt nie wieder. Konstante in eine **Funktion** umwandeln | `pnpm check:i18n-module-consts` (TypeScript-AST, ganzbaumig) |
| **Doppelter Namespace** in `translations/<locale>.ts` | Gültiges JavaScript — der spätere gewinnt, der frühere verschwindet lautlos. Im ausgewerteten Objekt ist der Fehler unsichtbar | `tsc` (TS1117) **und** `locale-parity.test.ts` (liest die Quelle) |
| **Vertippter `t()`-Key** | Rendert den rohen Punkt-String. Die Locale-Parität fängt das NICHT — sie prüft die Bäume gegeneinander, nicht die Aufrufstellen | `call-site-keys.test.ts` |
| **Text im Template-Literal** | `` `Schuld „${name}" löschen?` `` — der Wächter suchte nach `"Wort`/`'Wort`, ein Backtick kam darin nicht vor. Unsichtbar war damit ausgerechnet der interpolierte Text, also der, der einen Namen oder Betrag einsetzt | `pnpm check:i18n` (seit WP-12.2) |
| **Text zwischen zwei Tags** | `<span>Verträge</span>` steht in gar keinen Anführungszeichen — der häufigste Fall überhaupt, und er wurde nie angesehen | `pnpm check:i18n` (seit WP-12.2) |
| **Einzelnes Wort** ohne Umlaut | „Aufbewahrung", „Hinweis:", „Verbindungsfehler:" — der Wächter verlangte ein Wort aus der Handliste oder einen Umlaut in **zwei** Wörtern. Ein deutsches Kompositum ist beides nicht | `pnpm check:i18n` (seit WP 6.8, wenn die Position den Text ausweist) |
| **Halb übersetzte Zeile** | `<strong>Hinweis:</strong> {t('…')}` — der Wächter hielt die ganze ZEILE für übersetzt, sobald irgendwo darauf ein `t(` stand. Daneben stand der Rest der Aussage im Klartext | `pnpm check:i18n` (seit WP 6.8: `t()` deckt JSX-Text nie ab) |
| **Erfundener Platzhalter** in einer Übersetzung | Steht wörtlich als `{foo}` auf dem Bildschirm. Umgekehrt darf eine Sprache einen Platzhalter weglassen — Russisch braucht kein `{plural}` | `locale-parity.test.ts` |
| **Rohe Steuerbytes** im Quelltext | `grep` hält die Datei für binär und überspringt sie in jedem Audit | `pnpm security:secrets` |
| Matching über den **Anzeigenamen** statt der ID | Bricht bei Umbenennung und in jeder anderen Sprache. Entitäten immer über die stabile ID adressieren | Review; die historischen Ausnahmen in `lib/category-migrations.ts` (bis WP 6.6 `local-settings-service.ts`) sind als solche kommentiert |

Zwei Arbeitsregeln dazu:

- Nach **jeder** Änderung an einem Sprachbaum unter `src/i18n/translations/`
  sofort `pnpm exec tsc --noEmit` —
  ein doppelter Namespace fällt sonst erst viel später auf.
- Tests, die `serviceT`-gestützten Code anfassen, brauchen **keine** eigene
  Sprachfixierung mehr: `vitest.setup.ts` pinnt `navigator.language` auf `de-DE`.
  Eine explizit gespeicherte Sprache gewinnt weiterhin.

## 7. Tech-Stack-Regeln

- **UI:** ausschließlich shadcn/`@/components/ui`; Styling ausschließlich
  Tailwind-Utility-Klassen (kein Custom-CSS, kein inline `style` außer für
  dynamische Werte).
- **Server-/Async-State:** ausschließlich TanStack Query
  (`useQuery`/`useMutation`). **Kein** Redux/Zustand oder anderer globaler
  State-Manager.
- **I/O-Regel:** Jeglicher Zugriff auf IndexedDB, Supabase oder externe APIs
  läuft ausschließlich über `src/services/`. Komponenten rufen niemals
  direkt einen Client auf, sondern nutzen Service-Funktionen via TanStack
  Query.
- **Charts:** Recharts, immer in `ResponsiveContainer`.
- **Animationen:** Framer Motion / CSS / `requestAnimationFrame` — Baseline
  ist datengetriebener Aufbau (siehe §9).
- **Icons:** ausschließlich `lucide-react`.
- **CSV:** Papaparse.
- **3D:** three.js — ausschließlich in src/features/finance-city/ (WebGL-Stadt); nirgendwo sonst importieren.

## 8. Geld & Domäne

**Eingabe:** Geldbeträge und andere Dezimalzahlen werden über
`<DecimalInput>` erfasst, **nie** über `<input type="number">`. Ein
`type="number"`-Feld macht in einem deutschen Browser aus getipptem „12,50" den
Wert `"1250"` und aus einem Zinssatz „5,5" die Zahl `55` — es verstümmelt die
Eingabe, bevor sie irgendein Parser sieht. Erzwungen durch
`pnpm check:decimal-inputs` (§2).

Beträge intern **immer Integer-Cent** über `src/lib/money.ts`
(`toMinor`/`sumMinor`); nie roher Float-Vergleich, nie `toFixed` für
Berechnungen, nie roher `parseFloat`-Ersatz für Geldeingaben (nur
`parseGermanNumber`/`parseEuroInput`). Aggregation (Einnahmen/Ausgaben/Saldo)
**nur** über `@/lib/analysis-data` (`sumIncome`/`sumExpenses`) — keine
komponenten-lokalen `reduce`-Ketten über Beträge. Datengrenzen (IndexedDB,
Backup, Vault, Import, Netz) werden mit **zod** validiert. Details und die
fachlichen Invarianten: `docs/coding-guide.md`, `docs/domain-invariants.md`.

## 9. Design-Grundregeln

- **Karten sind Aktionen:** Fläche mit Karten-Chrome (Rahmen + Hintergrund +
  Schatten) muss als Ganzes klickbar sein (navigieren, Popup/Sheet/Dialog
  öffnen, auf-/zuklappen). Kein toter Karten-Rahmen um nur einen
  verschachtelten Button. Bausteine: klickbar → `@/features/shared/
  presentation/InteractiveCard`; reines Readout ohne Follow-up →
  `@/features/shared/presentation/InfoGroup`/`InfoStatStrip` (kein
  Rahmen/Schatten).
- **Animations-Baseline:** eigene, datengetriebene Implementierung (SVG /
  Framer Motion / CSS / `requestAnimationFrame` / Recharts) — Lottie ist
  **nicht** Baseline. Visualisierte Daten poppen nicht auf, sie werden
  *aufgebaut* (hochzählen, füllen, wachsen, zeichnen); Farb-/Statuswechsel
  sind schwellwertbewusst. Kein `isAnimationActive={false}` ohne kurze
  Begründung. `prefers-reduced-motion` überall respektieren.
- **Farbe ist nur gültig als Paar.** Wer eine Fläche einfärbt, benutzt das
  zugehörige `*-foreground`-Token (`bg-positive text-positive-foreground`) —
  nie `text-white` oder eine geratene Farbe. Nutzerdaten (Kontofarben,
  Kategoriefarben) werden **nie** als Schriftfarbe verwendet, nur als Rahmen,
  Punkt oder Fläche: Für einen frei gewählten Farbwert kann niemand Lesbarkeit
  garantieren. Alle Tokenpaare müssen 4.5:1 erreichen — in **beiden** Themen
  **und in jedem Skin** (`src/skins/skins.css`), geprüft durch
  `src/lib/__tests__/color-contrast.test.ts`. Ein Skin, der eine Fläche
  umfärbt, muss ihren Vordergrund mit umfärben.
- Vollständige Prinzipien (7 Kernprinzipien + Karten- und Animationsregel im
  Detail): `docs/design-principles.md`.

## 10. Security & Privacy

Verbindliche Regeln je Schwachstellenklasse (Details + ❌/✅-Beispiele in
`docs/security-guidelines.md`), jede mit Wächter-Test in `src/security/`:

1. **child_process:** nie `execSync`/String-Interpolation — immer
   `execFileSync('cmd', [args, '--', file])`.
2. **HTTP-Header:** Web-App über `vercel.json`/`netlify.toml`; neue
   Express-Server → `helmet` zuerst; Serverless-JSON → `nosniff` + `no-store`.
3. **Secrets:** echte Secrets nur `process.env` ohne Fallback; `.env` nie
   committen.
4. **GitHub Actions:** `uses:` nur mit 40-Hex-SHA + Versions-Kommentar;
   `permissions: contents: read` top-level in jeder Workflow-Datei.
5. **Redirects:** externe URLs vor `window.location.href`/`window.open`
   immer durch `isSafeExternalAuthUrl` (`@/lib/safe-url`) prüfen.
6. **Android:** `allowBackup="false"`, keine Klartext-Netzwerkkonfiguration,
   keine neuen exportierten Komponenten ohne Begründung + Test.
7. **Abhängigkeits-Patchstände:** `pnpm-lock.yaml` ohne bekannte Advisories
   (CI: OSV-Scanner). Direkte Abhängigkeit anheben, transitive über
   `pnpm.overrides` — Override-Ziele **immer nach oben begrenzen**
   (`">=1.1.16 <2"`). Ohne kompatiblen Patch: Eintrag in `osv-scanner.toml`
   mit `reason` **und** `ignoreUntil`, nie unbefristet.

Änderungen in diesen Klassen nur mit `[SECURITY]`/`[REGRESSION]`-Test im
selben Commit. Vor jedem Push: `pnpm test:security` und
`pnpm security:secrets` müssen grün sein.

## 11. Commits & PRs

Logische Commits mit den zugehörigen Tests, nicht 100-Zeilen-Sammelcommits.
Commit-Message nennt **Ziel + Test-Abdeckung** (nicht nur „was"). PR-Workflow:
Branch anlegen → Tests schreiben (rot) → implementieren (grün) → pushen → CI
abwarten → Review-Kommentare bearbeiten.

**Supabase Edge Functions (`supabase/functions/**`) deployen nicht
automatisch** — es gibt keinen CI-Schritt dafür (geprüft:
`.github/workflows/*.yml`). Immer wenn ein PR Dateien unter
`supabase/functions/` ändert und gemerged wird, legt der Agent **sofort ein
GitHub-Issue** an („Deployment ausstehend: <function-name> (PR #…)“) mit dem
konkreten `supabase functions deploy <name>`-Befehl, kurzer Begründung und
Link zum PR. Gilt für jeden Merge in diesem Bereich, nicht nur beim ersten
Mal — kein Vorgang wird stillschweigend übersprungen.

### Versionierung: jeder Merge-Meilenstein bekommt Tag + CHANGELOG-Eintrag

**CalVer `JJJJ.M.n`** (Jahr, Monat, laufende Nummer im Monat), Tag mit
`v`-Präfix: `v2026.8.0`. **Eine** Schreibweise überall — die führende Null
(`2026.08.0`) ist nach SemVer §9 unzulässig, npm normalisiert sie still weg,
und zwei Schreibweisen für einen Stand sind genau die Mehrdeutigkeit, die eine
Versionsnummer beseitigen soll. Meilenstein heißt: ein Merge, der für Nutzer
etwas ändert oder einen benennbaren Programmstand abschließt — nicht jeder
Merge.

Ablauf, in dieser Reihenfolge:

1. **Version ziehen** — `package.json` (`version`) und
   `android/app/build.gradle` (`versionName`). `versionCode` wird nicht
   gezählt, sondern **gerechnet**: `JJJJ * 10000 + MM * 100 + n`
   (`2026.8.0` → `20260800`); die Formel steht als Kommentar an Ort und Stelle,
   damit beide Zahlen nicht auseinanderlaufen können.
2. **CHANGELOG** — der `## [Unreleased]`-Block wird zum Versionsblock
   (`## 2026.8.0 — JJJJ-MM-TT`), darüber entsteht ein neuer, leerer
   `[Unreleased]`. Gliederung je Block: **Neu · Behoben · Intern**, sortiert
   nach Nutzer-Sichtbarkeit, keine Commit-Liste.
3. **Tag auf den Merge-Commit auf `main`** — `git tag -a v2026.8.0 -m …` erst
   *nach* dem Merge. Ein Tag auf einem Branch-Stand zeigt auf einen Commit, den
   `main` nach einem Squash oder Rebase nicht mehr enthält.

Der Changelog ist die menschenlesbare Fassung, nicht das Protokoll: was ein
Arbeitspaket im Einzelnen tat, steht im Commit und in `docs/`.

## 12. Automatische Durchsetzung

Pre-Commit (`.githooks/pre-commit`) und CI erzwingen i18n
(`pnpm check:i18n`), eingefrorene Übersetzungen
(`pnpm check:i18n-module-consts`), Teststruktur (`pnpm check:test-structure`), die
Karten-Regel (`pnpm check:card-rule`), die Plattform-Parität
(`pnpm check:platform-parity`), den Fehlerzustand jeder Abfrage
(`pnpm check:query-errors`) die Namen der Bedienelemente
(`pnpm check:a11y-names`), die Zustands-Abdeckung je Fläche
(`pnpm check:state-coverage`), die Serialisierung der Schreibpfade
(`pnpm check:store-serialization`), die Wirksamkeit des Sanften Modus
(`pnpm check:money-format`), die Import-Richtung zwischen den Schichten
(`pnpm check:layers`, seit WP 2.3 inklusive `hooks-ohne-components`), die
Trennung von Ansicht und Daten (`pnpm check:view-data`), die Slice-
Presentation-Ratsche gegen die Alt-Oberfläche
(`pnpm check:slice-presentation`), die Dezimal-Eingabefelder
(`pnpm check:decimal-inputs`), das Geld-Parsing-Verbot
(`pnpm check:money-parsing`) und die EU-Regel für externe Endpunkte
(`pnpm check:external-endpoints`, seit WP 0.8). Claude
Code erhält zusätzlich Live-Hinweise über `.claude/hooks/` (blockierend:
test-structure; advisory: Animations-Baseline, Karten-Klickbarkeit). Andere
Agenten prüfen diese Punkte im Selbst-Review.

Nicht maschinell prüfbar und deshalb ausschließlich Sache des Selbst-Reviews:
die Arbeitsweise-Regel „Absicht vor Auftrag" (siehe oben, vor §1).

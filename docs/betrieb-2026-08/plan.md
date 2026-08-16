# Programm „Produktionsreife & EU-Souveränität" — geltender Arbeitsplan

> **Geltend, bis abgearbeitet.** Grundlage ist das Betriebs-Audit vom
> 2026-08-10 ([`audit.md`](audit.md), Stand `main@b2513b7`) — dort stehen alle
> Belege; Befund-IDs (BTR-S1, BTR-4, …) verweisen dorthin. Die dauerhaften
> Regeln stehen nicht hier, sondern in den ADRs
> [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md) und
> [`supabase-abloesung.md`](../architecture/supabase-abloesung.md) sowie im
> lebenden [`Anbieter-Register`](../security/anbieter-register.md). Nach
> Abschluss wandert dieses Verzeichnis nach `docs/archive/` — ADRs und
> Register bleiben.
>
> **Wo das Programm gerade steht und wie man wieder einsteigt:**
> [`status.md`](status.md). **Programm-Issues:** Epic
> [#308](https://github.com/DBocken/Fintracker/issues/308), Phasen
> [#300](https://github.com/DBocken/Fintracker/issues/300)–[#307](https://github.com/DBocken/Fintracker/issues/307)
> (je Phase unten verlinkt).
>
> **Livegang-Gate (außerhalb dieses Programms):** Öffentlicher Betrieb setzt
> die Behebung von [#292](https://github.com/DBocken/Fintracker/issues/292)
> (Fremdwährungs-Aggregation),
> [#293](https://github.com/DBocken/Fintracker/issues/293) (Lost Update),
> [#296](https://github.com/DBocken/Fintracker/issues/296) (Maskierungslücke)
> und [#298](https://github.com/DBocken/Fintracker/issues/298) (echte
> RLS-Integrationstests) voraus. Dieses Programm plant sie nicht — es
> verweigert nur den Livegang ohne sie.

## Arbeitsregeln für den ausführenden Agenten

1. **`AGENTS.md` zuerst lesen — sie gilt auch gegenüber diesem Plan.**
   „Absicht vor Auftrag": Stimmt ein Beleg nicht mehr, wird das *Ziel* des
   Pakets geprüft, nicht der Wortlaut abgearbeitet. Zeilennummern im Audit
   altern absichtlich.
2. **Ein Arbeitspaket = ein PR.** Logische Commits mit Tests, Commit-Message
   nennt Ziel + Test-Abdeckung (§11). Abhängigkeiten (Kanten unten) sind
   bindend, sonst ist die Reihenfolge innerhalb einer Phase frei.
3. **Jeder PR hakt sein Kästchen in diesem Plan ab** (im selben PR) und
   ergänzt die PR-Nummer. Der Plan ist zugleich Fortschrittsprotokoll.
4. **Definition of Done, global:** alle Wächter grün (`pnpm lint`, `pnpm
   test`, `pnpm exec tsc --noEmit`, `check:*`-Batterie) · neue UI-Texte in
   allen `SUPPORTED_LOCALES` plus everyday-Overlays, bilinguale Tests ·
   `[REGRESSION]` je behobenem Bug, `[SECURITY]` in §10-Klassen im selben
   Commit · TDD: Test zuerst rot.
5. **Modell-Hinweise je Paket:** (H) mechanisch · (S) Standard ·
   (O) Entwurfs-/Entscheidungsarbeit.
6. **Nichts stapeln:** Pakete mit denselben Dateien nacheinander mergen.
7. **[OPS]-Pakete** (Arbeit außerhalb des Repos — Konten, Server, Verträge)
   landen trotzdem als PR: Kästchen abhaken + **Beleg-Datei** unter
   `docs/betrieb-2026-08/belege/` (Konfig-Auszug, Protokoll, Nachweis).
   Jedes [OPS]-Paket trägt ein Pflichtfeld **`Wächter:`** mit genau einem von
   drei Werten: `Skript` (check:*/CI prüft den Zustand fortlaufend) ·
   `wiederkehrende Prüfung` (Intervall + nächster Termin im Anbieter-Register)
   · `einmalig (begründet)`. **Zustandsförmige Akzeptanz („X ist konfiguriert")
   darf nie `einmalig` sein** — ein Beleg beweist ein Ereignis, keinen
   Zustand.
8. **Stehende Regel Datenfluss** (aus der ADR, hier operationalisiert): Jede
   Änderung an dem, was das Gerät verlässt oder wer es empfängt, liefert im
   selben Release: Register-Update + Datenschutztext-Update +
   Wächter-Anpassung (`LOCAL_ONLY_SERVICES`/`CLOUD_EXCEPTION`, CSP,
   `check:external-endpoints`).

## Vorentschiedenes (nicht neu aufrollen)

Nach Einwand-Abwägung entschieden (Betreiber-Vorgaben vom 2026-08-10 und
ADRs); wer abweichen will, braucht neue Fakten:

- **EU-only bei Anbietern und Subdienstleistern** — Taxonomie und
  Ausnahme-Politik in der ADR
  [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md).
- **Supabase: Naht jetzt, Ablösung mittelfristig, ab sofort Neubau-Stopp** —
  [`supabase-abloesung.md`](../architecture/supabase-abloesung.md).
- **Push: inhaltsfrei + austauschbarer Transport; FCM zulässig als reiner
  Transportadapter. Keine Implementierung ohne konkretes Push-Feature** (BTR-7).
- **GitHub bleibt Arbeitsplattform; EU-Spiegel und EU-Artefakte sind Pflicht;
  kein Forgejo-Vollumzug** (BTR-1, WP 3.1).
- **Mollie statt Stripe** — [#306](https://github.com/DBocken/Fintracker/issues/306)
  ersetzt den Plan aus [#52](https://github.com/DBocken/Fintracker/issues/52) (BTR-8).
- **Kein Kubernetes; kein Sentry SaaS; LGTM-Vollausbau nur gegen definierte
  Schwelle** (BTR-2, BTR-4, BTR-5).
- **DR-Übung quartalsweise, nicht monatlich** — Solo-Betrieb ehrlich
  dimensioniert (BTR-10).

## Reihenfolge und Abhängigkeiten

Kein starrer Durchlauf — ein Abhängigkeitsgraph:

```text
Phase 0 → vor allem anderen (Souveränität des Ist-Zustands)
Phase 1 (Release) und Phase 2 (Identity) → unabhängig, parallel möglich
Phase 5 (Native) → hängt an nichts, parallel ab Phase 0
Phase 3 (EU-Standbein) → braucht 0; liefert die Grundlage für 4, 6, 7
Phase 4 (Observability) → braucht 3.4
Phase 6 (Payments) → braucht 2 und 3
Phase 7 (Ablösung) → braucht 2 und 3; 6 vorher empfohlen (Generalprobe)
```

Harte Kanten im Kleinen: 0.8 vor jedem Paket, das externe Hosts ändert ·
2.1 vor 2.2 · 3.2 vor 3.3 vor 3.4 · 3.4 vor 3.5 und vor Phase 4 ·
2.4 vor 7.1 · 7.3 vor jedem Cutover in 7.

---

## Phase 0 — Souveränität des Ist-Zustands (P0) · [#300](https://github.com/DBocken/Fintracker/issues/300)

Bevor irgendein EU-Zielbild entsteht, hören die heutigen Verstöße auf, still
zu sein: US-Datenpfade raus oder benannt, Regionen festgestellt, die EU-Regel
bekommt ihren Wächter.

### - [ ] WP 0.1 · Versionierungspraxis herstellen (BTR-S1) · S
**Ziel:** Ein Release ist ein getaggter, referenzierbarer Stand — als Praxis,
nicht als Regel im Text.
**Vorgehen (Test-First sinngemäß):** 1. `v2026.8.0` annotiert auf den
Merge-Commit des Release-Stands auf `main` setzen und pushen (§11; Kandidat
`b2513b7`, vorher verifizieren, dass CHANGELOG-Block und Stand
zusammengehören). 2. Wächter `check:release-tag` (CI, nur `main`): existiert
für den obersten CHANGELOG-Versionsblock kein passender `v`-Tag, wird der
Lauf rot — oder ein Workflow erzeugt den Tag automatisch aus dem
Version-Bump-Commit; eine der beiden Formen, im PR begründet. 3. §11-Text um
den Wächter ergänzen (Regel und Durchsetzung nennen sich gegenseitig).
**Akzeptanz:** `git ls-remote --tags origin` zeigt `v2026.8.0` · Wächter rot
bei fehlendem Tag nachweislich (Testlauf im PR) · AGENTS.md §11 nennt den
Wächter.

### - [ ] WP 0.2 · Function-Region EU + `netlify.toml` entfernen (BTR-S2, BTR-S8) · H
**Ziel:** Der MCP-Endpunkt läuft nicht mehr in den USA; die tote zweite
Deploy-Konfiguration hört auf zu driften.
**Vorgehen:** 1. `vercel.json`: `"regions": ["fra1"]` ergänzen; im Kommentar
des PR (nicht im JSON) festhalten: pinnt **nur Functions**, statisches CDN
bleibt global — echte Antwort ist WP 3.5. 2. Nach Deploy verifizieren
(`x-vercel-id`-Header beginnt mit `fra1`), Beleg unter `belege/`. 3.
`netlify.toml` löschen (VE-7); `docs/security/security-headers.md` vom
Drift-Absatz bereinigen.
**Akzeptanz:** Region-Beleg liegt vor · `netlify.toml` existiert nicht mehr ·
`security-headers.md` nennt nur noch eine Quelle der Wahrheit.

### - [x] WP 0.3 · [OPS] Supabase-Region feststellen und dokumentieren (BTR-S3) · S
**Ziel:** Der Datenstandort des einzigen Auth-/Cloud-Anbieters ist eine
dokumentierte Tatsache, keine Unbekannte.
**Vorgehen:** 1. Region im Supabase-Dashboard feststellen. 2. Ergebnis ins
Anbieter-Register (Spalte Sitz/Region + Prüfdatum). 3. **Wenn Nicht-EU:**
datierter Entscheidungspunkt im Register (Übergang befristet akzeptieren vs.
Phase 7 vorziehen) — kein stiller Vermerk; Entscheidung des Betreibers
einholen.
**Wächter:** wiederkehrende Prüfung (halbjährlich, Termin im Register).
**Akzeptanz:** Registerzeile Supabase vollständig (Region, AVV-Status,
Prüfdatum) · bei Nicht-EU existiert der Entscheidungseintrag.

**Erledigt.** Beleg: [`belege/wp-0.3-supabase-region.md`](belege/wp-0.3-supabase-region.md)
(Dashboard-Auszug). Primary Database **North EU (Stockholm), `eu-north-1`**,
Projekt-URL deckungsgleich mit Register und `integrations/supabase/client.ts`.
Damit liegt die Datenregion **in der EU**, und der Entscheidungspunkt „Phase 7
vorziehen" ist **nicht** ausgelöst — die Reihenfolge des Programms bleibt.
Registerzeile trägt Region + Prüfdatum (2026-08-16); der **AVV-Status** bleibt
bei WP 0.9. Unberührt bleibt die Jurisdiktionsfrage: Supabase Inc. ist ein
US-Unternehmen, und die ADR hat „EU-Region eines US-Anbieters genügt"
ausdrücklich verworfen (CLOUD Act) — die Region senkt die Dringlichkeit, nicht
die Notwendigkeit der Ablösung.

**Zwei Nebenbefunde aus demselben Auszug** (Details im Beleg): `No backups`
und `No migrations`. Der erste widerlegt die BTR-10-Annahme „Supabase managed
die wenigen Tabellen" — dort liegt die **Auth**, und WP 7.2 braucht sie als
Quelle des ID-erhaltenden Imports. Der zweite: 17 Migrationsdateien im Repo,
kein CI-Schritt wendet sie an. **Betreiber-Entscheidung (2026-08-16):** an
Supabase wird nichts geändert; beide Lücken werden beim EU-Anbieter von
vornherein vermieden und sind als Bauvorgaben in WP 6.2 eingetragen.

### - [ ] WP 0.4 · QR-Code lokal rendern (BTR-S4) · S
**Ziel:** Die Bank-Requisition-URL verlässt das Gerät nicht mehr Richtung
Google — und der QR-Code funktioniert wieder.
**Vorgehen (Test-First):** 1. `[REGRESSION]`-Test: `GoCardlessConnect` rendert
den QR ohne externen Host (kein `chart.googleapis.com` im Markup; Data-URL
oder Canvas). 2. Umbau auf die vorhandene `qrcode`-Dependency
(`toDataURL(requisitionLink)`), Alt-Text/i18n unverändert. 3.
`check:external-endpoints` (WP 0.8) kennt den Host danach als verboten.
**Akzeptanz:** Regressionstest grün · kein Treffer für `chart.googleapis.com`
im `src/`-Baum · QR im Dev-Lauf sichtbar (Beleg-Screenshot im PR genügt).

### - [ ] WP 0.5 · Tesseract-Assets selbst ausliefern (BTR-S5) · S
**Ziel:** OCR funktioniert produktiv — ohne Laufzeit-Downloads von US-CDNs.
**Vorgehen (Test-First):** 1. Test je Service (`ocr-service`,
`letter-ocr-service`): `createWorker` wird mit explizitem `corePath`,
`workerPath`, `langPath` auf eigene, versionierte Assets aufgerufen (beide
Sprachen: `eng`, `deu`). 2. Assets (WASM-Core, traineddata) in den Build
aufnehmen (`public/tesseract/` o. ä.), Versionen gepinnt; Bundle-Budget
(`check:bundle-size`) beachten — traineddata sind groß, ggf. Lazy-Load aus
eigenem Origin statt Einbettung. 3. Prod-Verifikation: OCR-Durchlauf gegen
Preview-Deploy (CSP unverändert streng), Beleg im PR.
**Akzeptanz:** Tests grün · kein Treffer für `jsdelivr`/`projectnaptha` im
Baum · OCR-Beleg gegen strikte CSP.

### - [ ] WP 0.6 · Konfiguration statt Hardcodes (BTR-S6) · S
**Ziel:** Ein Provider- oder Domain-Wechsel ist Konfiguration, keine
Code-Änderung.
**Vorgehen (Test-First):** 1. `live-balance-service.ts` ruft die Function über
den konfigurierten Client/`SUPABASE_URL` auf statt über den Voll-Hardcode
(Regressionstest: kein Literal-Host im Service). 2. Fallbacks in
`client.ts`/`api/mcp/[token].ts` durch fail-fast ersetzen (fehlende Konfig →
benannter Fehler statt stiller Produktions-Default); `.env.example` verliert
die echten Werte zugunsten Platzhaltern + Kommentar. 3. Der bestehende
Wächter `supabase-env.security.test.ts` wird um die neue Erwartung erweitert
(kein URL-Fallback mehr), damit der Zustand hält.
**Akzeptanz:** Wächter erweitert und grün · lokaler Dev-Lauf mit `.env`
funktioniert, ohne `.env` bricht er benannt · kein Produktions-Hardcode
außerhalb der Konfigurationsdateien.

### - [ ] WP 0.7 · Edge-CORS: explizite Allowlist statt `*.vercel.app` (BTR-S7) · S
**Ziel:** Keine fremde Vercel-App darf die Edge Functions aufrufen.
**Vorgehen:** 1. `ALLOWED_ORIGINS` in allen Functions produktiv setzen
(exakte Origins); den Suffix-Default `vercel.app` aus dem Code entfernen oder
hinter eine explizite `ALLOW_PREVIEW`-Konfiguration legen (Deno-Tests der
Functions anpassen — `ownership.ts`-Muster: testbar ohne Deno-Runtime). 2.
Deploy der geänderten Functions nach dem §11-Ritual (bzw. WP 1.3, falls schon
da). 3. Beleg: abgelehnter Request von fremder Origin.
**Akzeptanz:** Suffix-Default im Code entfernt/gekapselt mit Test · Beleg
der Ablehnung · Register nennt die erlaubten Origins.

### - [x] WP 0.8 · Wächter `check:external-endpoints` (BTR-2, EU-Regel) · S/O
**Ziel:** Die EU-Regel hat einen Wächter: Jeder externe Host im Quelltext ist
im Anbieter-Register erklärt — sonst rot. „Ein Versprechen ohne Wächter ist
eine Absichtserklärung."
**Vorgehen (Test-First):** 1. Skript `scripts/check-external-endpoints.mjs`
(+ testbarer Kern analog `i18n-core.mjs`): extrahiert Host-Literale aus
`src/`, `api/`, `supabase/functions/`, `index.html`, `public/` und der CSP in
`vercel.json`; gleicht gegen die maschinenlesbare Host-Liste des Registers ab
(das Register führt je Zeile die Hosts). Findet: unbekannte Hosts,
Register-Einträge ohne Code-Fundstelle (Status ≠ geplant), CSP-Einträge ohne
Registerzeile. 2. Aufnahme in `package.json`, Pre-Commit und CI (Muster der
bestehenden Wächter). 3. Erstlauf muss den Ist-Stand des Registers exakt
bestätigen — Abweichungen werden im Register korrigiert, nicht im Wächter
weggefiltert.
**Akzeptanz:** Wächter in Pre-Commit + CI · absichtlich eingefügter fremder
Host macht ihn nachweislich rot (Testfall) · Erstlauf grün gegen das Register.

**Erledigt.** Der Erstlauf war nicht grün, sondern hat sechs echte Abweichungen
gefunden — alle im Register korrigiert, keine im Wächter weggefiltert:
`gocardless.com` (Redirect-Suffix in `safe-url.ts`, entscheidet über *jedes*
Redirect-Ziel) und `vercel.app` (Origin-Suffix in zwei Edge Functions, lässt
**jede** Vercel-App als Origin zu) sind jetzt als Breite an ihrer jeweiligen
Anbieterzeile dokumentiert; `ausgabentracker.de`/`docs.ausgabentracker.de`
haben eine Zeile unter „Zu entfernen" mit Weg → WP 6.1 (eine Randnotiz ist
keine Registerzeile). Drei Fundstellen waren Fehler des Wächters selbst und
sind als benannte Grenzen behoben: Binärdateien (`background.png` meldete
`trufo.ai` aus XMP-Metadaten), Bezeichner-URIs (`$schema`, `xmlns`) und die
Dateiendungs-Heuristik, die `esm.sh` verwarf, weil `.sh` zugleich ccTLD und
Shell-Endung ist — sie greift seither nur beim blanken Literal, nie hinter
`https://`.

### - [ ] WP 0.9 · [OPS] AVV-Bestand und VVT-Erstfassung (BTR-S11) · O
**Ziel:** Die DSGVO-Grundpflichten stehen auf der Faktenbasis des Registers:
Verträge liegen vor, das Verzeichnis der Verarbeitungstätigkeiten existiert.
**Vorgehen:** 1. Je aktiver Registerzeile mit Personenbezug: AVV/DPA
beschaffen bzw. Nachweis ablegen (Supabase, Vercel inkl. DPF-Status,
GoCardless — dort zugleich die Einstufung Prozessor vs. eigenständiger
Verantwortlicher klären und im Register festhalten). 2. VVT-Erstfassung
(Art. 30) aus dem Register ableiten; Ablage unter `belege/`. 3. Fachkundige
Prüfung der Texte ist ausdrücklich Betreiber-Aufgabe — der Agent liefert
Fakten, keine Rechtsberatung.
**Wächter:** wiederkehrende Prüfung (jährlich + bei jeder Registeränderung;
Termine im Register).
**Akzeptanz:** Je Subprozessor ein AVV-Nachweis oder ein datierter
Offen-Eintrag mit Eskalation · VVT-Erstfassung liegt vor · GoCardless-Einstufung
im Register entschieden.

### - [ ] WP 0.10 · [OPS] Ausstehende Deployments ausführen (BTR-S10) · H
**Ziel:** Der dokumentierte Kompensationsmechanismus (Deployment-Issues) ist
abgearbeitet, nicht nur vorhanden.
**Vorgehen:** `supabase functions deploy` gemäß
[#226](https://github.com/DBocken/Fintracker/issues/226) und
[#282](https://github.com/DBocken/Fintracker/issues/282) (inkl. Migration);
Funktionsprobe; Issues mit Ergebnis schließen.
**Wächter:** einmalig (begründet: WP 1.3 ersetzt das Ritual durch
Automatisierung + `/version`-Abgleich).
**Akzeptanz:** Beide Issues geschlossen mit Deploy-Beleg · Funktionsprobe
dokumentiert.

### - [ ] WP 0.11 · Programm-Hygiene `qualitaet-2026-08` (BTR-S10) · H
**Ziel:** Das abgeschlossene Programm sieht auch abgeschlossen aus; offene
Folgepunkte sind als Issues verlinkt statt nur Prosa.
**Vorgehen:** 1. WP-5.6/5.7-Checkboxen und `status.md` dort auf den belegten
Endstand bringen (Abschlussbericht ist die Quelle). 2. Folgepunkte in
`nachpruefung.md` mit den Issue-Nummern #292–#298 verlinken. 3. Verzeichnis
nach `docs/archive/` verschieben, Archiv-Banner setzen, `docs/README.md`
umtragen (Faustregel dort).
**Akzeptanz:** Verzeichnis unter `docs/archive/` mit Banner · keine offene
Checkbox, die der Abschlussbericht als erledigt führt · Issue-Links gesetzt.

---

## Phase 1 — Release Engineering · [#301](https://github.com/DBocken/Fintracker/issues/301)

### - [ ] WP 1.1 · Release-Runbook als geltende Regel (BTR-1) · O
**Ziel:** Ein Release ist ein beschriebener, wiederholbarer, rückrollbarer
Vorgang — nicht implizites Vercel-Verhalten.
**Vorgehen:** 1. `docs/betrieb.md` (geltend, überlebt das Programm): Ablauf
Version → CHANGELOG → Tag → Deploy → Verifikation → Rollback; heutige
Vercel-Realität ehrlich beschrieben, Zielbild (EU-Host, ab Phase 3) daneben;
Android-`versionCode`-Formel referenziert. 2. Rollback einmal wirklich proben
(Vercel: vorheriges Deployment promoten) und das Protokoll unter `belege/`
ablegen. 3. `docs/README.md`-Registrierung.
**Akzeptanz:** Runbook registriert · Rollback-Probe belegt · §11 verweist auf
das Runbook statt Details zu duplizieren.

### - [ ] WP 1.2 · CI-Artefakt + SBOM (BTR-1) · S
**Ziel:** Jeder `main`-Stand hat ein benanntes, nachbaubares Build-Artefakt
mit Stückliste — GitHub ist nicht mehr die einzige Quelle der Wahrheit über
„was lief".
**Vorgehen:** 1. CI-Job: `pnpm build` → `dist`-Tarball mit
Versions-/SHA-Namen + CycloneDX-SBOM (`@cyclonedx/cyclonedx-npm`) als
Workflow-Artefakt; bei Tags zusätzlich ans GitHub-Release. 2. Hashes
(sha256) im Artefakt-Manifest. 3. Ablage-Ziel EU-Registry folgt in WP 3.1 —
hier nur vorbereitet (Namensschema).
**Akzeptanz:** Artefakt + SBOM je `main`-Lauf abrufbar · Hashes enthalten ·
Namensschema dokumentiert im Runbook.

### - [ ] WP 1.3 · Edge-Function-Deploys automatisieren, §11 anpassen (BTR-1, BTR-S10) · S
**Ziel:** „Deployment ausstehend"-Issues sterben aus: Was gemerged ist, läuft
— nachweisbar.
**Vorgehen:** 1. Workflow (nur `main`, Pfadfilter `supabase/functions/**`):
`supabase functions deploy` via CLI + Access-Token-Secret. 2. Jede Function
bekommt eine `/version`-Antwort (Git-SHA); Post-Deploy-Schritt vergleicht
deployte SHA gegen `main` — Abweichung ist rot. 3. **Im selben PR** AGENTS.md
§11 anpassen: das Issue-Ritual wird durch den Automatik-Absatz ersetzt
(Regel und Wirklichkeit dürfen nicht widersprechen). 4. `[SECURITY]`-Blick:
Token-Scope minimal, SHA-gepinnte Action.
**Akzeptanz:** Merge mit Function-Änderung deployt nachweislich (Beleg:
`/version`-Abgleich) · §11 beschreibt den neuen Weg · kein neues
„Deployment ausstehend"-Issue mehr nötig.

### - [ ] WP 1.4 · Lokale Migrationssicherheit: Backup-vor-Migration + Schrittketten-Test (BTR-9) · S
**Ziel:** Die beiden Restlücken von Vorschlag 9 schließen: Vor strukturellen
Migrationen existiert eine Sicherung; die Schrittkette kann keine Version
auslassen.
**Vorgehen (Test-First):** 1. Test: `runStoreMigrations` legt vor dem ersten
Schritt einen Snapshot an (bestehende `backup-service`-/Snapshot-Mechanik,
lokal, ohne Netz) und räumt ihn nach Erfolg; bei Abbruch bleibt er zugänglich
(UI-Hinweis mit i18n). 2. Test über die Schrittliste: lückenlos von 1 bis
`LOCAL_STORE_SCHEMA_VERSION` (der beim Entfernen des Runtime-Checks
versprochene Ersatz). 3. Verhalten bei vollem Speicher benennen (Quota-Fehler
→ Migration bricht **vor** Datenberührung ab).
**Akzeptanz:** Beide Tests grün · Abbruch-Szenario getestet · kein
Verhaltensbruch für frische Installationen (`fresh-start`-Tests unverändert).

---

## Phase 2 — Identity-Entkopplung (in-Repo) · [#302](https://github.com/DBocken/Fintracker/issues/302)

### - [x] WP 2.1 · `Identity`-Modell mit stabiler userId (BTR-3) · O/S
**Ziel:** Die App kennt eine eigene Identität — das IdP-Subject ist ein
Detail des Anbieters.
**Vorgehen (Test-First):** 1. `src/lib/identity.ts`: `Identity`
(`userId`, optional `email`, `claims`), dazu die Zuordnungsregel
IdP-Subject → interne userId (heute 1:1 Supabase-UUID; die Regel macht den
späteren Issuer-Wechsel zur Zuordnung statt zur Migration). 2. `useAuth()`
liefert `Identity | null` + `status` — die Supabase-Typen `Session`/`User`
verschwinden aus dem Provider-Export. 3. Konsumenten (8 Dateien) umstellen;
Verhalten unverändert (Tests der Konsumenten bleiben grün).
**Akzeptanz:** Kein `import type { Session, User } from
"@supabase/supabase-js"` außerhalb der Naht · Konsumententests grün ·
Zuordnungsregel dokumentiert im ADR-Verweis.

**Erledigt.** `src/lib/identity.ts` trägt `Identity { userId, email?, claims }`
und mit `userIdFromSubject()` die Zuordnungsregel (heute 1:1). Der einzige
`@supabase/supabase-js`-Import unter `src/` steht jetzt in
`integrations/supabase/client.ts` — `AuthProvider` kommt ohne Anbietertypen
aus, weil er strukturell typisiert, was er braucht, statt zu importieren, was
Supabase liefert.

Zwei Befunde am Rand, beide beim Umstellen aufgefallen:

- **`session` las kein einziger Konsument.** Es stand im Kontext und wurde von
  acht `useAuth()`-Stellen nie angefasst. Ein ungenutzter Export ist keine
  Schnittstelle, sondern eine Einladung — er ist mit raus, was die
  Supabase-Fläche zusätzlich verkleinert.
- **Die Anzeigenamen-Auswahl lag doppelt** (`UserQuickProfile`,
  `ProfileDialogContent`), beide Male mit `as string` auf `user_metadata` —
  einem Wert, den der Anbieter liefert und dessen Form niemand zusichert. Sie
  liegt jetzt als `displayNameFromIdentity()` in `lib/` und **prüft**, statt zu
  behaupten. Getestet war sie vorher an keiner Stelle; jetzt durch sechs
  Einheitentests plus einen `[REGRESSION]`-Test an der Oberfläche.

Der Ersatztext („Unbekannter Nutzer") bleibt bewusst in der Komponente: Er ist
Bildschirmtext und gehört über `t()` (§6), nicht in ein lib-Modul ohne
React-Kontext.

### - [ ] WP 2.2 · Eine Naht: `auth-service` kapselt Token, Login, Logout, Deep-Link (BTR-3) · S
**Ziel:** `supabase.auth` existiert nur noch an einer Stelle (plus
Capacitor-Bridge) — der IdP ist austauschbar, bevor er ausgetauscht wird.
**Vorgehen (Test-First):** 1. `auth-service`: `getAccessToken()`
(konsolidiert die 5× `getSession` in `gocardless-service.ts` und die Stellen
in `cloud-mcp-sync-service`/`live-balance-service`), `signInWithOAuth`,
`signOut`, Session-Beobachtung für den Provider. 2. `Login.tsx`,
`LogoutButton.tsx`, `AuthProvider.tsx`, `account-deletion-service.ts` rufen
nur noch den Service. 3. Capacitor-Bridge bleibt eigene Datei, ruft aber
dieselbe Naht (`exchangeCodeForSession` gekapselt).
**Akzeptanz:** `supabase.auth`-Treffer nur noch in `auth-service.ts` +
`integrations/capacitor/auth.ts` (Wächter aus WP 2.3 beweist es) ·
OAuth-Login/-Logout im Dev-Lauf belegt · bestehende Tests grün.

### - [ ] WP 2.3 · Wächter `check:supabase-boundary` + Neubau-Stopp (BTR-3, ADR) · S
**Ziel:** Die Naht hält maschinell: Supabase-Berührung ist eine Ratsche, die
nur sinken darf; Neubau ist rot.
**Vorgehen:** 1. Wächter zählt `@supabase/supabase-js`-/Client-Importe und
`supabase.auth`-Aufrufstellen gegen eine Budget-Datei (Muster
`view-data-budget.json`); Startwert = Stand nach WP 2.2. 2. Neue
Supabase-Tabellen/-Functions erkennt der Wächter über `supabase/migrations/`
+ `supabase/functions/`-Verzeichnisliste gegen eine Bestandsliste
(Neubau-Stopp der ADR; sicherheitsrelevante Fixes am Bestand bleiben frei).
3. Pre-Commit + CI.
**Akzeptanz:** Ratsche grün auf dem Ist-Stand · absichtlicher neuer Import
macht sie nachweislich rot · Budget-Datei mit Klartext-Begründung je Eintrag.

### - [ ] WP 2.4 · IdP-Kriterienkatalog (BTR-3) · O
**Ziel:** Wenn Phase 7 beginnt, ist die IdP-Wahl eine Prüfung gegen
Kriterien, keine Geschmacksfrage.
**Vorgehen:** Katalog als Abschnitt in `docs/betrieb.md` (nicht ADR — vertagt
ist nicht entschieden): **Pflicht:** self-hostbar auf EU-Infra, OIDC/PKCE,
**ID-erhaltender Nutzerimport** (bcrypt-Hashes aus Supabase), Postgres-Backend,
SMTP konfigurierbar (EU-Versender), Betreibbarkeit solo (Update-Kadenz,
Memory-Fußabdruck). **Kandidaten:** ZITADEL, Keycloak, Ory — je kurz gegen
die Kriterien, Entscheidung ausdrücklich offen bis 7.1.
**Akzeptanz:** Katalog registriert · jedes Kriterium nachprüfbar formuliert ·
keine Vorfestlegung.

---

## Phase 3 — EU-Standbein · [#303](https://github.com/DBocken/Fintracker/issues/303)

### - [ ] WP 3.1 · [OPS] Codeberg-Spiegel + EU-Registry (BTR-1, BTR-2) · S
**Ziel:** Quelle und Artefakte existieren in der EU: GitHub-Ausfall oder
-Sperrung stoppt weder Entwicklung noch Wiederherstellung.
**Vorgehen:** 1. Push-Mirror des Repos auf Codeberg (jeder `main`-Push
spiegelt; Workflow oder Mirror-Feature). 2. EU-Container-/Artefakt-Registry
festlegen (Register-Eintrag; Kandidaten: Registry auf eigener VM ab WP 3.2
oder EU-Anbieter) — ab jetzt Ziel für WP-1.2-Artefakte. 3. Restore-Probe: aus
Spiegel + Registry allein einen lauffähigen Stand herstellen, Protokoll unter
`belege/`.
**Wächter:** Skript (CI-Schritt prüft Spiegel-Aktualität: `main`-SHA ==
Mirror-SHA) — nicht `einmalig`.
**Akzeptanz:** Spiegel aktuell (Wächter) · Artefakt in EU-Registry abrufbar ·
Restore-Probe belegt.

### - [ ] WP 3.2 · [OPS] EU-Host: VM, Härtung, Caddy, Compose, IaC light (BTR-2) · S
**Ziel:** Es gibt einen betreibbaren EU-Server nach dokumentiertem Stand —
reproduzierbar, nicht gewachsen.
**Vorgehen:** 1. Anbieter gemäß Register (Empfehlung Hetzner DE; Konto,
2FA). 2. VM per cloud-init/Skript aus dem Repo (Nutzer, SSH-only, ufw,
unattended-upgrades, Docker + Compose, Caddy mit TLS); jede Einstellung als
Datei im Repo (`infra/`), nichts nur im Dashboard. 3. `docs/betrieb.md`:
Zugangs-/Notfallweg (wer, wie, wohin), Update-Routine.
**Wächter:** wiederkehrende Prüfung (monatlicher Patch-/Zustands-Check,
Termin im Register) — zusätzlich Uptime ab WP 3.4.
**Akzeptanz:** VM aus `infra/`-Stand reproduzierbar (Zweitlauf belegt) ·
Härtungs-Checkliste abgehakt · Runbook-Abschnitt vorhanden.

### - [ ] WP 3.3 · [OPS] Backup ab erstem Zustand: restic + Restore-Cron + Dead-Man-Alarm (BTR-10) · S
**Ziel:** Kein eigener zustandsbehafteter Dienst ohne Offsite-Backup beim
EU-Zweitanbieter und ohne automatische Restore-Probe — vom ersten Tag an.
**Vorgehen:** 1. Zweitanbieter-Object-Storage (Register; OVHcloud oder
Scaleway), restic verschlüsselt, tägliche Läufe. 2. Wöchentlicher
Restore-Cron: Restore in Wegwerf-Verzeichnis/-DB + Integritätsprüfung +
Erfolgssignal. 3. Dead-Man-Prinzip: Alarm beim **Ausbleiben** des Signals
(Uptime-Dienst aus WP 3.4 überwacht den Heartbeat).
**Wächter:** Skript (der Restore-Cron selbst) + Dead-Man-Alarm.
**Akzeptanz:** Backup + Restore-Probe laufen nachweislich (zwei Wochen
Signale) · Alarm bei absichtlich unterdrücktem Signal belegt ·
Wiederanlauf-Anleitung im Runbook.

### - [ ] WP 3.4 · Telemetrie-Empfänger als erster Dienst + Uptime vom Zweitstandort (BTR-4) · S
**Ziel:** F-3 wird erfüllt („zuerst der Empfänger"): ein kleiner,
risikoarmer Dienst beweist Deploy, TLS, Backup und Monitoring des EU-Hosts,
bevor irgendetwas Wichtiges dorthin zieht.
**Vorgehen (Test-First):** 1. Minimaler Empfänger (Container auf der VM):
nimmt das bestehende Event-Schema an (zod-Prüfung serverseitig gegen
dieselbe Union — Schema-Duplikation vermeiden: Paket/Datei teilen), schreibt
append-only in Postgres (oder SQLite, im PR begründet), antwortet 204;
Ablehnung alles Unbekannten. Kein Nutzerbezug über das Schema hinaus, IPs
werden nicht persistiert (Beleg im Code + Test). 2. Deploy per Compose aus
WP 3.2; Dienst in WP-3.3-Backup aufgenommen. 3. Uptime-Überwachung
(z. B. Uptime Kuma) auf dem **Zweitanbieter** — damit der Zweitanbieter real
ist, nicht nur Backup-Ziel; überwacht Empfänger + künftige Dienste +
WP-3.3-Heartbeat. 4. `VITE_TELEMETRY_ENDPOINT` bleibt **unkonfiguriert** —
scharf geschaltet wird in Phase 4 (Register + Texte zuerst, stehende Regel).
**Wächter:** Uptime-Alarm + Skript (Empfänger-Tests in CI).
**Akzeptanz:** Empfänger nimmt Schema-Events an, lehnt anderes ab (Tests) ·
läuft hinter TLS mit Uptime-Alarm · im Backup enthalten · Client noch dunkel.

### - [ ] WP 3.5 · Origin-Wechsel: eigene Domain, statisches Hosting, `api/mcp`-Umzug (BTR-2, BTR-S2) · O/S
**Ziel:** Web-App und MCP-Endpunkt laufen unter eigener Domain auf dem
EU-Host; Vercel bleibt nur noch als warmer Rückweg, bis der Schwenk belegt
hält.
**Vorgehen:** 1. **Checkliste vollständig abarbeiten** (jede Stelle mit
Test/Beleg): `src/lib/app-origin.ts` (`PRODUCTION_APP_ORIGIN`),
`safe-url`-Tests, `ALLOWED_ORIGINS`/`ALLOWED_REDIRECT_HOSTS` aller Functions,
CSP (`connect-src`), Supabase-Auth-Redirect-Allowlist, GoCardless-Redirect,
Capacitor-Deep-Link, `check:external-endpoints`-Register-Abgleich. 2.
`api/mcp/[token].ts` als Container-Service portieren; dabei Token-im-Pfad →
Header-Auth (Token in URLs landen in Logs; Migrationspfad für bestehende
Token-Nutzer beschreiben). 3. Statisches Hosting hinter Caddy; Domain-Schwenk
per DNS mit geprobtem Rückweg (TTL kurz, Rollback-Protokoll). 4. Vercel im
Register auf „Übergang, Abschaltung nach Beleg" datieren.
**Akzeptanz:** App + MCP unter eigener Domain hinter strikter CSP · alle
Checklistenpunkte einzeln belegt · DNS-Rückweg geprobt · Register/CSP/Wächter
konsistent (stehende Regel).

---

## Phase 4 — Observability scharf schalten · [#304](https://github.com/DBocken/Fintracker/issues/304)

### - [ ] WP 4.1 · Telemetrie live: Endpoint, Callsites, `render_crash` (BTR-4, BTR-5) · S
**Ziel:** Die gebaute Telemetrie tut ihre Arbeit: Fehler und Web-Vitals
kommen an — hinter Opt-in und Allowlist, wie entschieden (F-1/F-3).
**Vorgehen (Test-First):** 1. `VITE_TELEMETRY_ENDPOINT` auf den
WP-3.4-Empfänger konfigurieren (nur Build-Konfig; der Struktur-Wächter
bleibt unangetastet). 2. Callsites: `screen_view` (Router), `error`
(`ErrorBoundary`/`global-error-handlers` → `kind: 'render_crash'` u. a.),
`performance` (LCP/CLS aus vorhandener Messung), `feature_used` (sparsam,
benannte Features). Jede Callsite nur über `recordTelemetryEvent`;
Flush-Zeitpunkte (Idle/Visibility) mit Test. 3. Fingerprint = `release` +
`errorCode` + `route` — `release` aus Build-Info ins Event (Allowlist
erweitert das Feld, Wächtertest passt mit).
**Akzeptanz:** Events erreichen den Empfänger im Dev-Beleg · alle
Telemetrie-Wächter grün · ohne Opt-in wird nachweislich nichts gesendet
(bestehende Tests decken es).

### - [ ] WP 4.2 · Grenz-Update im selben Release: `CLOUD_EXCEPTION`, Privacy-Texte, CSP (BTR-S9) · S
**Ziel:** Der Versand ist erlaubt, weil die Grenze *neu gezogen und
dokumentiert* wurde — nicht weil ein Test gelockert wurde.
**Vorgehen:** 1. `local-data-boundary.security.test.ts`: Telemetrie-Service
über den vorhandenen `CLOUD_EXCEPTION`-Mechanismus mit Begründung führen
(Fehlerdaten-Versand bleibt für den Error-Log-Service verboten — nur die
Event-Union reist). 2. PrivacyPage/`privacy-status.ts`: Telemetrie-Zustand
erscheint in `sharedWithServer`/`neverShared` korrekt; die
Aufzählung aus BTR-S9 wird vollständig (eToro-Proxy, Markt-Kurse,
Live-Saldo, MCP-Opt-in, Telemetrie-Opt-in). 3. CSP `connect-src` +
Register + `check:external-endpoints` im selben PR (stehende Regel als
gelebter Erstfall). 4. `security-boundaries.md` bekommt den
Telemetrie-Abschnitt (Doku war älter als der Code).
**Akzeptanz:** Wächter grün mit dokumentierter Ausnahme · PrivacyPage
bilingual aktualisiert · Register/CSP/Text in einem PR · Alt-Doku
nachgezogen.

### - [ ] WP 4.3 · Entscheidung: redigierte Stackframes vs. keine (BTR-5) · O
**Ziel:** Die Sourcemap-Frage ist entschieden statt vertagt-für-immer.
**Vorgehen:** Prüfen am realen Bedarf (erste Wochen `render_crash`-Daten):
Reichen `errorCode`+`route` zum Eingrenzen? Wenn nein: Vorschlag
„Top-N-Frames, redigiert durch Allowlist (nur eigene Bundle-Pfade,
keine Query-Strings, keine Nutzerwerte)" als Union-Erweiterung mit
Prüfprotokoll; wenn ja: „Bewusst nicht" im Plan festschreiben. Private
Sourcemaps nur, falls Frames kommen (Upload nur in die eigene Infrastruktur).
**Akzeptanz:** Datierte Entscheidung mit Begründung im Plan · bei Einführung:
Allowlist-Wächter erweitert + Prüfprotokoll.

### - [ ] WP 4.5 · [OPS] Host-Metriken minimal + Ausbau-Schwelle (BTR-4) · H
**Ziel:** Der Server ist beobachtbar, ohne dass ein Observability-Stack zum
eigenen Betriebsprojekt wird.
**Vorgehen:** 1. node_exporter o. ä. + einfache Sicht (auch Uptime-Kuma-
Checks genügen zu Beginn); Log-Rotation. 2. **Ausbau-Schwelle benennen** (im
Runbook): OTel-Collector/LGTM erst, wenn > N Dienste oder erste echte
Debugging-Blindstelle — die Schwelle steht da, damit niemand aus Prinzip
vorbaut. 3. OTLP-Fähigkeit des Empfängers als Option notieren, nicht bauen.
**Wächter:** Uptime-Checks (Skript).
**Akzeptanz:** Metriken/Logs erreichbar · Schwelle dokumentiert · kein
LGTM-Stack deployt.

*(Es gibt bewusst kein WP 4.4: Die Datenfluss-Inventur aus BTR-S9 **ist** der
Text-/Register-Abgleich in WP 4.2 — getrennt wäre sie doppelte Arbeit. Die
Nummer bleibt frei, statt nachzurücken.)*

---

## Phase 5 — Native-Lebenszyklus (parallel ab Phase 0) · [#305](https://github.com/DBocken/Fintracker/issues/305)

### - [ ] WP 5.1 · App-State-Maschine: Background/Resume schützt Schlüssel und Syncs (BTR-6) · S
**Ziel:** Die Android-App verhält sich beim Backgrounding/Resume so bewusst
wie der Web-Tab: Schlüssel-Timer, sauberes Sync-Ende, geprüfter
Wiedereintritt.
**Vorgehen (Test-First):** 1. Zustandslogik in
`src/lib/` (rein, getestet: Zustände `foreground/background/resumed`,
Übergangsregeln) + Capacitor-Anbindung (`App.addListener('appStateChange')`)
in `integrations/capacitor/`. 2. Background: Auto-Lock-Timer der bestehenden
Mechanik starten (`LocalEncryptionProvider`-Pfad wiederverwenden, inkl.
Write-Barrier für laufende Schreibvorgänge); Resume: Lock-Zustand prüfen →
ggf. Unlock-Screen; App-Version geändert → Migrationslauf greift (bestehender
Startpfad). 3. `[SECURITY]`- und `[MOBILE]`-Tests analog der
Autolock-Suite; Verhalten Web unverändert (Regressionstests).
**Akzeptanz:** Tests grün (inkl. Timer-Start beim `appStateChange`, nicht
nur `visibilitychange`) · Web-Verhalten unverändert · manuelle Probe auf
Gerät/Emulator belegt.

### - [ ] WP 5.2 · Android-Release-Konfiguration: applicationId-Entscheid, Signing, Store-Vorbereitung (BTR-6) · O
**Ziel:** Ein Store-fähiger, signierter Build ist ein beschriebener Vorgang;
die permanente `applicationId` ist eine bewusste Entscheidung.
**Vorgehen:** 1. **Zuerst** `applicationId` entscheiden (`de.finanz.copilot`
wird mit Store-Eintritt unumkehrbar; Alternative jetzt oder nie —
Entscheidung mit Begründung ins Runbook, threat-model-Frage damit
geschlossen). 2. Signing-Konfiguration (Keystore außerhalb des Repos,
Anleitung + Verlust-Szenario im Runbook; `minifyEnabled`-Entscheidung mit
Begründung). 3. Store-Vorbereitung [OPS]: Konto, Data-Safety-Formular
**konsistent mit WP 4.2** (Telemetrie-Opt-in deklariert), Screenshots-Plan;
F-Droid-Frage notiert, nicht entschieden.
**Wächter:** einmalig (begründet: Signing/Store sind Ereignisse; die
Data-Safety-Konsistenz hängt an der stehenden Regel).
**Akzeptanz:** applicationId-Entscheid dokumentiert · signierter Build
reproduzierbar nach Anleitung · Data-Safety-Angaben deckungsgleich mit
PrivacyPage.

---

## Phase 6 — Payments & Entitlements (braucht Phase 2 + 3) · [#306](https://github.com/DBocken/Fintracker/issues/306)

### - [ ] WP 6.1 · [OPS] Mollie-Grundlagen: Konto, USt/OSS, Impressum/AGB (BTR-8) · O
**Ziel:** Der kaufmännische Unterbau steht, bevor Code Geld anfasst — Mollie
ist PSP, nicht Merchant of Record.
**Vorgehen:** 1. Mollie-Konto (Register-Eintrag, AVV). 2. USt-Behandlung
digitaler Leistungen klären (OSS-Registrierung ja/nein, Rechnungsstellung) —
fachkundige Prüfung ist Betreiber-Aufgabe, der Agent liefert die
Faktenzusammenstellung. 3. Impressum/AGB/Widerruf für den Verkauf; die
referenzierten, nie deployten Domains (`ausgabentracker.de/privacy`, `/terms`
in `src/lib/constants.ts`) werden real oder aus dem Code entfernt.
**Wächter:** wiederkehrende Prüfung (jährlich, Register).
**Akzeptanz:** Konto + AVV belegt · USt-Entscheid dokumentiert ·
Rechtstexte erreichbar oder Code bereinigt.

### - [ ] WP 6.2 · EntitlementService auf dem EU-Host (BTR-8) · O/S
**Ziel:** Entitlements sind serverseitige, widerrufbare Tatsachen an der
internen userId — nicht länger ein localStorage-String; zugleich die
Generalprobe für Phase 7 (eigener Postgres, JWT-Prüfung, kleine Datenmenge).
**Vorgehen (Test-First):** 1. Dienst (Container, Postgres aus WP 3.2/3.3):
`Entitlement { userId, product, validUntil, source }`; Quellen `mollie`,
`promo`, `admin` (löst den `alphatester`-Hardcode ab). JWT-Validierung via
Supabase-JWKS — **Issuer ist Konfiguration** (Phase 7 tauscht nur diese). 2.
Mollie-Webhook: Signatur geprüft, idempotent (Event-ID-Dedupe), nur
Statusfakten gespeichert — keine Kartendaten, keine Beträge über das
Produkt hinaus. 3. Kein Supabase-Neubau (Wächter WP 2.3 bleibt grün).
**Akzeptanz:** Webhook-Tests (Signatur, Replay/Idempotenz) grün · Dienst im
Backup/Uptime aus Phase 3 · Register + Datenschutztext im selben Release
(stehende Regel).

### - [ ] WP 6.3 · Client-Anbindung: `deriveTier` liest Server-Entitlements (BTR-8) · S
**Ziel:** `FeatureGate`/`RouteGuard` bleiben unverändert — nur die Quelle des
Tiers wird echt.
**Vorgehen (Test-First):** 1. Entitlement-Abfrage über TanStack Query
(Service-Schicht; Offline-Cache mit Ablauf: App bleibt local-first nutzbar,
Premium-Features degradieren benannt statt still). 2. `deriveTier` erweitert:
Server-Entitlement > lokale Override-Mechanik; Demo-/Promo-Pfade bleiben. 3.
Gating-Matrix-/Security-Tests erweitert (manipulierter lokaler Wert schlägt
Server-Fakt nicht).
**Akzeptanz:** Bestehende Gate-Tests grün · neuer Security-Test „lokal
überstimmt Server nicht" · Offline-Verhalten getestet und benannt ·
[#52](https://github.com/DBocken/Fintracker/issues/52) durch
[#306](https://github.com/DBocken/Fintracker/issues/306) ersetzt (Verweis dort).

---

## Phase 7 — Supabase-Ablösung + Server-DR (braucht 2 + 3; 6 empfohlen zuerst) · [#307](https://github.com/DBocken/Fintracker/issues/307)

### - [ ] WP 7.1 · [OPS] IdP-Entscheid, Aufbau, EU-SMTP (BTR-3) · O
**Ziel:** Der self-hosted IdP läuft auf EU-Infrastruktur und kann den
Bestand übernehmen, bevor irgendjemand migriert wird.
**Vorgehen:** 1. Entscheidung gegen den Kriterienkatalog (WP 2.4) — als
neue ADR festgehalten (Kontext/Entscheidung/Verworfen/Preis). 2. Aufbau per
Compose/`infra/`, im Backup + Uptime; EU-SMTP-Anbieter (Register + AVV) für
Auth-Mails. 3. Probelauf: Test-Nutzerkreis, OIDC-Flows (Web + Capacitor
Deep-Link) gegen Staging.
**Wächter:** Skript (Uptime + Backup-Heartbeat wie jeder Dienst).
**Akzeptanz:** ADR liegt vor · Flows belegt (Web + Android) · SMTP im
Register mit AVV.

### - [ ] WP 7.2 · ID-erhaltende Nutzer-Migration (BTR-3) · O/S
**Ziel:** Bestandsnutzer behalten Identität und Zugang — die interne userId
aus Phase 2 zahlt sich aus.
**Vorgehen:** 1. Export aus Supabase (bcrypt-Hashes, E-Mails, IDs),
ID-erhaltender Import in den IdP; OAuth-Google-Konten als Federation
abbilden. 2. Zuordnungsregel aus WP 2.1 anwenden (Subject-Wechsel ohne
userId-Wechsel); Entitlements (Phase 6) bleiben unberührt — Test beweist es.
3. Rollback-Fenster: Supabase-Auth bleibt lesbar, bis der Schwenk belegt hält.
**Akzeptanz:** Testkreis migriert ohne Passwort-Reset (bcrypt) bzw. mit
belegtem Federation-Pfad · Entitlement-Kontinuität getestet ·
Rollback-Protokoll liegt bereit.

### - [ ] WP 7.3 · Löschpfad-Parität vor jedem Cutover (Art. 17) · S
**Ziel:** Konto-Löschung funktioniert im Zielsystem **bevor** Nutzerdaten
dorthin ziehen — Rechte-Kontinuität ist Cutover-Bedingung, nicht Folgearbeit.
**Vorgehen (Test-First):** Nachfolger des `delete-account`-Pfads im
Zielsystem (IdP-Konto, Tabellen, GoCardless-Requisitionen) mit denselben
Garantien; Integrationstest gegen Staging; erst dann dürfen 7.4/7.5
Nutzerdaten bewegen.
**Akzeptanz:** Lösch-Test grün im Zielsystem · Cutover-Checkliste führt
Parität als Gate.

### - [ ] WP 7.4 · Edge-Function-Portierung (BTR-3, BTR-2) · S
**Ziel:** `gocardless-sync` (samt Secrets), `market-quotes`, `etoro-proxy`,
`refresh-balances` laufen als Container-Services auf dem EU-Host — gleiche
Verträge, gleiche Tests.
**Vorgehen:** 1. Portierung mit unverändertem Request/Response-Vertrag
(die Vitest-testbaren Kerne wie `ownership.ts` wandern mit); Secrets in die
Host-Konfiguration. 2. Client-Umschaltung pro Function über Konfiguration
(WP 0.6 zahlt aus); Parallelbetrieb bis Beleg. 3. Rate-Limits übernehmen
(`balance_refresh_limits`-Äquivalent) — Autorisierung siehe 7.5.
**Akzeptanz:** Funktionsparität je Service belegt (Testkreis) · Secrets nur
serverseitig · Supabase-Functions danach abgeschaltet (Register).

### - [ ] WP 7.5 · Datenmigration + Autorisierungs-Äquivalent (BTR-3; Lehre aus #298) · O/S
**Ziel:** Die wenigen Cloud-Tabellen ziehen um, und die
Autorisierungsbehauptung („Nutzer B liest nie Daten von Nutzer A") wird im
Zielsystem **getestet**, nicht nur behauptet.
**Vorgehen:** 1. Migration `mcp_aggregate_snapshots`, Bank-Artefakte,
Entitlements (falls nicht schon dort); Checksummen-Abgleich. 2.
Zwei-Nutzer-Integrationstest gegen das Zielsystem (SELECT/INSERT/UPDATE/
DELETE/Join verboten) + Negativprobe: absichtlich permissive Policy muss den
Test rot machen — dieselbe Messlatte, die #298 für Supabase fordert. 3.
MCP-Token-Modell folgt der WP-3.5-Entscheidung (Header-Auth).
**Akzeptanz:** Datenabgleich belegt · Zwei-Nutzer-Test grün, Negativprobe
nachweislich rot · alte Tabellen leer/abgeschaltet.

### - [ ] WP 7.6 · [OPS] Postgres-WAL + Restore-Verifikation + quartalsweise DR-Übung (BTR-10) · S
**Ziel:** Der Datenbestand überlebt Anbieter-, Server- und Bedienfehler —
und beweist es regelmäßig selbst.
**Vorgehen:** 1. WAL-Archivierung (pgBackRest/wal-g) zum Zweitanbieter,
zusätzlich zu WP-3.3-Snapshots. 2. Restore-Verifikation erweitert:
wöchentlich automatischer Restore in Wegwerf-Instanz + Integritätschecks +
Heartbeat (Dead-Man aus 3.3/3.4). 3. Quartalsweise DR-Übung nach Runbook
(Szenario, Zeitmessung, Protokoll unter `belege/`; erste Übung = der
Phase-7-Cutover selbst zählt nicht — die erste echte folgt ein Quartal
danach).
**Wächter:** Skript (Restore-Cron + Dead-Man) · wiederkehrende Prüfung
(DR-Termine im Register).
**Akzeptanz:** Point-in-Time-Restore belegt · Heartbeat-Alarm getestet ·
erster DR-Termin im Register datiert.

### - [ ] WP 7.7 · Decommission + Großputz (BTR-3, BTR-S9) · S
**Ziel:** Supabase ist weg oder eine befristete, begründete Rest-Ausnahme;
Register, VVT und Datenschutztexte beschreiben die neue Wirklichkeit.
**Vorgehen:** 1. Supabase-Projekt: Datenexport-Beleg, Löschung, Konto-Ende
(oder Rest-Rolle befristet im Register). 2. Register/VVT/PrivacyPage/CSP/
`check:external-endpoints` in einem PR (stehende Regel, letzter Erstfall). 3.
ADR `supabase-abloesung.md` um den Vollzugs-Absatz ergänzen (Datum, Belege).
**Akzeptanz:** Kein Supabase-Host mehr im Wächter-Lauf (oder befristete
Registerzeile) · Texte konsistent · ADR abgeschlossen.

---

## Was dieses Programm bewusst NICHT tut

- **Kein Kubernetes** — zwei, drei Container auf 1–2 VMs mit Compose sind für
  diese Größenordnung der beherrschbare Stand (BTR-2; auch die externe
  Review rät ab).
- **Kein Sentry SaaS, kein Analytics-Drittanbieter** — Crash-Daten reisen als
  eigene Allowlist-Events oder gar nicht (BTR-5).
- **Kein LGTM-/OTel-Vollausbau ab Tag 1** — erst gegen die in WP 4.5
  benannte Schwelle (BTR-4).
- **Keine Push-Implementierung** — nur das ADR-Prinzip; Code erst mit dem
  ersten echten Push-Feature (BTR-7).
- **Kein Forgejo-Vollumzug** — GitHub bleibt Arbeitsplattform, der Spiegel
  ist die Souveränitätsantwort (Betreiber-Entscheidung).
- **Keine privaten Sourcemaps vorerst** — gegenstandslos ohne
  Stackframe-Entscheid (WP 4.3).
- **Keine Bearbeitung von #292/#293/#296/#298** — sie sind das Livegang-Gate,
  nicht Teil dieses Programms (Kopf dieses Plans).
- **Keine Rechtstexte aus Agentenhand** — Faktenbasis ja (Register, VVT-
  Rohfassung), fachkundige Prüfung ist Betreiber-Aufgabe (WP 0.9, 6.1).

## Erfolgskriterium des Gesamtprogramms

1. **Jeder produktive Dienst** läuft bei einem EU-Anbieter oder self-hosted
   auf EU-Infrastruktur; jede Abweichung steht **befristet und begründet** im
   Anbieter-Register.
2. **`check:external-endpoints` ist grün** und beweist damit: kein externer
   Host im Code, der nicht im Register erklärt ist — und keine CSP-Zeile ohne
   Registerzeile.
3. **Ein Release ist ein getaggtes, referenzierbares Artefakt** mit SBOM;
   Rollback ist geprobt und im Runbook beschrieben.
4. **Telemetrie und Crash-Events laufen hinter den Allowlist-Wächtern**, und
   die Datenschutzseite zählt exakt die Serverkontakte auf, die das Register
   führt (BTR-S9 geschlossen, stehende Regel aktiv).
5. **Backups beweisen sich selbst:** automatische Restore-Verifikation mit
   Alarm beim Ausbleiben; DR-Übung quartalsweise mit Protokoll.
6. **Supabase ist abgelöst** oder seine Rest-Rolle steht als befristete,
   begründete Ausnahme im Register (ADR vollzogen).

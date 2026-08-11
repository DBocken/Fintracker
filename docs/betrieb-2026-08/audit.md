# Betriebs-Audit — Protokoll, 2026-08-10

> **Protokoll, keine Regel.** Prüfung der zehn Betriebsvorschläge einer externen
> Architektur-Review („PR 291 Analyse") gegen den Stand `main@b2513b7`
> (Version `2026.8.0`) am 2026-08-10. Zeilennummern und Zählwerte altern
> absichtlich — vor jedem Eingriff neu verifizieren. Die daraus folgende Arbeit
> steht in [`plan.md`](plan.md); die dauerhaften Regeln in den ADRs
> [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md) und
> [`supabase-abloesung.md`](../architecture/supabase-abloesung.md) sowie im
> [`Anbieter-Register`](../security/anbieter-register.md). Programm-Issues:
> Epic [#308](https://github.com/DBocken/Fintracker/issues/308). Nach
> Abschluss des Programms wandert dieses Verzeichnis nach `docs/archive/`.

**Auftrag und Maßstab:** Prüfen, wie die Vorschläge *sinnvoll* umsetzbar sind —
nicht, wie sie wörtlich abzuarbeiten wären (AGENTS.md, „Absicht vor Auftrag").
Verbindliche Vorgabe des Betreibers: **EU-only bei Anbietern und
Subdienstleistern.** Vorab abgefragte Richtungsentscheidungen: Deliverable
dieses Laufs ist Konzept + Programm-Issues (kein Produktcode) · Supabase wird
entkoppelt und mittelfristig abgelöst · Push wird inhaltsfrei mit
austauschbarem Transport festgeschrieben (FCM als reiner Transportadapter
zulässig) · GitHub bleibt, ergänzt um EU-Spiegel und EU-Artefakte.

**Methode:** Drei parallele, nur lesende Analysen (Betriebs-/Anbieteroberfläche,
Code-Stand je Vorschlagsthema, Doku-/Programmkonventionen), anschließend
Gegenprüfung jedes Befunds am Quelltext. Externe Sitz-/Rechtsangaben zu
Anbietern sind Stand heute und tragen im Register ein Prüfdatum.

**Gesamtbild:** Die Review unterschätzt den Bestand an zwei Stellen — der
Migrationsläufer (Vorschlag 9) und die Client-Telemetrie (Vorschlag 4) sind
seit PR #291 im Kern gebaut. Sie überschätzt nirgends: Alle übrigen Lücken sind
real. Zusätzlich fand die Prüfung Sofortbefunde, die die EU-Vorgabe **heute**
verletzen, ohne dass irgendetwas rot ist.

---

## Sofortbefunde (unabhängig von den zehn Vorschlägen)

### BTR-S1 · Null Git-Tags trotz §11-Pflicht und Release `2026.8.0` · **wesentlich**
`git tag -l` ist leer, auch auf `origin`. AGENTS.md §11 Schritt 3 verlangt den
annotierten Tag auf dem Merge-Commit; `CHANGELOG.md:15` nennt `v2026.8.0` als
gegebene Form. Der Release-Prozess existiert als Regel, aber nicht als Praxis —
und kein Wächter bemerkt es (dieselbe Klasse „Versprechen ohne Wächter", die
`qualitaet-2026-08/nachpruefung.md` als Kernlehre benennt). → WP 0.1

### BTR-S2 · Vercel-Function ohne Region: der MCP-Endpunkt läuft in den USA · **blocker (EU-Vorgabe)**
`vercel.json` hat keinen `regions`-Schlüssel; Serverless Functions laufen damit
in Vercels Default-Region (`iad1`, Washington D.C.). Betroffen ist
`api/mcp/[token].ts` — genau der Endpunkt, der Finanz-**Aggregate** ausliefert.
Präzision, damit Phase 0 nicht mehr behauptet, als sie liefert: `regions`
pinnt **nur die Function**; statische Assets liegen weiterhin auf Vercels
globalem Edge-CDN. Die echte Antwort ist der Umzug (WP 3.5), das Pinning ist
Sofortminderung. → WP 0.2

### BTR-S3 · Supabase-Region nirgends dokumentiert · **blocker (Feststellung nötig)**
Kein `supabase/config.toml`, keine Doku, nur die Projekt-Ref
`pbopyawkxxrluhofjtub`. Bereits `docs/archive/codequalitaet-audit-2026-07-02.md:287`
forderte die Dokumentation des EU-Datenstandorts — nie ausgeführt. Liegt das
Projekt in einer US-Region, liegen Auth-Konten und Bank-Sync-Artefakte heute in
den USA; das wäre ein datierter Entscheidungspunkt (Übergang akzeptieren und
befristen vs. Ablösung vorziehen), kein stiller Vermerk. → WP 0.3

### BTR-S4 · Bank-Requisition-URL fließt an Google — und das QR-Feature ist doppelt tot · **blocker**
`src/components/GoCardlessConnect.tsx:205` rendert den QR-Code über
`chart.googleapis.com` mit der GoCardless-Requisition-URL als Query-Parameter —
ein Datenabfluss des sensibelsten Links der Bank-Anbindung an einen
US-Anbieter. Zugleich ist das Feature doppelt defekt: Google hat die
Image-Charts-API abgeschaltet, und die produktive CSP
(`img-src 'self' data: blob:`) blockt den Host ohnehin. Die Behebung ist ein
Bugfix, kein Umbau: die `qrcode`-Bibliothek ist bereits Dependency
(`package.json:89`). → WP 0.4

### BTR-S5 · OCR lädt zur Laufzeit von US-CDNs — und ist in Produktion mutmaßlich defekt · **blocker**
`src/services/ocr-service.ts:155` (`createWorker('eng', …)`) und
`src/services/letter-ocr-service.ts:136` (`createWorker("deu")`) setzen weder
`corePath` noch `langPath`/`workerPath` — Tesseract holt WASM-Core und
Sprachdaten von seinen CDN-Defaults (jsDelivr, tessdata.projectnaptha.com).
Die produktive CSP (`connect-src`/`script-src 'self'`) blockt beides →
Beleg-OCR und Brief-OCR können produktiv nicht funktionieren. Behebung: Assets
versioniert selbst ausliefern (beide Services, beide Sprachen). → WP 0.5

### BTR-S6 · Produktions-URLs und Anon-Key hardcodiert — ein Umzug wäre Code-Änderung statt Konfiguration · **wesentlich**
Vier Stellen: `src/integrations/supabase/client.ts:10` (Fallback),
`api/mcp/[token].ts:18` (Fallback), `.env.example:4` (echte Produktionswerte),
`src/services/live-balance-service.ts:154` (Voll-Hardcode, umgeht sogar den
env-konfigurierbaren Client). Dazu `src/lib/app-origin.ts:10`
(`PRODUCTION_APP_ORIGIN = "https://fintracker-phi.vercel.app"`). Jeder
Provider- oder Domain-Wechsel des Programms stolpert über diese Stellen.
→ WP 0.6; die Origin-Checkliste gehört zu WP 3.5

### BTR-S7 · Edge-Functions default-erlauben jede `*.vercel.app`-Origin · **wesentlich**
`supabase/functions/gocardless-sync/index.ts:20`
(`DEFAULT_ALLOWED_ORIGIN_SUFFIXES = ["vercel.app"]`),
`etoro-proxy/index.ts:34` (`hostname.endsWith(".vercel.app")`),
`delete-account/index.ts:22`, analog `market-quotes`/`refresh-balances`: Ist
`ALLOWED_ORIGINS` nicht gesetzt, darf **jede fremde Vercel-App** die Functions
aufrufen. Preview-Komfort, der in Produktion eine Allowlist sein muss. → WP 0.7

### BTR-S8 · `netlify.toml` — beschlossene, nie ausgeführte Entfernung driftet · **kür**
VE-7 („Vercel produktiv, Netlify entfernen") ist seit dem Audit vom 2026-07-02
entschieden; `docs/security/security-headers.md` dokumentiert die konkrete
CSP-Drift (`worker-src` nur in `vercel.json`). Jede Header-Änderung muss heute
zweimal gemacht werden. → WP 0.2 (miterledigt)

### BTR-S9 · Die Datenschutzseite zählt die Serverkontakte unvollständig auf · **wesentlich**
`src/i18n/translations/de.ts:1979` (privacy.modelLogin): *„Zum Server gehen nur
deine Anmeldung, die Bank-Anbindung (GoCardless-Requisition) und deine
Einstellungen."* Real existieren zusätzlich: der eToro-Proxy (Nutzer-API-Keys
und Portfoliodaten transitieren die eigene Edge Function), `market-quotes`
(Ticker), `refresh-balances` (schreibt `live_balance` in die Cloud-Tabelle
`accounts`) und die Opt-in-MCP-Aggregate. `README.md:8` verlangt: „Code ist
die Quelle der Wahrheit für jeden Privacy-Anspruch." Die Aufzählung muss dem
Register entsprechen — einmal bereinigt und danach durch die stehende Regel
gehalten (jede Datenflussänderung liefert Text + Register + Wächter im selben
Release, ADR). → WP 4.2

### BTR-S10 · Deployment-Rückstand und Programm-Hygiene · **kür**
Zwei offene „Deployment ausstehend"-Issues
([#226](https://github.com/DBocken/Fintracker/issues/226),
[#282](https://github.com/DBocken/Fintracker/issues/282)) — der dokumentierte
Kompensationsmechanismus für fehlendes Edge-Deploy funktioniert, aber niemand
arbeitet ihn ab. `docs/qualitaet-2026-08/` ist trotz Abschlussbericht nicht
archiviert; `plan.md` dort zeigt WP 5.6/5.7 noch offen, `status.md` führt eine
veraltete Pakettabelle; die registrierten Folgepunkte nennen keine
Issue-Nummern (#292–#298 existieren, sind aber nirgends verlinkt). → WP 0.10, WP 0.11

### BTR-S11 · Datenschutz-Grundpflichten: kein DSB nötig, aber VVT fehlt · **wesentlich**
Ein Datenschutzbeauftragter ist nicht erforderlich (Solo-Betrieb, keine
Kerntätigkeit umfangreicher Verarbeitung besonderer Kategorien; Art. 37 DSGVO /
§ 38 BDSG). Ein **Verzeichnis von Verarbeitungstätigkeiten** (Art. 30) ist
dagegen Pflicht — die Verarbeitung (Auth, Bank-Sync) ist nicht „nur
gelegentlich". Es existiert nichts: kein AVV-Bestand, kein VVT, kein
Subprozessoren-Verzeichnis (repo-weit kein Treffer zu „AVV", „Auftragsverarbeitung",
„Subprozessor"). Das Anbieter-Register (dieser Lauf) ist die Faktenbasis;
Prüfung/Abschluss der Verträge ist [OPS]-Arbeit. → WP 0.9

---

## Prüfung der zehn Vorschläge

### BTR-1 · „Aus GitHub/Vercel einen echten Release-Prozess machen" — **übernehmen, gestuft**
**Vorschlag:** Unveränderliche, digest-referenzierte OCI-Images, EU-Registry,
Staging → manuelle Promotion, Rollback per Digest-Wechsel; GitHub darf nicht
die einzige Quelle sein, aus der Produktion wiederherstellbar ist.
**Befund:** Es gibt keinerlei Release-Automation: kein Tag (BTR-S1), kein
benanntes Build-Artefakt, kein SBOM, kein Deploy-Schritt in
`.github/workflows/` (CI prüft und baut, deployt aber nichts); Vercel deployt
implizit über die Git-Integration; Edge Functions deployen von Hand mit
Issue-Ritual (AGENTS.md §11). Die CI-Batterie selbst (Lint, 13 Wächter, tsc,
Tests, Security-Suiten, OSV) ist stark — es fehlt der letzte Schritt, nicht
die Prüfung.
**Bewertung:** Digest-gepinnte Images ohne eigene Registry und ohne eigenen
Host sind Zeremonie. Die sinnvolle Stufung: erst Versionierungspraxis + Artefakt
+ SBOM (auf heutiger Infrastruktur), Container-Bau erst, wenn Registry und
EU-Host existieren (Phase 3).
**Entscheidung:** Übernehmen als Phase 1 (Runbook, Artefakt + SBOM,
Edge-Deploy-Automatisierung samt §11-Anpassung); Container/Digest-Teil nach
Phase 3 verschoben. Spiegel-Pflicht → WP 3.1.

### BTR-2 · EU-Infrastruktur (Hetzner + Zweitanbieter) — **übernehmen; Reihenfolge korrigiert**
**Vorschlag:** Hetzner DE als Primär-Provider, OVHcloud/Scaleway als zweiter
EU-Anbieter; Container + Compose, Caddy/Traefik, OpenTofu; bewusst kein
Kubernetes.
**Befund:** Es gibt heute **keinen** EU-Baustein: Hosting Vercel (US, BTR-S2),
Supabase (US-Unternehmen, Region unbekannt, BTR-S3), keine Container/IaC-Dateien
im Repo.
**Bewertung:** Richtig, inklusive des Kubernetes-Verzichts. Aber die Vorschläge
springen zum Zielbild und überspringen den Ist-Zustand: Bevor ein EU-Standbein
entsteht, müssen die *heutigen* Verstöße weg (Phase 0) — sonst baut man neben
einem undokumentierten US-Betrieb ein EU-Schaufenster. Zwei-Anbieter-Prinzip
wird übernommen, aber nicht als „Backup irgendwann": der Zweitanbieter wird
real, sobald der erste eigene Zustand existiert (WP 3.3, WP 3.4).
**Entscheidung:** Übernehmen als Phase 3 (nach Phase 0); Anbieterwahl im
[Register](../security/anbieter-register.md); Wächter der Regel ist
`check:external-endpoints` (WP 0.8).

### BTR-3 · Auth aus Supabase herauslösen (OIDC, Identity-Typ) — **übernehmen; Naht jetzt, Ablösung später**
**Vorschlag:** Gegen OIDC/eigene `Identity`-Schnittstelle programmieren statt
gegen `supabase.auth`-Interna; mittelfristig self-hosted IdP (die Review nennt
ZITADEL, weist selbst auf dessen US-Muttergesellschaft hin und zieht daraus
die richtige Regel: *Software selbst hosten, nicht deren SaaS konsumieren*).
**Befund:** Teilentkoppelt. Es gibt eine echte Naht
(`src/services/auth-service.ts`: `getCurrentUserId`/`requireUserId`, von 12
Services genutzt), aber kein `Identity`-Modell; `AuthProvider.tsx` exportiert
rohe `@supabase/supabase-js`-Typen (`Session`, `User`) in den React-Kontext;
15 direkte `supabase.auth.*`-Stellen in 8 Dateien, davon allein 5×
`getSession` in `gocardless-service.ts`; UI-Berührung in `Login.tsx`,
`LogoutButton.tsx`, `AuthProvider.tsx`; Capacitor-Deep-Link-Bridge
(`integrations/capacitor/auth.ts`).
**Bewertung:** Exakt richtig, und günstig: Die Naht existiert zur Hälfte. Der
Umbau ist Konsolidierung, kein Neubau. Die IdP-*Wahl* ist heute nicht
entscheidbar (Angebote/Fakten altern — die Review sagt das selbst); was heute
entscheidbar ist: die Anforderungen, allen voran **ID-erhaltender
Nutzerimport** und stabile interne userId ≠ IdP-Subject.
**Entscheidung:** Phase 2 (Identity-Modell, eine Naht, Wächter-Ratsche
`check:supabase-boundary`, Neubau-Stopp per
[ADR](../architecture/supabase-abloesung.md)); IdP-Kriterienkatalog als
WP 2.4, Entscheidung erst in Phase 7.

### BTR-4 · Observability (OpenTelemetry, LGTM-Stack, geschlossene Event-Union) — **Kern ist gebaut; Empfänger zuerst, Vollausbau bei Bedarf**
**Vorschlag:** OTel als Standard, self-hosted Prometheus/Loki/Tempo/Grafana auf
EU-Servern; für die App eine geschlossene Telemetrie-Event-Union mit
Feld-Allowlist („von vornherein nur erlaubte Felder erzeugen").
**Befund:** Der App-Teil **existiert seit PR #291** und ist strenger als der
Vorschlag: geschlossene Union aus 4 Event-Typen ohne Freitext-Payload
(`src/lib/telemetry-events.ts`), Feld-Allowlist + Verbots-Substrings (u. a.
`amount`, `iban`, `payee`), Einzel-Ausgangspunkt mit vier UND-Bedingungen
(`src/services/telemetry-service.ts`), Struktur-Wächter
(`src/security/telemetry.security.test.ts`: genau eine Datei liest
`VITE_TELEMETRY_ENDPOINT`, ohne Fallback), Opt-in default-aus samt
Widerrufs-Semantik. Sie ist **bewusst dunkel**: kein Endpunkt, null produktive
`recordTelemetryEvent`-Aufrufstellen — Entscheidung F-3
(`docs/aaa-plus/decisions/decision-log.md`): „Der Reihenfolge nach zuerst der
Empfänger, dann das Formular", und der Empfänger wurde absichtlich nicht als
Edge Function gebaut, weil die nicht automatisch deployen.
**Bewertung:** Die Review empfiehlt, was schon da ist — der eigentliche Engpass
ist der Empfänger, und der ist der ideale **erste Dienst auf dem EU-Host**:
klein, risikoarm (Queue ist gedeckelt, Versand fire-and-forget), beweist
TLS/Deploy/Backup/Monitoring, bevor irgendetwas Wichtiges umzieht. Ein voller
LGTM-Stack ist für Solo-Betrieb am Tag 1 Zeremonie; OTLP als Format offen zu
halten kostet dagegen nichts.
**Entscheidung:** Empfänger als WP 3.4; scharf schalten (Callsites, Texte,
Wächter-Erweiterung) als Phase 4; Host-Metriken minimal (WP 4.5); LGTM-Ausbau
nur gegen definierte Schwelle („bei Bedarf" steht im Plan, damit es niemand
aus Prinzip vorzieht).

### BTR-5 · Crash Reporting (strukturierte Fehler-Events, kein Sentry SaaS) — **übernehmen als Telemetrie-Pfad, nicht als Produkt**
**Vorschlag:** Fehler-Events mit `release`/`errorCode`/`route`/`platform`/
`traceId`, private Sourcemaps serverseitig, Nutzertexte/Datenobjekte niemals;
kein Sentry SaaS.
**Befund:** Lokal ist Crash-Erfassung reif: Ringpuffer mit Redaktion beim
Schreiben (`src/services/error-log-service.ts`), globale Handler
(`global-error-handlers.ts`), Export nur nutzerinitiiert. Der **Versand ist
heute durch einen Privacy-Test verboten** (`LOCAL_ONLY_SERVICES` in
`src/services/__tests__/local-data-boundary.security.test.ts`) — mit
vorhandenem `CLOUD_EXCEPTION`-Mechanismus für dokumentierte Ausnahmen. Die
Telemetrie-Union hat den Brückentyp bereits (`error` mit `kind:
'render_crash'`), unverdrahtet.
**Bewertung:** Kein zweites System bauen: Das Fehler-Event der bestehenden
Union **ist** das Crash-Reporting; Fingerprint = `release` + `errorCode` +
`route`. Sentry SaaS scheidet aus (US, und unnötig bei dieser Event-Form).
Die Sourcemap-Frage ist ohne Stacktrace im Event gegenstandslos — erst
entscheiden, ob redigierte Top-Frames in die Union dürfen (Allowlist-Erweiterung
mit Prüfprotokoll), sonst bleibt „bewusst nicht".
**Entscheidung:** WP 4.1 (Verdrahtung) + WP 4.2 (Grenz-Update im selben
Release: `CLOUD_EXCEPTION`, Privacy-Texte, CSP) + WP 4.3 (Stackframe- vs.
Sourcemap-Entscheidung, vertagt bis dahin).

### BTR-6 · Native Lifecycle (Foreground/Background/Suspended/Resume) — **übernehmen, parallelisierbar**
**Vorschlag:** Vier Zustände explizit modellieren; beim Background-Wechsel
Key-Timer starten, sensible Caches räumen, laufende Syncs abschließen; beim
Resume Key-Gültigkeit, Netz, App-Version prüfen; als getestete State Machine.
**Befund:** Der Web-Teil existiert und ist gut getestet (Auto-Lock mit
Idle-Timer und optionalem Hidden-Lock inkl. Write-Barrier,
`LocalEncryptionProvider.tsx` + 10 `[SECURITY]`-Tests). **Nativ existiert
nichts:** kein `appStateChange`-Listener — im Android-Wrapper feuert beim
Backgrounding nur bestenfalls `visibilitychange`, und nur wenn der Nutzer die
Option aktiviert hat. Kein Resume-Pfad.
**Bewertung:** Übernehmen, aber auf der vorhandenen Mechanik aufbauen (der
Vorschlag einer eigenen Zustandslogik passt zur Hauskultur; ein
State-Machine-Framework braucht es nicht). Hängt an keiner anderen Phase —
parallel ab Phase 0 machbar.
**Entscheidung:** Phase 5 (WP 5.1 Lifecycle, WP 5.2 Android-Release-Konfiguration
samt `applicationId`-Entscheidung vor jedem Store-Schritt — `de.finanz.copilot`
wird mit Store-Eintritt permanent; klärt zugleich die offene Frage aus
`docs/security/threat-model.md:143`).

### BTR-7 · Push, souverän gedacht — **nur das Prinzip festschreiben, kein Code**
**Vorschlag:** Push trägt nie Inhalte, nur Weck-Events (`eventId`, `type`);
das Gerät holt die Information per authentifiziertem EU-API-Request;
`PushProvider`-Abstraktion (FCM/WebPush/self-hosted).
**Befund:** Push existiert in keiner Form (kein Plugin, keine Permission, kein
Service Worker, keine PWA). Es gibt auch kein Feature im Backlog, das Push
kurzfristig braucht.
**Bewertung:** Das Prinzip ist richtig und muss **vor** dem ersten Push-Feature
verbindlich sein — genau dafür ist die ADR da. Eine `PushProvider`-Abstraktion
heute wäre toter Code (das Repo hat gerade fünf tote Exporte als Issue #297
registriert; denselben Fehler nicht wiederholen).
**Entscheidung:** Prinzip in die ADR (inhaltsfrei; Transport austauschbar; FCM
zulässig als reiner Transportadapter — Push-Token sind personenbezogen, die
Ausnahme steht mit Begründung im Register, sobald sie real wird; UnifiedPush
als zweiter Adapter vorgesehen). Implementierung: erst mit dem ersten
Push-Feature, außerhalb dieses Programms.

### BTR-8 · Payments & Entitlements trennen (Mollie) — **übernehmen; ersetzt den Stripe-Plan #52**
**Vorschlag:** `PaymentProvider → EntitlementService → FeatureAccess`;
Entitlement mit `userId`/`product`/`validUntil`/`source`; Mollie (NL,
DNB-beaufsichtigt) für Web-Käufe; Webhooks signaturgeprüft und idempotent;
Kartendaten nie in eigener Infrastruktur.
**Befund:** Die FeatureAccess-Seite existiert und ist getestet
(`src/lib/tier.ts`: drei Tiers, 13 Feature-Keys; `FeatureGate`, `RouteGuard`,
Gating-Matrix-Tests). Die Entitlement-*Quelle* ist ein localStorage-Override
plus Hardcode-Code `alphatester` — `docs/security-boundaries.md` nennt das
selbst „kein belastbarer Zahlungsnachweis". Zahlungsintegration: keine.
[#52](https://github.com/DBocken/Fintracker/issues/52) plant **Stripe** —
US-Anbieter, kollidiert mit der EU-Vorgabe.
**Bewertung:** Architekturvorschlag exakt richtig und anschlussfähig: Der
EntitlementService bindet an die **interne userId aus Phase 2** (nicht an das
IdP-Subject), validiert Supabase-JWTs zunächst via JWKS und tauscht in
Phase 7 nur den Issuer — so wird Phase 6 zugleich die Generalprobe für den
EU-Host-Postgres. Mollie ist PSP, nicht Merchant of Record: OSS/USt,
Impressum/AGB sind eigene Akzeptanzkriterien, keine Fußnoten. Google Play
Billing wird erst mit Store-Distribution relevant und dann als eigene,
dokumentierte Entscheidung geführt.
**Entscheidung:** Phase 6 (braucht Phase 2 + 3); neues Issue ersetzt #52
(Mollie statt Stripe), verlinkt im Plan.

### BTR-9 · Updates & Datenmigrationen — **im Kern bereits erledigt (PR #291); zwei Restlücken**
**Vorschlag:** Versionierte Migrationskette v7→v8→v9, App unterstützt
Schema N/N-1, jede Migration Backup → Validate → Migrate → Validate → Commit,
bei Fehler bleibt das Original.
**Befund:** Der Läufer existiert (`src/services/local-store-migrations.ts` +
`src/lib/store-compatibility.ts`): nummerierte Schritte,
Version-nach-jedem-Schritt (Crash lässt lesbaren Stand zurück),
Refuse-bei-neuer (`StoreVersionTooNewError` — die geforderte
N/N-1-Eigenschaft in der harten Form „älter liest neuer nie"), zod-Validierung
je Item, 31 Tests. **Restlücken:** kein Backup-vor-Migration (Sicherheit hängt
allein an Schreibreihenfolge), und der beim Entfernen des fehlerhaften
Runtime-Checks versprochene **Schrittketten-Vollständigkeitstest** (jede
Version 1→N hat einen Schritt) fehlt.
**Bewertung:** Der Vorschlag ist zu ~80 % Bestand — das festzuhalten ist
wichtig, damit das Programm nicht Umgesetztes neu baut. Die Restlücken sind
klein und rein clientseitig; das reife `backup-service.ts` (sha256-Prüfsummen,
Verschlüsselung) ist der natürliche Baustein.
**Entscheidung:** Nur WP 1.4 (Backup-vor-Migration + Schrittketten-Test);
sonst als erfüllt markiert.

### BTR-10 · Backup & Disaster Recovery — **übernehmen; vorgezogen auf den ersten eigenen Zustand**
**Vorschlag:** Serverseitig WAL-Archivierung, verschlüsselte Backups zu zwei
EU-Anbietern, wöchentliche automatische Restore-Verifikation, monatlicher
DR-Test, Ergebnisse in die Observability („Backup ist erst ein Backup, wenn
Restore getestet wurde").
**Befund:** Lokal ist Backup reif (Prüfsummen, Versionierung, Verschlüsselung,
E2E-Roundtrip). Serverseitig gibt es heute kaum eigenen Zustand — Supabase
managed die wenigen Tabellen. Ab Phase 3 entsteht eigener Zustand
(Telemetrie-DB, später Entitlements, später alles).
**Bewertung:** Der Grundsatz ist richtig; der Zeitpunkt im Vorschlag
(„Phase Sovereign Infrastructure") ist zu spät. Regel des Programms: **Kein
eigener zustandsbehafteter Dienst ohne Backup beim Zweitanbieter und ohne
automatisierte Restore-Probe — vom ersten Tag an.** Monatliche DR-Vollübung
ist für Solo-Betrieb Zeremonie; quartalsweise mit Protokoll ist ehrlich
haltbar. Der Restore-Cron meldet sich per Dead-Man-Prinzip (Alarm beim
**Ausbleiben** des Erfolgssignals).
**Entscheidung:** WP 3.3 (ab erstem Dienst), WP 7.6 (WAL + volle
Restore-Verifikation mit eigener DB, quartalsweise DR-Übung).

---

## Anbieter-Ist-Landschaft (Momentaufnahme)

Die gepflegte Fassung mit Rollen-Taxonomie, Rechtsgrundlagen und Prüfdaten ist
das [Anbieter-Register](../security/anbieter-register.md) — **dorthin schauen,
nicht hierher.** Momentaufnahme zum Stichtag: Subprozessoren heute Vercel (US,
Function-Region US — BTR-S2) und Supabase (US-Unternehmen, Region unbekannt —
BTR-S3); GoCardless Bank Account Data (UK, Einstufung Prozessor vs.
eigenständiger Verantwortlicher offen — WP 0.9); Datenquellen ohne
Personenbezug Yahoo Finance (US, nur serverseitig, nur Ticker) und Stooq (PL,
Fallback); nutzergewählter Drittdienst eToro (BYO-API-Key, transitiert den
eigenen Proxy — BTR-S9); zu entfernen chart.googleapis.com (BTR-S4) und die
Tesseract-CDNs (BTR-S5); Entwicklungsplattform GitHub (US, kein
Endnutzer-Datenkontakt, Spiegel-Pflicht WP 3.1). Geplant: Hetzner (DE),
EU-Zweitanbieter für Offsite-Backups, Codeberg (DE), EU-Registry, Mollie (NL),
EU-SMTP, self-hosted IdP.

## Was diese Prüfung bewusst nicht tut

- **Keine Rechtsberatung.** AVV-Prüfung, VVT-Formulierung, AGB/Impressum sind
  [OPS]-Arbeit mit fachkundiger Prüfung; das Register liefert die Faktenbasis.
- **Keine Neubewertung der offenen Datenintegritäts-Issues.**
  [#292](https://github.com/DBocken/Fintracker/issues/292),
  [#293](https://github.com/DBocken/Fintracker/issues/293),
  [#296](https://github.com/DBocken/Fintracker/issues/296),
  [#298](https://github.com/DBocken/Fintracker/issues/298) bleiben eigenes
  Arbeitsfeld und sind das **Livegang-Gate** (plan.md, Kopf) — die externe
  Review kommt unabhängig zum selben Schluss.
- **Keine Produkt-Roadmap-Bewertung.** Die Roadmap-Epics (#234–#248) bleiben
  unberührt; Berührungspunkt ist einzig #52 (BTR-8).

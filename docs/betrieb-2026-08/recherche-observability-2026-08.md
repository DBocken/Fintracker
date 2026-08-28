# Recherche: Beobachtbarkeit im Livebetrieb ohne Datenschutz-Bruch — 2026-08-28

> **Protokoll.** Diese Recherche prüft die Observability-Vorentscheidungen des
> Betriebsprogramms (ADR [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md),
> Entscheidung F-3, Phasen 3–4 in [`plan.md`](plan.md)) gegen den Markt und die
> Rechtslage, Stand 2026-08. Die Zahlen und Anbieteraussagen darin altern
> absichtlich; was daraus als Regel folgt, steht in den geltenden Dokumenten
> bzw. als Plan-Ergänzungsvorschlag am Ende.

**Ergebnis vorweg:** Die getroffene Architektur — eigener EU-Empfänger für eine
geschlossene Event-Union statt Dritt-SaaS, Opt-in ohne Vorbelegung, Dead-Man-
Alarmierung, Uptime vom Zweitstandort, OTel/LGTM erst ab benannter Schwelle —
hält der Nachprüfung stand. Die Rechtsrecherche macht aus einem Ethos-Punkt
eine Pflicht (Opt-in für Crash-Berichte ist §-25-TDDDG-geboten, nicht nur
Haltung), und die Marktrecherche bestätigt die Absagen (Sentry-EU-Region,
Sentry-kompatible Self-Hosts, anonymisierte Analytics-SaaS) mit jeweils
konkretem Grund. Neu gegenüber dem Plan sind sechs benannte Restlücken, allen
voran: **Es gibt kein Störfall-Kapitel (Incident Response) — nirgends.**

---

## 1. Das Leitbild, das die Spannung auflöst

Die Frage „Datenschutz halten *oder* Livebetrieb überwachen?" ist falsch
gestellt, sobald man sortiert, **wen** die jeweilige Messung ansieht. Drei
Ringe, von außen nach innen, mit fallendem Ertrag und steigender
Datenschutz-Last:

| Ring | Was | Personenbezug | Einwilligung | Stand im Repo |
|---|---|---|---|---|
| **1 — Dienst-Seite** | Uptime-/Synthetik-Checks, Health-/Version-Endpunkte, strukturierte Server-Logs ohne PII, Host-Metriken, Dead-Man-Signale für Backup/Cron | keiner (eigene Infrastruktur wird gemessen, nicht der Nutzer) | nein | geplant (WP 1.3, 3.2–3.4, 4.5), heute fast nichts |
| **2 — Gerät, lokal** | Fehlerprotokoll auf dem Gerät, Diagnose-Fläche, nutzerinitiierter Export | ja, aber verlässt das Gerät nie automatisch | entfällt (keine Übertragung) | **gebaut**: `error-log-service`, `DiagnosticsSettings`, Wächter `local-data-boundary` |
| **3 — Opt-in-Telemetrie** | Geschlossene Union (`screen_view`, `error`, `performance`, `feature_used`) an den eigenen EU-Empfänger | pseudonym (Session-ID je Tab) | **ja, Opt-in** | gebaut, bewusst dunkel (F-3); scharf ab Phase 4 |

Der entscheidende Punkt: **Ring 1 liefert den Großteil der Betriebsgüte und
berührt keinen einzigen Nutzer.** Ob die Web-App ausliefert, ob der
Token-Endpunkt antwortet, ob eine Edge Function auf dem `main`-Stand läuft, ob
das Backup seine Restore-Probe bestanden hat — all das misst eigene Dienste
und braucht weder Einwilligung noch Anbieterabwägung. Wer „Überwachung für
hochwertige Software" sagt, meint zu vier Fünfteln diesen Ring. Ring 3 ist der
kleine Rest, der wirklich vom Gerät kommt — und genau dort greifen Union,
Opt-in und Wächter.

Ring 2 ist die Besonderheit dieser App und bleibt es: Messung ohne
Übertragung. Das lokale Fehlerprotokoll (Ring-Buffer, redigiert beim
Schreiben, Export nur von Hand) beantwortet den Support-Fall „bei mir ist X
kaputt" ohne jeden Serverkontakt — die meisten Apps haben diese Stufe gar
nicht und springen deshalb direkt zu Crash-SaaS.

## 2. Rechtslage: Das Opt-in ist Pflicht, nicht Kür

Die Recherche verschiebt die Begründung der eigenen Architektur — von „wir
wollen das so" zu „anders wäre es rechtswidrig":

- **Crash-Berichte brauchen Einwilligung.** § 25 Abs. 1 TDDDG verlangt
  Einwilligung für jeden Zugriff auf Informationen der Endeinrichtung, der
  nicht „unbedingt erforderlich" ist (Abs. 2). Die Übermittlung von
  Absturzberichten ist für den Betrieb einer App nicht unbedingt erforderlich
  — so ausdrücklich die datenschutzrechtliche Bewertung im öffentlich
  dokumentierten HVV-/Deutschlandticket-Fall ([Kuketz](https://www.kuketz-blog.de/hamburger-verkehrsverbund-hvv-absturzberichte-ohne-einwilligung-deutschlandticket-teil5/)).
  Auch für Telemetrie generell rät die Fachliteratur von der Stützung auf
  berechtigtes Interesse ab und empfiehlt Opt-in **vor** der ersten Erhebung
  ([activeMind](https://www.activemind.de/magazin/telemetriedaten/)). Genau so
  ist `telemetry-service.ts` gebaut (Flag default aus, ohne Endpunkt kein
  Versand, Widerruf löscht die Queue).
- **„Anonym = einwilligungsfrei" trägt bei uns nicht.** Anbieter wie
  TelemetryDeck argumentieren über Erwägungsgrund 26 DSGVO: vollständig
  anonymisierte Daten seien keine personenbezogenen Daten, also kein
  Consent-Banner ([TelemetryDeck](https://telemetrydeck.com/docs/articles/anonymization-how-it-works/)).
  Das ist für deren Doppel-Hash-Modell vertretbar — unsere Union führt aber
  eine Session-ID je Tab und ist damit **pseudonym, nicht anonym**. Der
  ehrliche Schluss ist nicht, die Session-ID wegzuerklären, sondern beim
  Opt-in zu bleiben. (Sie ganz zu streichen wäre der einzige Weg zur
  Anonymitäts-These — und würde die Fehlersuche kaum treffen, bliebe aber
  §-25-pflichtig, weil der *Zugriff aufs Gerät* der Anknüpfungspunkt ist,
  nicht der Personenbezug.)
- **Ring 1 steht auf berechtigtem Interesse.** Server-Logs der eigenen
  Infrastruktur (Art. 6 Abs. 1 lit. f DSGVO) sind der Normalfall — unter den
  Bedingungen, die WP 3.4 bereits nennt: IPs nicht persistieren, kurze
  Rotation, kein Inhalt. § 25 TDDDG greift hier nicht, weil nichts auf der
  Endeinrichtung gespeichert oder ausgelesen wird.
- **Meldepflichten sind Betriebspflichten.** Art. 33 DSGVO gibt für meldbare
  Verletzungen 72 Stunden ab Kenntnis — „Kenntnis" setzt voraus, dass es
  einen beschriebenen Weg gibt, auf dem ein Vorfall überhaupt bemerkt und
  eingestuft wird. Das ist die Brücke von Datenschutz zu Incident Response
  (Lücke L1 unten): Ohne Störfall-Kapitel ist die 72-Stunden-Frist ein
  Zufallsversprechen.
- **Die stehende Regel deckt den Rest.** Register-Zeile, Datenschutztext,
  VVT-Faktenbasis und Data-Safety-Formular (WP 5.2) hängen bereits per Regel
  an jeder Datenfluss-Änderung — die Rechtsrecherche fügt dem nichts hinzu,
  sie bestätigt die Konstruktion.

## 3. Markt: die geprüften Alternativen und warum die Absagen halten

Jede Zeile ist eine real erwogene Alternative; die Absage nennt den Grund, der
sie trägt — neuer Geschmack reicht nicht, neue Fakten schon.

| Alternative | Befund 2026-08 | Entscheidung |
|---|---|---|
| **Sentry SaaS, EU-Region** (Frankfurt, seit GA wählbar; `sendDefaultPii: false`, serverseitige Scrubber) | Datenhaltung DE, aber US-Rechtsperson mit Zugriff — exakt der Fall „EU-Region eines US-Anbieters genügt", den die ADR verworfen hat (CLOUD Act). Zusätzlich neu: das Sentry-SDK sendet Freiform-Payloads (Stacks, Breadcrumbs, Request-Kontext) und kollidiert damit strukturell mit der Allowlist-Union — Scrubbing ist eine Verbotsliste, unsere Union eine Positivliste, und nur letztere kann ein Wächter beweisen | Absage bleibt, jetzt doppelt begründet |
| **Sentry-kompatible Self-Hosts: [GlitchTip](https://europeanpurpose.com/tool/glitchtip), [Bugsink](https://www.bugsink.com/gdpr/)** (EU-hostbar, nehmen Sentry-SDKs per DSN-Wechsel) | Lösen das Anbieter-Problem, nicht das Payload-Problem: Der Client bliebe ein fremdes SDK mit eigenem, breitem Sendeverhalten — ein **zweiter Versandweg** neben `telemetry-service.ts`, den `telemetry.security.test.ts` („genau ein Versandweg") zu Recht verbietet. `security-boundaries.md`: „Ein dritter Weg ist ein Befund, keine Erweiterung" | Absage; höchstens relevant, falls WP 4.3 redigierte Stackframes bejaht — und selbst dann ist die Union-Erweiterung am eigenen Empfänger billiger als ein Fremd-SDK zu zähmen |
| **Anonymisierte Analytics-SaaS: [TelemetryDeck](https://telemetrydeck.com/blog/europe-based-app-analytics-service/)** (Augsburg, EU-Infrastruktur), **[Aptabase](https://aptabase.com/)** (self-hostbar) | Datenschutz-seriös, EU-ansässig — aber Dritt-SaaS für genau die Funktion, die der eigene Empfänger (WP 3.4) mit weniger Fläche, ohne AVV und ohne neue Registerzeile erfüllt. Die ADR hat „Dritt-Analytics" namentlich verworfen | Absage; als Beleg wertvoll, dass „Telemetrie ohne Personenbezug" ein etabliertes Muster ist, kein Sonderweg |
| **Uptime: [Uptime Kuma](https://uptimepage.dev/blog/best-self-hosted-uptime-monitoring-tools) self-hosted beim Zweitanbieter** (Plan WP 3.4) | Bestätigt: verbreitetste Self-Host-Lösung, Statusseite inklusive, Kosten = VPS. Benannte Grenze: **ein** Messstandort — fällt der Zweitanbieter aus, ist auch die Messung blind. [openstatus](https://www.openstatus.dev/compare/uptime-kuma) (AGPL, multi-region, self-hostbar) ist der benannte Ausweichkandidat, falls ein Standort nachweislich zu wenig wird | Plan bestätigt; Grenze + Ausweichkandidat notiert |
| **OTel-Vollausbau: Grafana/[LGTM](https://signoz.io/blog/grafana-alternatives/), [SigNoz](https://www.parseable.com/blog/ten-best-open-source-observability-platforms-2026), HyperDX** | Recherche bestätigt die Betriebslast-These von WP 4.5: LGTM ist der steilste Betriebsaufwand (fünf Komponenten, je eigene Query-Sprache), SigNoz heißt ClickHouse betreiben. Für **einen** Host mit einer Handvoll Containern ist das ein eigenes Betriebsprojekt ohne Gegenwert | Ausbau-Schwelle (WP 4.5) bestätigt; OTLP-Fähigkeit des Empfängers als Option notieren, nicht bauen |
| **Vercel-Bordmittel** ([Drains](https://vercel.com/blog/introducing-vercel-drains), Region-Pinning `fra1`) | `fra1` verschiebt den Compute-Ort, [nicht die Rechtsperson mit Zugriff](https://sota.io/blog/vercel-eu-alternative-gdpr-cloud-act-2026) auf Code, Env-Vars und Logs — bestätigt Register-Status „Übergang, befristet" und WP 3.5 | Drains nicht einführen (Übergangs-Infrastruktur nicht vertiefen); Region-Pinning bleibt WP 0.2 |
| **Supabase-Bordmittel** ([Log Drains](https://supabase.com/docs/guides/monitoring-and-debugging/log-drains) OTLP ab Pro, [Metrics API](https://supabase.com/blog/metrics-api-observability) im Prometheus-Format) | Existieren und wären EU-seitig anzapfbar — aber Supabase ist per ADR Ablöse-Kandidat (Phase 7); Beobachtungs-Verdrahtung dorthin wäre Neubau am Übergangs-Anbieter (Neubau-Stopp, WP 2.3) | Nicht verdrahten; für die Übergangszeit reicht das Dashboard als Handgriff im Runbook |

## 4. Was der Bestand schon kann (damit niemand es doppelt baut)

- **Union & Versandweg:** `src/lib/telemetry-events.ts` (geschlossene Union,
  Feld-Positivliste, Verbots-Substrings, Route-Regex),
  `src/services/telemetry-service.ts` (vier UND-Bedingungen, Queue gedeckelt,
  Widerruf löscht). Null produktive Callsites — das ist Entscheidung F-3
  („zuerst der Empfänger"), kein Versäumnis.
- **Lokale Diagnose:** `error-log-service.ts` (Ring-Buffer 100, Redaktion beim
  Schreiben, bewusst unverschlüsselt für pre-unlock), `global-error-handlers.ts`,
  `DiagnosticsSettings.tsx` (ansehen, kopieren, exportieren, löschen — „kein
  automatischer Versand").
- **Wächter, die die Grenze halten:** `local-data-boundary.security.test.ts`
  (13 `LOCAL_ONLY_SERVICES`, Logger netzwerkfrei, genau eine dokumentierte
  `CLOUD_EXCEPTION`), `telemetry.security.test.ts` (genau ein Versandweg, kein
  Endpoint-Fallback), `check:external-endpoints` (Register in beide
  Richtungen).
- **Der einzige Health-Endpunkt im Repo:** `services/entitlements` →
  `GET /healthz`.

## 5. Restlücken — was Plan und Bestand noch nicht abdecken

**L1 · Incident Response existiert nicht — die größte echte Lücke.** Kein
Dokument beschreibt: Wie wird ein Vorfall bemerkt (Alarmwege aus WP 3.3/3.4),
wer stuft ihn ein (Schweregrade; Sonderfall „personenbezogene Daten betroffen"
→ Art.-33-Prüfung mit 72-Stunden-Uhr), wie wird kommuniziert (Statusseite —
Uptime Kuma bringt eine mit), wie wird nachbereitet (Post-Mortem als Protokoll
unter `belege/`). **Vorschlag:** Störfall-Kapitel als Pflichtteil von
`docs/betrieb.md` in WP 1.1 aufnehmen — es braucht keine Infrastruktur, nur
Entscheidungen, und gehört damit in Phase 1, nicht Phase 4.

**L2 · `api/mcp` hat keinen Health-/Version-Endpunkt und fällt durch das
WP-1.3-Raster** (das nur `supabase/functions/**` nennt). Beim Umzug (WP 3.5)
oder in WP 1.3 ergänzen — sonst ist ausgerechnet der Endpunkt, der Finanzdaten
serviert, der einzige ohne Deploy-Nachweis.

**L3 · EntitlementService loggt praktisch nichts** (ein `console.log` beim
Start) **und hat kein Rate-Limit** (im README als Grenze benannt). Vor dem
Scharfschalten von Phase 6: strukturiertes Request-Log **mit Feld-Positivliste
nach dem Vorbild von `utils/logger.ts`** (Methode, Route, Status, Dauer,
Correlation-ID — nie JWT-Claims, nie Payment-Payloads), Log-Rotation auf dem
Host (WP 4.5), Drosselung vor `POST /v1/checkout` und dem Webhook. Ein
Bezahl-Dienst, dessen 500er niemand sieht, ist die teuerste Blindstelle des
ganzen Systems.

**L4 · Zwei parallele Log-Welten im Client:** 37 rohe `console.error` in
`src/` (Schwerpunkte `gocardless-sync-service`, `etoro-service`, `ocr-service`)
neben dem disziplinierten `logger`. Rohe `console.error` erreichen das lokale
Fehlerprotokoll nicht — der Nutzer exportiert im Support-Fall ein Protokoll,
in dem genau die Sync-Fehler fehlen, um die es meist geht. Kandidat für eine
Ratsche (Zählstand darf nur sinken), nicht für ein hartes Verbot — die
Umstellung ist mechanisch, aber 37 Stellen wollen einzeln gesichtet sein
(Redaktions-Whitelist!).

**L5 · Kein Wächter über die Security-Header, und `netlify.toml` driftet**
bereits heute von `vercel.json` ab (bekannt, `security-headers.md` benennt es
selbst: „eine gelockerte CSP fiele heute niemandem auf"). WP 0.2 (Datei
entfernen) löst die Drift; ein Header-Wächter bleibt danach trotzdem
lohnend — die CSP ist inzwischen selbst Gegenstand der stehenden Regel.
Randnotiz dazu: **CSP-Reporting** (`report-to`) wäre ein billiger
Frühwarnkanal für CSP-Brüche, darf aber erst kommen, wenn der eigene
Empfänger steht — ein Reporting-Endpunkt bei einem Dritten wäre ein neuer
Datenabfluss durch die Hintertür. Als Option bei WP 4.5 notieren.

**L6 · `status.md` des Programms ist veraltet** (meldet 0/40, während der
Plan 0.3, 0.8, 2.1, 6.2, 6.3 als erledigt führt). Reine Protokollpflege, aber
genau die Sorte Drift, gegen die `docs/README.md` die Landkarte eingeführt
hat.

## 6. Die Antwort auf die Kernfrage, in einem Absatz

Die Datenschutz-Idee und der überwachte Livebetrieb konkurrieren nicht — sie
liegen auf verschiedenen Ringen. Vier Fünftel der Betriebsgüte (Erreichbarkeit,
Deploy-Nachweis, Backup-Beweis, Server-Fehler) entstehen in Ring 1 auf eigener
EU-Infrastruktur und sehen keinen Nutzer an; der Rest ist die bereits gebaute
Opt-in-Union in Ring 3, die rechtlich (§ 25 TDDDG) ohnehin nur als Opt-in
zulässig wäre. Der Weg dorthin steht im Plan und hat sich in der Nachprüfung
nicht verschoben: **Phase 1** (Runbook — jetzt inklusive Störfall-Kapitel L1 —,
Artefakte, automatische Function-Deploys mit `/version`-Beweis), **Phase 3**
(EU-Host, Backup mit Restore-Probe und Dead-Man-Alarm, Telemetrie-Empfänger
als erster Dienst, Uptime vom Zweitstandort), **Phase 4** (Telemetrie scharf:
Endpoint, Callsites, `CLOUD_EXCEPTION` + Register + CSP + Datenschutztext im
selben Release). Nichts davon erfordert einen neuen Anbieter, ein fremdes SDK
oder eine Lockerung eines Wächters — und genau daran lässt sich später
prüfen, ob es richtig gebaut wurde.

## 7. Anbindungs-Empfehlung — und was davon schon vorbereitet ist

Aus Abschnitt 3 folgt eine bewusst kurze Einkaufsliste: **Es werden zwei
Infrastruktur-Anbieter angebunden, keine SaaS-Werkzeuge.** Hetzner (DE) als
Primär-Host und OVHcloud **oder** Scaleway (FR) als Zweitstandort — beide
stehen bereits als „geplant" im Anbieter-Register. Alles Weitere ist Software,
die dort selbst betrieben wird: Uptime Kuma (Checks, Dead-Man-Push-Monitore
**und** Statusseite in einem Container), restic (Backup + wöchentliche
Restore-Probe), der eigene Telemetrie-Empfänger (WP 3.4), node_exporter erst
mit WP 4.5. Einziger dritter Kandidat fürs Register: ein EU-SMTP als
Alarmkanal (dort ohnehin als „geplant" geführt).

**Eine eigene Statusseite wird nicht entwickelt.** Sie wäre ein neuer
zustandsbehafteter Dienst, auf den sofort die eigenen Regeln zurückfallen
(Zwei-Anbieter-Backup, Restore-Probe, Uptime-Überwachung — Überwachung für
die Überwachung), für ein gelöstes Problem: Die Kuma-Statusseite entsteht als
Nebenprodukt genau der Checks, die ohnehin gebraucht werden. Entscheidend ist
nicht der Bau, sondern die **Platzierung**: Die Statusseite liegt am
Zweitstandort unter `status.<domain>`, damit sie erreichbar ist, wenn der
Primär-Host es nicht ist. Benannte Grenze bleibt der eine Messstandort;
Ausweichkandidat dafür ist openstatus (Abschnitt 3) — auch dann: übernehmen,
nicht bauen.

Der aus dem Repo heraus vorbereitbare Teil liegt seit diesem Protokoll unter
[`infra/`](../../infra/README.md): geteiltes `cloud-init.yaml` (Härtung beider
VMs), Compose + Caddyfile je Standort, `backup.sh`/`restore-probe.sh` mit
Dead-Man-Heartbeat, `monitoring/monitors.md` als Quelle der Wahrheit für die
Kuma-Monitore, und die Betreiber-Checkliste mit den verbleibenden manuellen
Schritten (Konten, DNS, Secrets). Bewusst **nicht** vorgebaut: der
Telemetrie-Empfänger (WP 3.4, test-first) und alles ab der
OTel-Ausbau-Schwelle (WP 4.5).

## Quellen

- [activeMind: Rechtmäßige Verarbeitung von Telemetriedaten](https://www.activemind.de/magazin/telemetriedaten/)
- [Kuketz: HVV-Absturzberichte ohne Einwilligung (§ 25 TTDSG/TDDDG)](https://www.kuketz-blog.de/hamburger-verkehrsverbund-hvv-absturzberichte-ohne-einwilligung-deutschlandticket-teil5/)
- [§ 25 TDDDG im Wortlaut](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [Sentry: Datenstandort Deutschland GA](https://sentry.io/changelog/data-storage-location-in-germany-is-generally-available) · [Sentry GDPR-Praxis](https://sentry.io/trust/privacy/gdpr-best-practices/)
- [Bugsink: GDPR-Positionierung](https://www.bugsink.com/gdpr/) · [GlitchTip-Einordnung](https://europeanpurpose.com/tool/glitchtip) · [Vergleich Bugsink/GlitchTip](https://www.bugsink.com/blog/bugsink-vs-glitchtip/)
- [TelemetryDeck: EU-Standort](https://telemetrydeck.com/blog/europe-based-app-analytics-service/) · [Anonymisierungs-Verfahren](https://telemetrydeck.com/docs/articles/anonymization-how-it-works/) · [Aptabase](https://aptabase.com/)
- [Self-hosted Uptime-Monitore im Vergleich](https://uptimepage.dev/blog/best-self-hosted-uptime-monitoring-tools) · [openstatus vs. Uptime Kuma](https://www.openstatus.dev/compare/uptime-kuma)
- [SigNoz: Grafana-Alternativen (Betriebslast LGTM)](https://signoz.io/blog/grafana-alternatives/) · [Open-Source-Observability-Plattformen 2026](https://www.parseable.com/blog/ten-best-open-source-observability-platforms-2026)
- [Vercel Drains](https://vercel.com/blog/introducing-vercel-drains) · [Vercel-EU-Einordnung (CLOUD Act)](https://sota.io/blog/vercel-eu-alternative-gdpr-cloud-act-2026)
- [Supabase Log Drains](https://supabase.com/docs/guides/monitoring-and-debugging/log-drains) · [Supabase Metrics API](https://supabase.com/blog/metrics-api-observability)

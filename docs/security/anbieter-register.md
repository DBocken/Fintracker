# Anbieter-Register — Subdienstleister und externe Endpunkte

> **Geltend und lebend.** Dieses Register ist die Liste der Anbieter,
> Subdienstleister und externen Endpunkte — zugleich die Faktenbasis für
> Subprozessoren-Verzeichnis, VVT (Art. 30) und Datenschutztexte. Die Regel
> dahinter steht in der ADR
> [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md)
> (EU-only + Rollen-Taxonomie). **Pflegepflicht mit Wächter:** seit WP 0.8
> erzwingt `pnpm check:external-endpoints` (Pre-Commit + CI), dass jeder
> externe Host im Produktivcode hier erklärt ist **und** jede aktive Zeile
> hier im Code oder in der CSP vorkommt. Rolle `Entwicklung` ist von der
> zweiten Richtung ausgenommen — GitHub berührt keine Nutzerdaten und taucht
> in App-Code naturgemäss nicht auf. Die Host-Spalte ist maschinenlesbar:
> Hosts stehen in `Backticks`, mehrere getrennt durch Komma oder `·`.
> Sitz-/Rechtsangaben tragen ein Prüfdatum — sie sind Tatsachenbehauptungen
> mit Verfallszeit, keine Ewigkeitswerte.

Rollen gemäß ADR-Taxonomie: **Subprozessor** (verarbeitet personenbezogene
Daten in unserem Auftrag) · **Datenquelle** (kein Personenbezug, feste
Bedingungen) · **nutzergewählt** (Nutzer bringt eigenen Anbieter mit; unser
Proxy ist trotzdem unser Datenfluss) · **Link** (nutzerinitiiert, kein
Datenfluss) · **Entwicklung** (kein Endnutzer-Datenkontakt).

## Aktiv

| Host(s) | Anbieter | Sitz | Rolle | Zweck / Datenfluss | AVV / Rechtsgrundlage | Status | Geprüft |
|---|---|---|---|---|---|---|---|
| `pbopyawkxxrluhofjtub.supabase.co` | Supabase Inc. | **Unternehmen US · Datenregion Schweden (EU)** — die Region ändert die Jurisdiktion nicht (CLOUD Act), siehe ADR | Subprozessor | Auth (E-Mail/OAuth), Edge Functions, MCP-Aggregate (Opt-in), Bank-Sync-Artefakte, Auth-Mails | AVV: **prüfen → WP 0.9** | **Übergang, befristet** — Ablösung Phase 7 ([ADR](../architecture/supabase-abloesung.md)) | 2026-08-16 |
| `fintracker-phi.vercel.app`, `vercel.app`, `/api/mcp` | Vercel Inc. | US · Function-Region derzeit US-Default (BTR-S2) | Subprozessor | Web-Hosting, MCP-Endpunkt; IP-Verarbeitung, Function liefert Finanz-Aggregate. `vercel.app` ist zusätzlich als **Origin-Suffix** zugelassen (`DEFAULT_ALLOWED_ORIGIN_SUFFIXES` in `gocardless-sync`/`delete-account`) — damit gilt die Zulassung für **jede** Vercel-App, nicht nur für unsere; Verengung siehe WP 3.5 | DPF-/AVV-Status: **prüfen → WP 0.9** | **Übergang, befristet** — Region-Pinning WP 0.2, Umzug WP 3.5 | 2026-08-16 |
| `bankaccountdata.gocardless.com`, `gocardless.com` | GoCardless Ltd. | UK (Angemessenheitsbeschluss; Produkt-Ursprung Nordigen, LV) | **Einstufung offen:** Subprozessor vs. eigenständiger Verantwortlicher (lizenzierter AISP) → WP 0.9 | Bank-Anbindung: Requisitionen, IBAN, Salden, Umsätze (730 Tage) — Secrets nur serverseitig. `gocardless.com` ist als **Redirect-Suffix** zugelassen (`GOCARDLESS_AUTH_HOST_SUFFIXES` in `src/lib/safe-url.ts`): Ziel jeder GoCardless-Subdomain ist erlaubt | Vertrag/AVV: **prüfen → WP 0.9**; UK-Adequacy mit Prüfdatum | aktiv | 2026-08-16 |
| `query1.finance.yahoo.com` | Yahoo | US | Datenquelle | Kurse; **nur serverseitig** (`market-quotes`), nur Ticker, keine Nutzerkennung/Client-IP | entfällt (kein Personenbezug); Bedingungen der ADR gelten | aktiv, Beobachtung (inoffizielle API) | 2026-08-10 |
| `stooq.com` | Stooq | PL (EU) | Datenquelle | Kurs-Fallback; gleiche Bedingungen | entfällt | aktiv | 2026-08-10 |
| `public-api.etoro.com` | eToro | IL/UK/CY | nutzergewählt | Depot-Daten des Nutzers via **eigenem** API-Key; transitieren unseren Proxy (`etoro-proxy`) — **Proxy gehört in den Datenschutztext (BTR-S9 → WP 4.2)** | Nutzervertrag mit eToro; unser Proxy: eigene Verantwortung | aktiv | 2026-08-10 |
| `github.com` | GitHub (Microsoft) | US | Entwicklung | Quellcode, CI, Issues — kein Endnutzer-Datenkontakt | entfällt | aktiv; **Spiegel-Pflicht → WP 3.1** | 2026-08-10 |
| `schufa.de` · `caritas.de` · `diakonie.de` · `verbraucherzentrale.de` · `rechtsdienstleistungsregister.de` | diverse | DE | Link | Beratungs-/Auskunfts-Links, nutzerinitiiert, kein Datenfluss | entfällt | aktiv | 2026-08-10 |
| `deno.land` · `esm.sh` | Deno Land Inc. / esm.sh | US | Entwicklung (Code-CDN) | Laufzeit-Importe der fünf Supabase Edge Functions (std lib, supabase-js) — kein Nutzerdatenkontakt, aber Lieferketten-Abhängigkeit | entfällt | aktiv; entfällt mit der Portierung (WP 7.4) | 2026-08-10 |
| `api.mollie.com`, `mollie.com` | Mollie B.V. | **NL (EU)**, DNB-beaufsichtigt | Subprozessor | Zahlungen (PSP). Der API-Aufruf läuft **ausschliesslich serverseitig** aus dem EntitlementService; der API-Key existiert nur dort. **Kartendaten sehen wir nie** — der Kauf läuft über Mollies gehostete Checkout-Seite, der Browser wird dorthin weitergeleitet. `mollie.com` ist zusätzlich als **Redirect-Suffix** zugelassen (`CHECKOUT_HOST_SUFFIXES`, `features/billing/application/use-start-checkout.ts`): Damit ist jede Mollie-Subdomain ein erlaubtes Weiterleitungsziel — nötig, weil Mollie den Checkout über wechselnde Subdomains ausliefert, und geprüft durch `isSafeExternalAuthUrl` (§10 Regel 5). Gespeichert werden nur Statusfakten (`validUntil`, Produkt, Mollie-Kennungen), kein Betrag, keine Kartendaten, kein Zahlungsverlauf | AVV: **ausstehend → WP 6.1** | **Code vorhanden, noch nicht scharf** — Testmodus, kein Deployment. Echtbetrieb erst mit WP 6.1 (Konto, AVV, USt/OSS, Rechtstexte) und dem EU-Host aus WP 3.2 | 2026-08-16 |

## Zu entfernen (Befunde, keine Absicht)

| Host(s) | Anbieter | Befund | Weg |
|---|---|---|---|
| `chart.googleapis.com` | Google | Bank-Requisition-URL als QR-Parameter (BTR-S4); API abgeschaltet **und** CSP-blockiert — Feature defekt | lokales Rendern (`qrcode`-Dependency) → **WP 0.4** |
| `cdn.jsdelivr.net` · `tessdata.projectnaptha.com` | jsDelivr / Naptha | Tesseract-Laufzeit-Downloads (BTR-S5); CSP-blockiert — OCR produktiv defekt | Assets selbst ausliefern → **WP 0.5** |
| `cdnjs.cloudflare.com` | Cloudflare | `jspdf` laedt im Ausgabemodus `pdfobjectnewwindow` das Skript `pdfobject.min.js` nach (`jspdf/dist/*`). Die App benutzt diesen Modus heute nicht, und die CSP wuerde ihn ohnehin blockieren — es fliessen also keine Daten dorthin. Gefunden erst, seit `check:external-endpoints` auch die Vorgaben direkter Abhaengigkeiten liest | Modus nicht benutzen; bei Bedarf Asset selbst ausliefern — gleiche Entscheidung wie **WP 0.5** |
| `ausgabentracker.de` · `docs.ausgabentracker.de` | — (eigene, nie deployte Domains) | `src/lib/constants.ts` verlinkt Support, Doku, `/privacy` und `/terms` auf Domains, die **nicht betrieben werden** — ein Nutzer, der darauf klickt, landet im Leeren. Für einen Verkauf sind Impressum/AGB/Widerruf Pflicht | real machen **oder** aus dem Code entfernen → **WP 6.1** |

## Geplant (Programm; Zeile wird bei Inbetriebnahme „aktiv")

| Anbieter | Sitz | Rolle (künftig) | Zweck | Ab |
|---|---|---|---|---|
| Hetzner Online GmbH (Empfehlung) | DE | Subprozessor | Primär-Host: VM, Web, Empfänger, Dienste | WP 3.2 |
| OVHcloud **oder** Scaleway (Entscheid bei WP 3.3) | FR | Subprozessor | Zweitanbieter: Offsite-Backups (restic), Uptime-Überwachung | WP 3.3/3.4 |
| Codeberg e.V. | DE | Entwicklung | Git-Spiegel | WP 3.1 |
| EU-Registry (Eigenbetrieb auf VM oder EU-Anbieter, Entscheid bei WP 3.1) | EU | Entwicklung | Container-/Artefakt-Registry | WP 3.1 |
| EU-SMTP (Entscheid bei WP 7.1) | EU | Subprozessor | Auth-/Transaktionsmails des self-hosted IdP | WP 7.1 |
| self-hosted IdP (Entscheid bei WP 7.1 gegen Kriterienkatalog WP 2.4) | EU (Eigenbetrieb) | ersetzt Supabase-Auth | Identität, OIDC | Phase 7 |

## Randnotizen

- **Telemetrie-Endpunkt:** `VITE_TELEMETRY_ENDPOINT`
  (`src/services/telemetry-service.ts`) ist heute **unbelegt** — es gibt kein
  Versandziel und keinen Versand. Sobald er belegt wird (WP 3.4/4.1), bekommt
  der Zielhost eine eigene Registerzeile; die stehende Regel der ADR greift.
- **Referenzierte, nicht betriebene Domains:** steht seit WP 0.8 als eigene
  Zeile unter „Zu entfernen" — der Wächter verlangt für jeden Host im Code
  eine Tabellenzeile, und eine Randnotiz ist keine. Die Mail-Adresse
  `support@ausgabentracker.de` (`src/lib/constants.ts`) teilt dieselbe Domain
  und dasselbe Schicksal; sie taucht im Wächter nicht auf, weil er Hosts
  liest, keine Mail-Adressen.
- **FCM (Google):** heute nicht im Einsatz. Würde mit einem künftigen
  Push-Feature als **inhaltsfreier Transportadapter** eine echte
  Subprozessor-Ausnahme (Push-Token sind personenbezogen) — Eintrag erfolgt
  dann mit Begründung; UnifiedPush/self-hosted als zweiter Adapter vorgesehen
  (ADR).
- **KI-Konnektoren (Claude/ChatGPT)** ziehen Opt-in-Aggregate über den
  MCP-Endpunkt (`docs/mcp-poc.md`): kein Vertragsverhältnis von uns zum
  KI-Anbieter — der Nutzer verbindet seinen eigenen Assistenten
  (Rolle: nutzergewählt). Der Endpunkt selbst läuft bei Vercel (s. o.).

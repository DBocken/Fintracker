# Anbieter-Register — Subdienstleister und externe Endpunkte

> **Geltend und lebend.** Dieses Register ist die Liste der Anbieter,
> Subdienstleister und externen Endpunkte — zugleich die Faktenbasis für
> Subprozessoren-Verzeichnis, VVT (Art. 30) und Datenschutztexte. Die Regel
> dahinter steht in der ADR
> [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md)
> (EU-only + Rollen-Taxonomie). **Pflegepflicht mit Wächter:** ab WP 0.8
> erzwingt `pnpm check:external-endpoints`, dass jeder externe Host im Code
> hier erklärt ist und jede Zeile hier (Status ≠ geplant) im Code oder in der
> CSP vorkommt. Sitz-/Rechtsangaben tragen ein Prüfdatum — sie sind
> Tatsachenbehauptungen mit Verfallszeit, keine Ewigkeitswerte.

Rollen gemäß ADR-Taxonomie: **Subprozessor** (verarbeitet personenbezogene
Daten in unserem Auftrag) · **Datenquelle** (kein Personenbezug, feste
Bedingungen) · **nutzergewählt** (Nutzer bringt eigenen Anbieter mit; unser
Proxy ist trotzdem unser Datenfluss) · **Link** (nutzerinitiiert, kein
Datenfluss) · **Entwicklung** (kein Endnutzer-Datenkontakt).

## Aktiv

| Host(s) | Anbieter | Sitz | Rolle | Zweck / Datenfluss | AVV / Rechtsgrundlage | Status | Geprüft |
|---|---|---|---|---|---|---|---|
| `pbopyawkxxrluhofjtub.supabase.co` | Supabase Inc. | US · **Region: unbekannt → WP 0.3** | Subprozessor | Auth (E-Mail/OAuth), Edge Functions, MCP-Aggregate (Opt-in), Bank-Sync-Artefakte, Auth-Mails | AVV: **prüfen → WP 0.9** | **Übergang, befristet** — Ablösung Phase 7 ([ADR](../architecture/supabase-abloesung.md)) | 2026-08-10 |
| `fintracker-phi.vercel.app`, `/api/mcp` | Vercel Inc. | US · Function-Region derzeit US-Default (BTR-S2) | Subprozessor | Web-Hosting, MCP-Endpunkt; IP-Verarbeitung, Function liefert Finanz-Aggregate | DPF-/AVV-Status: **prüfen → WP 0.9** | **Übergang, befristet** — Region-Pinning WP 0.2, Umzug WP 3.5 | 2026-08-10 |
| `bankaccountdata.gocardless.com` | GoCardless Ltd. | UK (Angemessenheitsbeschluss; Produkt-Ursprung Nordigen, LV) | **Einstufung offen:** Subprozessor vs. eigenständiger Verantwortlicher (lizenzierter AISP) → WP 0.9 | Bank-Anbindung: Requisitionen, IBAN, Salden, Umsätze (730 Tage) — Secrets nur serverseitig | Vertrag/AVV: **prüfen → WP 0.9**; UK-Adequacy mit Prüfdatum | aktiv | 2026-08-10 |
| `query1.finance.yahoo.com` | Yahoo | US | Datenquelle | Kurse; **nur serverseitig** (`market-quotes`), nur Ticker, keine Nutzerkennung/Client-IP | entfällt (kein Personenbezug); Bedingungen der ADR gelten | aktiv, Beobachtung (inoffizielle API) | 2026-08-10 |
| `stooq.com` | Stooq | PL (EU) | Datenquelle | Kurs-Fallback; gleiche Bedingungen | entfällt | aktiv | 2026-08-10 |
| `public-api.etoro.com` | eToro | IL/UK/CY | nutzergewählt | Depot-Daten des Nutzers via **eigenem** API-Key; transitieren unseren Proxy (`etoro-proxy`) — **Proxy gehört in den Datenschutztext (BTR-S9 → WP 4.2)** | Nutzervertrag mit eToro; unser Proxy: eigene Verantwortung | aktiv | 2026-08-10 |
| `github.com` | GitHub (Microsoft) | US | Entwicklung | Quellcode, CI, Issues — kein Endnutzer-Datenkontakt | entfällt | aktiv; **Spiegel-Pflicht → WP 3.1** | 2026-08-10 |
| `schufa.de` · `caritas.de` · `diakonie.de` · `verbraucherzentrale.de` · `rechtsdienstleistungsregister.de` | diverse | DE | Link | Beratungs-/Auskunfts-Links, nutzerinitiiert, kein Datenfluss | entfällt | aktiv | 2026-08-10 |

## Zu entfernen (Befunde, keine Absicht)

| Host(s) | Anbieter | Befund | Weg |
|---|---|---|---|
| `chart.googleapis.com` | Google | Bank-Requisition-URL als QR-Parameter (BTR-S4); API abgeschaltet **und** CSP-blockiert — Feature defekt | lokales Rendern (`qrcode`-Dependency) → **WP 0.4** |
| `cdn.jsdelivr.net` · `tessdata.projectnaptha.com` | jsDelivr / Naptha | Tesseract-Laufzeit-Downloads (BTR-S5); CSP-blockiert — OCR produktiv defekt | Assets selbst ausliefern → **WP 0.5** |

## Geplant (Programm; Zeile wird bei Inbetriebnahme „aktiv")

| Anbieter | Sitz | Rolle (künftig) | Zweck | Ab |
|---|---|---|---|---|
| Hetzner Online GmbH (Empfehlung) | DE | Subprozessor | Primär-Host: VM, Web, Empfänger, Dienste | WP 3.2 |
| OVHcloud **oder** Scaleway (Entscheid bei WP 3.3) | FR | Subprozessor | Zweitanbieter: Offsite-Backups (restic), Uptime-Überwachung | WP 3.3/3.4 |
| Codeberg e.V. | DE | Entwicklung | Git-Spiegel | WP 3.1 |
| EU-Registry (Eigenbetrieb auf VM oder EU-Anbieter, Entscheid bei WP 3.1) | EU | Entwicklung | Container-/Artefakt-Registry | WP 3.1 |
| Mollie B.V. | NL | Subprozessor | Zahlungen (PSP; Kartendaten nie bei uns) | Phase 6 |
| EU-SMTP (Entscheid bei WP 7.1) | EU | Subprozessor | Auth-/Transaktionsmails des self-hosted IdP | WP 7.1 |
| self-hosted IdP (Entscheid bei WP 7.1 gegen Kriterienkatalog WP 2.4) | EU (Eigenbetrieb) | ersetzt Supabase-Auth | Identität, OIDC | Phase 7 |

## Randnotizen

- **Referenzierte, nicht betriebene Domains:** `src/lib/constants.ts` nennt
  `support@ausgabentracker.de`, `docs.ausgabentracker.de`,
  `ausgabentracker.de/privacy`, `/terms` — nichts davon ist deployt. Werden
  real oder fliegen aus dem Code (WP 6.1).
- **FCM (Google):** heute nicht im Einsatz. Würde mit einem künftigen
  Push-Feature als **inhaltsfreier Transportadapter** eine echte
  Subprozessor-Ausnahme (Push-Token sind personenbezogen) — Eintrag erfolgt
  dann mit Begründung; UnifiedPush/self-hosted als zweiter Adapter vorgesehen
  (ADR).
- **KI-Konnektoren (Claude/ChatGPT)** ziehen Opt-in-Aggregate über den
  MCP-Endpunkt (`docs/mcp-poc.md`): kein Vertragsverhältnis von uns zum
  KI-Anbieter — der Nutzer verbindet seinen eigenen Assistenten
  (Rolle: nutzergewählt). Der Endpunkt selbst läuft bei Vercel (s. o.).

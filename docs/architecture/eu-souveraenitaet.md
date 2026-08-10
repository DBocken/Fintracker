# Anbieter und Subdienstleister sind EU-only — Software wird selbst gehostet statt als SaaS konsumiert

Status: verbindliche Konvention (ADR). **Entschieden am 2026-08-10** als
Betreiber-Vorgabe zum Betriebsprogramm (`docs/betrieb-2026-08/`), geprüft und
ausgeformt im dortigen [`audit.md`](../betrieb-2026-08/audit.md). Die
gepflegte Anbieterliste steht **nicht** hier, sondern im lebenden
[`Anbieter-Register`](../security/anbieter-register.md) — diese ADR trägt die
Regel, das Register den Stand. Durchgesetzt ab WP 0.8 durch
`pnpm check:external-endpoints`.

## Kontext

Fintracker ist local-first: Finanzdaten liegen in IndexedDB auf dem Gerät,
Cloud-Berührung ist die Ausnahme (`docs/security-boundaries.md`). Für den
Livebetrieb kommen zwangsläufig Anbieter ins Spiel — Hosting, Auth,
Bank-Anbindung, künftig Zahlungen und Telemetrie-Empfang. Eine externe
Architektur-Review (2026-08) empfahl EU-Souveränität „als Architekturprinzip,
nicht als Hosting-Checkbox"; der Betreiber hat das als Vorgabe bestätigt:
**EU-only, wenn es um Anbieter und Subdienstleister geht.**

Zum Entscheidungszeitpunkt verletzt der Ist-Zustand die Vorgabe an mehreren
Stellen, ohne dass irgendetwas rot ist (Vercel-Function in US-Region,
Supabase-Region unbekannt, QR- und OCR-Datenpfade zu US-Diensten —
`audit.md`, BTR-S2 bis BTR-S5). Das ist die eigentliche Lehre: **Eine
Anbieterregel ohne Wächter ist eine Absichtserklärung.**

## Entscheidung

### Die Regel

Anbieter und Subdienstleister, die **personenbezogene Daten unserer Nutzer**
verarbeiten, sitzen in der EU und verarbeiten in der EU. Wo Software die
Aufgabe erfüllen kann, wird sie **selbst gehostet auf EU-Infrastruktur statt
als SaaS konsumiert** — dann liegen Konten, Sessions und Daten bei uns, und
der Sitz des Software-Herstellers ist kein Subprozessor-Verhältnis.

### Die Taxonomie (nicht jede Verbindung ist ein Subprozessor)

1. **Subprozessoren** — verarbeiten personenbezogene Daten in unserem
   Auftrag (Hosting, Auth, Payments, Telemetrie-Empfang, SMTP). Hier gilt die
   Regel hart. Nicht-EU nur mit Angemessenheitsbeschluss **und** AVV **und**
   Prüfdatum **und** Registereintrag; Übergangszustände sind **befristet**
   (Registerspalte Status), nie stillschweigend.
2. **Datenquellen ohne Personenbezug** — z. B. Kurs-APIs. Zulässig auch
   außerhalb der EU unter festen Bedingungen: Abruf nur serverseitig, keine
   Nutzerkennung, keine Client-IP-Weitergabe, Fallback vorhanden. Die
   Bedingungen stehen je Zeile im Register.
3. **Nutzergewählte Drittdienste** — der Nutzer bringt seinen eigenen
   Anbieter samt eigener Zugangsdaten mit (z. B. eToro per eigenem API-Key).
   Der Drittdienst ist nicht unser Subprozessor — aber **unser Proxy davor
   ist unser Datenfluss** und steht deshalb im Register und im
   Datenschutztext.
4. **Ausgehende Links** — nutzerinitiiert, kein Datenfluss. Registerpflichtig
   nur zur Vollständigkeit des Wächters.

### Prinzipien, die aus der Regel folgen

- **Push trägt nie Inhalte.** Nur Weck-Events (`eventId`, `type`); die
  Information holt das Gerät per authentifiziertem Request vom EU-Server.
  FCM ist damit als **reiner Transportadapter** zulässig — Push-Token sind
  personenbezogen, die Ausnahme wird im Register geführt, sobald sie real
  wird; ein UnifiedPush-/self-hosted-Adapter ist als gleichwertiger zweiter
  Weg vorgesehen. Implementiert wird nichts davon ohne konkretes
  Push-Feature.
- **Telemetrie nur über die geschlossene Allowlist-Union**
  (`src/lib/telemetry-events.ts`) an den eigenen EU-Empfänger — niemals an
  Dritt-SaaS.
- **Zwei-Anbieter-Prinzip für Zustand:** Kein eigener zustandsbehafteter
  Dienst ohne Offsite-Backup bei einem **zweiten** EU-Anbieter und ohne
  automatisierte Restore-Probe.
- **Stehende Regel Datenfluss:** Jede Änderung an dem, was das Gerät
  verlässt oder wer es empfängt, liefert im selben Release Register-Update +
  Datenschutztext-Update + Wächter-Anpassung (CSP,
  `LOCAL_ONLY_SERVICES`/`CLOUD_EXCEPTION`, `check:external-endpoints`).
- **Entwicklungsplattform ≠ Betriebsplattform:** GitHub (US) berührt keine
  Nutzerdaten und bleibt Arbeitsplattform — aber Quelle und
  Produktionsartefakte existieren zusätzlich in der EU (Spiegel + Registry),
  damit Wiederherstellung nie von einem US-Anbieter abhängt.

## Verworfene Alternativen

- **„EU-Region eines US-Anbieters genügt."** Verworfen: Der Anbieter bleibt
  US-Recht unterworfen (CLOUD Act); die Region verschiebt Latenz, nicht
  Jurisdiktion. Vercel und Supabase laufen deshalb als befristete
  Übergangsausnahmen im Register, nicht als Dauerzustand.
- **Stripe für Zahlungen** (geplant in
  [#52](https://github.com/DBocken/Fintracker/issues/52)). Verworfen
  zugunsten **Mollie** (NL, DNB-beaufsichtigt) — gleicher Funktionsumfang für
  den Bedarf, EU-Sitz; #52 wird durch ein Mollie-Issue ersetzt.
- **Sentry SaaS / Dritt-Analytics.** Verworfen: Crash- und Nutzungsdaten
  reisen als eigene Allowlist-Events an den eigenen Empfänger oder gar
  nicht.
- **Strikt ohne FCM (nur UnifiedPush).** Verworfen als Pflicht, vorgesehen
  als Option: Zuverlässige Hintergrund-Zustellung auf Play-Store-Androids
  hängt real an FCM; die inhaltsfreie Event-Form macht den Kompromiss
  vertretbar, die Adapter-Architektur hält den Ausstieg offen.
- **Forgejo-Vollumzug.** Verworfen (Betreiber-Entscheidung): Betriebslast
  ohne Souveränitätsgewinn gegenüber Spiegel + EU-Registry, solange GitHub
  keine Nutzerdaten sieht.

## Preis

- **Betriebslast.** Self-Hosting von IdP, Empfänger, Registry und Backups
  ist echte, wiederkehrende Arbeit eines Solo-Betreibers — dimensioniert im
  Programm (kein Kubernetes, kein LGTM-Vollausbau, DR-Übung quartalsweise),
  aber nicht null.
- **Komfortverzicht.** Vercel-Previews, Supabase-Dashboard und
  Managed-Bequemlichkeit entfallen mit dem Umzug; Deploys, TLS und Updates
  sind eigene Verantwortung.
- **Play-Billing-Konflikt bleibt offen.** Käufe **im** Play Store erzwingen
  Google als Zahlungsweg; die Entscheidung (Web-Kauf, alternatives Billing
  nach DMA, oder Play Billing als dokumentierte Ausnahme) fällt erst mit der
  Store-Distribution.
- **Registerpflege.** Das Register muss stimmen, sonst lügt der Wächter —
  deshalb erzwingt `check:external-endpoints` die Deckung in beide
  Richtungen; die Pflege ist Preis, nicht Kür.

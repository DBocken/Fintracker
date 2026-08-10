# Fintracker Threat Model

Stand: 17.07.2026  
Scope: autorisiertes Security-Assessment der Fintracker-Web-/Mobile-App im
aktuellen Repository.

## 1. Sicherheitsziele

Fintracker ist local-first: Finanzdaten bleiben standardmäßig auf dem Gerät,
IndexedDB ist der primäre Speicher, Supabase ist nur für Auth und explizite
Opt-in-Features vorgesehen. Daraus ergeben sich diese verbindlichen Ziele:

1. Finanzdaten dürfen ohne explizites Opt-in nicht an Cloud-Dienste übertragen
   werden.
2. Bei aktivierter lokaler Verschlüsselung dürfen sensible IndexedDB-Werte nur
   als AES-GCM-Envelopes persistiert sein.
3. Supabase-Auth, Cloud-Sync, Bank-Integrationen und Markt-/Broker-Daten dürfen
   keine lokalen Daten- und Berechtigungsgrenzen umgehen.
4. Import-, Backup-, Vault-, OCR-, Bank- und Trackerverse-Inhalte gelten bis zur
   Validierung als nicht vertrauenswürdig.
5. Fehler, Logs, Analytics, Crash Reports und UI-Meldungen dürfen keine
   vollständigen Finanzdaten, Schlüssel, Tokens oder Rohdateien offenlegen.
6. Android-Builds dürfen sensible App-Daten nicht über System-Backups oder
   Klartext-Netzwerkverkehr exponieren.
7. Supply-Chain- und CI/CD-Kompromittierungen müssen durch Pinning,
   Minimalberechtigungen, Secret-Scanning und schnelle Updatefähigkeit begrenzt
   werden.

## 2. Assets

| Asset | Schutzbedarf | Begründung |
|---|---:|---|
| Transaktionen, Konten, Budgets, Kategorien, Schulden, Forderungen | Kritisch | Vollständiges Finanzprofil und potenziell sensible Freitexte. |
| Lokale AES-GCM-Schlüssel und KDF-Parameter | Kritisch | Schlüsselverlust oder -abfluss kompromittiert lokale Vertraulichkeit. |
| Backup-, Vault- und Exportdateien | Hoch | Portables Abbild lokaler Finanzdaten; hohes Exfiltrationsrisiko. |
| Supabase-Sessions, Refresh Tokens, OAuth-/Bank-Redirects | Hoch | Missbrauch ermöglicht Account- und Sync-Zugriff. |
| Bank-/GoCardless-Requisitions, Broker-/Marktdaten-Integrationen | Hoch | Externe Consent- und Kontodaten-Grenze. |
| MCP-/Cloud-Sync-Aggregate | Mittel-Hoch | Opt-in-Datenabfluss; Freitextnamen können personenbezogen sein. |
| App-Konfiguration, Feature-/Tier-Werte | Mittel | Darf UX steuern, aber keine belastbare Sicherheitsgrenze sein. |
| CI/CD-Workflows, Dependencies, Build-Artefakte | Hoch | Supply-Chain-Kompromittierung kann alle Nutzer betreffen. |

## 3. Architektur- und Datenflussmodell

```text
Nutzer:in
  -> React UI / Capacitor WebView
  -> Hooks + TanStack Query
  -> Services als einzige I/O-Schicht
      -> IndexedDB / local-finance-store / idb-kv
      -> WebCrypto / local-crypto
      -> Supabase Auth und explizite Cloud-Opt-ins
      -> GoCardless, eToro, Markt-/Quote-APIs
      -> Opt-in-Telemetrie (VITE_TELEMETRY_ENDPOINT; Voreinstellung aus,
         heute ohne konfiguriertes Ziel)
      -> Import/Export/Backup/Vault/OCR-Parser
      -> Android Runtime / Manifest / FileProvider
```

### Trust Boundaries

| Boundary | Nicht vertrauenswürdige Eingaben | Primäre Kontrollen |
|---|---|---|
| UI/URL -> Anwendung | URL-Parameter, lokale UI-Zustände, Deep Links | Routing-Guards, Allowlists, i18n-sichere Fehlermeldungen. |
| Datei/Import -> Services | CSV, JSON, PDF, OCR, Backup, Vault | zod-Schemas, Größenlimits, Parser-Härtung, explizite Bestätigung. |
| Services -> IndexedDB | lokale Finanzobjekte, Migrationen | zentrale Storage-Abstraktion, AES-GCM-Envelope-Checks, Invarianten. |
| App -> Supabase | Sessions, RLS-geschützte Daten, Edge Functions | Anon-Key-only im Client, RLS/WITH CHECK, Ownership-Prüfungen. |
| App -> externe Finanz-APIs | Bank-/Broker-/Marktdatenantworten | Consent, sichere Redirects, ID-Dedupe, Validierung, Rate Limits. |
| App -> Telemetrie-Endpunkt | Ereignisfelder der geschlossenen Union | Positivliste + Verbots-Substrings, Prüfung an der Ausgangstür, genau ein Versandweg ohne Endpunkt-Fallback (`telemetry.security.test.ts`), Opt-in aus. |
| Web -> Android | Manifest, WebView, FileProvider, Backups | `allowBackup=false`, kein Cleartext, keine unnötig exportierten Komponenten. |
| Repo -> Build/Release | Actions, Dependencies, Secrets | SHA-Pinning, minimale Permissions, pnpm Lockfile, Secret-Scan. |

## 4. Angreiferprofile

| Angreifer | Fähigkeiten | Ziele |
|---|---|---|
| Lokaler Gerätezugriff | Browser-Profil, Dateien, Android-Backup, DevTools | Finanzdaten auslesen oder manipulieren. |
| Bösartige Importdatei | Kontrolliert CSV/JSON/PDF/OCR-Inhalt | Code-/Formelinjektion, DoS, Datenkorruption. |
| XSS-/Content-Injection-Angreifer | Kontrolliert Händler-, Notiz-, Kategorie- oder API-Texte | Tokens oder IndexedDB-Daten exfiltrieren. |
| Auth-/Redirect-Angreifer | Kontrolliert Link, Callback, Deep Link oder externe URL | Session-Diebstahl, Phishing, fremde Requisition. |
| Cloud-/Sync-Angreifer | Kontrolliert fremde User-ID, Sync-Payload oder Edge-Function-Input | Mandantentrennung umgehen, Daten überschreiben. |
| Supply-Chain-Angreifer | Kompromittiert npm-Paket, Action oder Build-Script | Build-Artefakt manipulieren, Secrets abgreifen. |
| Netzwerk-/API-Angreifer | Manipuliert externe Antworten oder blockiert APIs | DoS, Datenintegritätsfehler, irreführende Salden/Kurse. |

## 5. STRIDE-Risiken

| Kategorie | Fintracker-Risiko | Priorität | Bestehende/erwartete Kontrollen |
|---|---|---:|---|
| Spoofing | OAuth-/Bank-Redirect oder Deep Link führt auf fremden Host. | Hoch | `isSafeExternalAuthUrl`, HTTPS-only, Host-Allowlist, Tests. |
| Spoofing | Lokale Tier-/Featurewerte werden als Entitlement missbraucht. | Mittel | Navigation ist keine Sicherheitsgrenze; echte Entitlements serverseitig. |
| Tampering | Manipulierte IndexedDB- oder Backup-Daten erzeugen falsche Salden. | Kritisch | zod an Datengrenzen, Domain-Invarianten, sichere Abbrüche. |
| Tampering | AES-GCM-Envelopes werden verändert oder bei deaktivierter Verschlüsselung überschrieben. | Kritisch | Envelope-Erkennung, Tamper-Tests, vollständige Key-Migration. |
| Repudiation | Sync-/Import-Konflikte sind nicht nachvollziehbar. | Mittel | Audit-Events ohne sensitive Payloads, explizite Zusammenfassungen. |
| Information Disclosure | Finanzdaten landen in `localStorage`, Logs, Fehlermeldungen oder Cloud-Aggregaten. | Kritisch | localStorage-Verbot für Finanzdaten, Privacy-Status, Log-Sanitizing. |
| Information Disclosure | XSS liest IndexedDB oder Supabase Tokens. | Kritisch | CSP, sichere Rendering-Pfade, keine fremden Scripts, Token-Hygiene. |
| Denial of Service | Große oder bösartige Import-/Backup-/OCR-Dateien blockieren UI/Storage. | Hoch | Größenlimits, Streaming/Batching, Parser-Timeouts, sichere Fehlermeldung. |
| Denial of Service | Crypto/Backup verarbeitet ganze Datenlisten und verursacht Android-OOM. | Mittel-Hoch | Chunking, Performance-Tests, progressive Verarbeitung. |
| Elevation of Privilege | Supabase RLS/Edge Function erlaubt fremde User-Daten. | Kritisch | RLS + WITH CHECK, Ownership-Prüfungen, lokale/CI-fähige Tests. |
| Elevation of Privilege | CI/CD-Workflow oder Dependency führt untrusted Code mit zu hohen Rechten aus. | Hoch | SHA-Pinning, `permissions: contents: read`, Secret-Scan, pnpm. |

## 6. Priorisierte Risiko-Hypothesen für den Pentest

1. **Lokale Datenvertraulichkeit:** Finanzdaten oder abgeleitete Klartexte liegen
   außerhalb des verschlüsselbaren Stores oder bleiben nach Aktivierung der
   Verschlüsselung im Klartext zurück.
2. **Backup/Restore-Integrität:** manipulierte, fremde oder wiederholt
   importierte Backups erzeugen Datenverdopplung, verwaiste Referenzen oder
   falsche Salden.
3. **Import-/Parser-Grenze:** CSV/JSON/PDF/OCR-Eingaben erlauben Formel-Injection,
   Prototype Pollution, schemafremde Werte, NaN/Infinity oder UI-DoS.
4. **Auth/Redirect:** externe Bank-, Broker- oder Auth-Links können ohne
   Allowlist-Validierung geöffnet werden.
5. **Cloud-Opt-in-Integrität:** MCP-/Sync-/Bank-/Market-Data-Flows übertragen
   mehr Daten als deklariert oder ohne erneutes Consent-Signal.
6. **Supabase-Mandantentrennung:** Tabellen, Edge Functions und fehlende
   Migrationen müssen RLS, `auth.uid() = user_id` und `WITH CHECK` belegen.
7. **Android-Härtung:** Manifest, Netzwerk-Config und FileProvider dürfen keine
   sensiblen Daten über Backup, Cleartext oder exportierte Komponenten öffnen.
8. **Supply Chain:** nicht gepinnte Actions, Secrets, riskante Package-Scripts
   oder bekannte CVEs können den Build kompromittieren.

## 7. Zero-Day- und Zero-Trust-Prinzipien

Zero-Days werden nicht als einzelne Testfälle verstanden, sondern als
Resilienzanforderung:

- **Angriffsfläche minimieren:** keine unnötigen Cloud-Flows, Drittanbieter-Scripts,
  Android-Permissions oder Dependencies.
- **Least Privilege:** Supabase-Client nur mit Anon-Key, RLS serverseitig,
  GitHub Actions mit minimalen Permissions, keine Secrets im Client.
- **Exploit-Begrenzung:** CSP, `nosniff`, `no-store` für Finanz-APIs, zod-Schemas,
  sichere Parser, AES-GCM, Android-Cleartext-Verbot.
- **Schnelle Patchfähigkeit:** pnpm Lockfile, dependency monitoring, CISA-KEV-
  Abgleich, Security-Regressionstests, dokumentierter Hotfix-Prozess.
- **Privacy-preserving Detection:** Security-Events nur ohne Finanzpayloads,
  keine Rohdateien in Logs, Import-/Sync-Fehler aggregiert auswertbar machen.

## 8. Offene Annahmen und Klärpunkte

- Welche Supabase-Tabellen existieren produktiv zusätzlich zu versionierten
  Migrationen?
- ~~Welche Sync-/MCP-/Bank-Features sind aktuell produktiv aktiviert und welche
  nur Feature-Flag-/Alpha-Funktion?~~ Repo-Antwort seit #291:
  `src/lib/feature-flags.ts` (vier Flags samt Voreinstellung — `telemetry` aus,
  `bankSync` aus, `feedback` an, `financeCity3d` an) und `src/lib/tier.ts`
  (`ACCESS_CODES`). Offen bleibt nur, welche Voreinstellung ein Store-Build
  tatsächlich ausliefert.
- Welche Testumgebung darf externe Bank-/Broker-/Supabase-Aufrufe ausführen?
- Gibt es produktive Crash-/Analytics-Provider, die nicht im Repo ersichtlich
  sind?
- Welche Android-Release-Konfiguration ist maßgeblich für Store-Builds?

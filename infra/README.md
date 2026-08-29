# infra/ — EU-Betriebsinfrastruktur als Code

Dieses Verzeichnis setzt WP 3.2/3.3 des Betriebsprogramms um, soweit das ohne
Anbieter-Konten möglich ist: **Jede Einstellung lebt als Datei im Repo, nichts
nur im Dashboard.** Die Auswahl der Werkzeuge ist begründet in
[`docs/betrieb-2026-08/recherche-observability-2026-08.md`](../docs/betrieb-2026-08/recherche-observability-2026-08.md)
(Abschnitt „Anbindungs-Empfehlung"); die Arbeitspakete samt Akzeptanzkriterien
stehen in [`docs/betrieb-2026-08/plan.md`](../docs/betrieb-2026-08/plan.md).

## Das Bild

```
Primär-Host (Hetzner, DE)                Zweitstandort (OVHcloud ODER Scaleway, FR)
┌───────────────────────────┐            ┌────────────────────────────────────┐
│ Caddy (TLS)               │            │ Caddy (TLS)                        │
│ Telemetrie-Empfänger      │  restic    │ Uptime Kuma                        │
│   (entsteht in WP 3.4)    │ ─────────► │   • HTTP-Checks auf Primär + App   │
│ später: App, MCP (WP 3.5) │  Backup    │   • Push-Monitore (Dead-Man)       │
│                           │            │   • öffentliche Statusseite        │
│ backup.sh (Cron, täglich) │            │ Object Storage (restic-Repo)       │
└───────────────────────────┘            │ restore-probe.sh (Cron, wöchentl.) │
                                         └────────────────────────────────────┘
```

Warum genau diese Aufteilung: Die Überwachung **und** die Backups liegen beim
zweiten Anbieter (Zwei-Anbieter-Prinzip der ADR
[`eu-souveraenitaet.md`](../docs/architecture/eu-souveraenitaet.md)) — ein
Ausfall des Primär-Hosts nimmt weder die Messung noch die Sicherung mit. Die
Statusseite ist die von Uptime Kuma (bewusst **keine** Eigenentwicklung: sie
wäre ein neuer zustandsbehafteter Dienst, der selbst wieder Backup und
Überwachung bräuchte) und liegt am Zweitstandort, damit sie erreichbar ist,
wenn die App es nicht ist.

## Dateien

| Datei | Zweck |
|---|---|
| [`cloud-init.yaml`](cloud-init.yaml) | Identische Grund-Härtung **beider** VMs (Ubuntu 24.04 LTS): SSH-only, ufw, fail2ban, unattended-upgrades, Docker. Eine Datei für beide Hosts, damit nichts driftet |
| [`primary/docker-compose.yml`](primary/docker-compose.yml) · [`primary/Caddyfile`](primary/Caddyfile) | Primär-Host: Caddy; der Telemetrie-Empfänger ist als Platzhalter kommentiert (WP 3.4 baut ihn test-first) |
| [`secondary/docker-compose.yml`](secondary/docker-compose.yml) · [`secondary/Caddyfile`](secondary/Caddyfile) | Zweitstandort: Uptime Kuma hinter Caddy, `status.<domain>` |
| [`backup/backup.sh`](backup/backup.sh) | Tägliches restic-Backup Primär → Zweitstandort-Object-Storage; Heartbeat **nur bei Erfolg** |
| [`backup/restore-probe.sh`](backup/restore-probe.sh) | Wöchentliche Restore-Probe am Zweitstandort („Backup ist erst ein Backup, wenn Restore getestet wurde"); eigener Heartbeat |
| [`backup/crontab.example`](backup/crontab.example) | Cron-Einträge beider Hosts |
| [`monitoring/monitors.md`](monitoring/monitors.md) | **Quelle der Wahrheit** für die Kuma-Monitore, Alarmkanäle und die Statusseiten-Sichtbarkeit — Kuma speichert seine Konfiguration in einer eigenen SQLite; dieses Dokument ist die Wiederherstellungsanleitung |

## Betreiber-Checkliste (manuell, in dieser Reihenfolge)

Nur diese Schritte brauchen einen Menschen mit Konten und DNS — alles andere
kommt aus den Dateien hier. Jeder Haken mit Beleg unter
`docs/betrieb-2026-08/belege/`. Was das kostet und warum genau diese Tarife:
Abschnitt 8 der
[Observability-Recherche](../docs/betrieb-2026-08/recherche-observability-2026-08.md)
— zusammen rund **11 €/Monat netto** (Primär-VM ~5,50 €, Zweitstandort-VM
~4–6 €, Object Storage ~0,25 €, Domain ~0,39 €, SMTP-Alarme im Free-Tarif).

1. [ ] **SSH-Schlüssel** erzeugen (`ed25519`), öffentlichen Schlüssel in
       `cloud-init.yaml` an der Platzhalter-Stelle einsetzen (nur lokal,
       nicht committen — oder als Fork der Datei am Ort der Nutzung).
2. [ ] **Hetzner-Konto** (2FA!) → VM (kleinste Stufe reicht zu Beginn,
       Ubuntu 24.04) mit `cloud-init.yaml` provisionieren. Beleg WP 3.2
       verlangt den **Zweitlauf**: VM löschen, erneut provisionieren,
       identisches Ergebnis.
3. [ ] **Zweitanbieter entscheiden** — OVHcloud **oder** Scaleway (beide FR;
       das Register führt beide als Kandidaten). Entscheidung mit einem Satz
       Begründung in der Registerzeile konkretisieren
       ([`anbieter-register.md`](../docs/security/anbieter-register.md)).
       Konto (2FA) → Object Storage (S3-kompatibel, restic-Repo) + kleine VM
       mit derselben `cloud-init.yaml`.
4. [ ] **DNS**: `status.<domain>` → Zweitstandort-VM; Telemetrie-Hostname →
       Primär-VM. Kurze TTL, solange der Betrieb jung ist. Die
       Platzhalter-Domains in beiden `Caddyfile`s ersetzen.
5. [ ] **Compose starten** (je Host das passende Verzeichnis nach
       `/opt/fintracker/infra/` bringen, `.env` mit Rechten `600` anlegen —
       Secrets niemals ins Repo).
6. [ ] **Uptime Kuma einrichten** nach [`monitoring/monitors.md`](monitoring/monitors.md):
       Monitore, Alarmkanal (EU-SMTP gemäß Register; optional ntfy),
       Statusseite veröffentlichen. Die Push-Monitor-URLs (enthalten Token!)
       in die `.env` der Cron-Hosts eintragen.
7. [ ] **Backups scharf**: `backup.sh` auf dem Primär-Host, `restore-probe.sh`
       am Zweitstandort per Cron ([`crontab.example`](backup/crontab.example)).
       Akzeptanz WP 3.3: zwei Wochen Signale **und** ein belegter Alarm bei
       absichtlich unterdrücktem Signal.

## Was hier ausdrücklich NICHT liegt

- **Der Telemetrie-Empfänger** — WP 3.4 baut ihn test-first als eigenen
  Dienst (geteiltes zod-Schema mit `src/lib/telemetry-events.ts`, append-only,
  keine IP-Persistenz). Der Compose-Platzhalter markiert nur die Naht.
  `VITE_TELEMETRY_ENDPOINT` bleibt bis Phase 4 unkonfiguriert (stehende
  Regel: Register + CSP + Datenschutztext im selben Release wie der Versand).
- **OTel/LGTM/SigNoz** — erst ab der Ausbau-Schwelle aus WP 4.5. Zu Beginn
  genügen die Kuma-Checks und die Docker-Logs mit Rotation.
- **Secrets** — restic-Passwort, S3-Schlüssel, Heartbeat-URLs, SMTP-Zugang:
  nur in `.env`-Dateien auf den Hosts (Rechte `600`), nie im Repo
  (`pnpm security:secrets` ist der Zaun, aber die Regel gilt davor).

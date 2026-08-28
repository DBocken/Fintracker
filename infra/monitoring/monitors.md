# Uptime-Kuma-Monitore — Quelle der Wahrheit

Uptime Kuma speichert seine Konfiguration in einer eigenen SQLite auf der
Zweitstandort-VM, und die wird bewusst nicht extern gesichert (zirkulär —
siehe `secondary/docker-compose.yml`). **Dieses Dokument ist deshalb die
verbindliche Beschreibung**: Nach jeder Monitor-Änderung in Kuma wird es
nachgeführt, und aus ihm ist die Überwachung nach Totalverlust in Minuten
wiederherstellbar.

## HTTP-Monitore (aktive Checks)

| Name | Ziel | Intervall | Ab wann |
|---|---|---|---|
| `app-web` | `https://fintracker-phi.vercel.app/` (Übergang; nach WP 3.5 die eigene Domain) — erwartet 200 | 60 s | sofort |
| `telemetrie-empfaenger` | `https://telemetrie.<domain>/healthz` — erwartet 200 | 60 s | ab WP 3.4 |
| `entitlements` | `https://<domain-des-dienstes>/healthz` — erwartet 200 und Body `{"ok":true}` (Keyword-Check) | 60 s | ab Deployment des EntitlementService (Phase 6 auf dem EU-Host) |
| `primaer-host-tls` | Zertifikatsablauf des Primär-Hosts (Kuma prüft das im HTTP-Monitor mit; Benachrichtigung ab 14 Tagen Restlaufzeit aktivieren) | — | ab WP 3.2 |

Bewusst **kein** Monitor auf Supabase- oder Vercel-Statusseiten: Fremd-Status
überwachen heißt Rauschen abonnieren — was zählt, ist die eigene Fläche, und
die messen `app-web` und später die eigenen Dienste.

## Push-Monitore (Dead-Man: Alarm beim AUSBLEIBEN des Signals)

| Name | Sender | Erwartung | Alarm nach |
|---|---|---|---|
| `backup-primaer` | `backup/backup.sh` (Primär-Host, täglich 02:17 UTC) | alle 24 h | 26 h Stille |
| `restore-probe` | `backup/restore-probe.sh` (Zweitstandort, montags 04:43 UTC) | alle 7 Tage | 8 Tagen Stille |

Die Push-URLs enthalten Token → sie stehen ausschließlich in den `.env`-Dateien
der jeweiligen Hosts (`HEARTBEAT_URL_BACKUP`, `HEARTBEAT_URL_RESTORE`), nie im
Repo und nie in diesem Dokument.

## Alarmkanäle

1. **E-Mail über EU-SMTP** (Anbieter gemäß Register-Zeile „EU-SMTP, geplant";
   beim Einrichten konkretisieren). Primärer Kanal, an alle Monitore
   gebunden.
2. **ntfy** (optional, Push aufs Telefon): nur self-hosted auf einer der
   beiden VMs oder als weiterer Registereintrag — kein stiller Drittanbieter
   für Alarme, die Hostnamen der eigenen Infrastruktur enthalten.

## Statusseite

- Veröffentlicht unter `status.<domain>` (Zweitstandort — erreichbar, wenn
  der Primär-Host es nicht ist).
- **Öffentlich sichtbar:** `app-web`, später `telemetrie-empfaenger` und
  `entitlements` unter sprechenden Namen („Web-App", „Telemetrie",
  „Kauf/Abo").
- **Nicht öffentlich:** die Push-Monitore (`backup-primaer`,
  `restore-probe`) und `primaer-host-tls` — Backup-Rhythmen und
  Zertifikatslaufzeiten sind Betriebsinterna, keine Nutzerinformation.
- Verlinkt die App später auf die Statusseite, ist das ein **ausgehender
  Link** (Rolle 4 im Anbieter-Register) — eigene Registerzeile, kein
  CSP-Eintrag nötig.

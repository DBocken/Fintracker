#!/usr/bin/env bash
# Wöchentliche Restore-Probe am ZWEITSTANDORT — WP 3.3: „Backup ist erst ein
# Backup, wenn Restore getestet wurde", und zwar automatisch, nicht als
# guter Vorsatz. Läuft bewusst auf der anderen VM als das Backup: Sie beweist
# damit auch, dass der Zugriff aufs Repo von einem zweiten Ort funktioniert.
#
# Eigener Heartbeat, eigener Push-Monitor (wöchentliche Erwartung) — der
# Backup-Heartbeat sagt „geschrieben", dieser sagt „lesbar". Das sind zwei
# verschiedene Aussagen, und nur die zweite zählt im Ernstfall.
#
# Konfiguration über /opt/fintracker/infra/backup/.env (Rechte 600):
#   RESTIC_REPOSITORY / RESTIC_PASSWORD_FILE / AWS_*   wie backup.sh
#   HEARTBEAT_URL_RESTORE    Push-Monitor-URL aus Uptime Kuma

set -euo pipefail

ENV_FILE="$(dirname "$0")/.env"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt (.env)}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt (.env)}"
: "${HEARTBEAT_URL_RESTORE:?HEARTBEAT_URL_RESTORE fehlt (.env)}"

PROBE_DIR="$(mktemp -d /tmp/fintracker-restore-probe.XXXXXX)"
cleanup() { rm -rf "$PROBE_DIR"; }
trap cleanup EXIT

restic restore latest --target "$PROBE_DIR"

# Die Probe muss INHALT ergeben — ein leeres Restore ist ein Fehlschlag,
# kein Erfolg mit null Dateien.
[ -n "$(find "$PROBE_DIR" -type f -print -quit)" ]

# Leseprobe über einen rotierenden Ausschnitt der echten Daten (5 % je Lauf,
# über die Wochen kommt alles dran) — deckt stille Bitfäule im Repo auf.
restic check --read-data-subset=5%

curl -fsS --max-time 10 --retry 3 "$HEARTBEAT_URL_RESTORE" > /dev/null

#!/usr/bin/env bash
# Tägliches Backup des Primär-Hosts ins restic-Repo beim Zweitanbieter
# (S3-kompatibler Object Storage) — WP 3.3.
#
# Dead-Man-Prinzip: Der Heartbeat wird NUR bei Erfolg gesendet. Der Alarm
# entsteht in Uptime Kuma durch das AUSBLEIBEN des Signals — nicht durch
# eine Fehlermeldung, die ein sterbender Host nie mehr absetzen würde.
#
# Konfiguration über /opt/fintracker/infra/backup/.env (Rechte 600, nie im
# Repo):
#   RESTIC_REPOSITORY        z. B. s3:https://<endpoint>/<bucket>/restic
#   RESTIC_PASSWORD_FILE     Pfad zur Passwortdatei (Rechte 600)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   Zugang zum Object Storage
#   BACKUP_PATHS             Leerzeichen-getrennt; Standard unten
#   HEARTBEAT_URL_BACKUP     Push-Monitor-URL aus Uptime Kuma (enthält Token)

set -euo pipefail

ENV_FILE="$(dirname "$0")/.env"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt (.env)}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt (.env)}"
: "${HEARTBEAT_URL_BACKUP:?HEARTBEAT_URL_BACKUP fehlt (.env)}"
BACKUP_PATHS="${BACKUP_PATHS:-/opt/fintracker /var/lib/docker/volumes}"

# Repo beim allerersten Lauf anlegen (idempotent).
restic snapshots > /dev/null 2>&1 || restic init

# shellcheck disable=SC2086 — BACKUP_PATHS ist absichtlich wortgesplittet.
restic backup ${BACKUP_PATHS} \
  --exclude '/var/lib/docker/volumes/**/caddy_data' \
  --tag primaer-taeglich

# Aufbewahrung: 14 Tage täglich, 8 Wochen wöchentlich, 12 Monate monatlich.
restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune

# Strukturprüfung bei jedem Lauf; die Daten-Leseprobe macht restore-probe.sh.
restic check

curl -fsS --max-time 10 --retry 3 "$HEARTBEAT_URL_BACKUP" > /dev/null

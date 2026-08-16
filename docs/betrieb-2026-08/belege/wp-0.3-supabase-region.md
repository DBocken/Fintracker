# WP 0.3 — Supabase-Region festgestellt

> **Beleg, kein Regeltext.** Protokolliert eine Feststellung mit Datum. Die
> geltende Regel steht in [`eu-souveraenitaet.md`](../../architecture/eu-souveraenitaet.md),
> der gepflegte Stand im [`Anbieter-Register`](../../security/anbieter-register.md).

**Festgestellt am:** 2026-08-16
**Quelle:** Supabase-Dashboard, Projektübersicht (Auszug vom Betreiber)
**Nächste Prüfung:** 2027-02 (halbjährlich, siehe Register)

## Feststellung

| Feld | Wert |
|---|---|
| Projekt | `fintracker` |
| Projekt-URL | `https://pbopyawkxxrluhofjtub.supabase.co` |
| Primary Database | **North EU (Stockholm)** |
| Region-Kennung | `eu-north-1` |
| Instanz | `t4g.nano` (Compute `NANO`) |
| Status | Healthy |

Die Projekt-URL ist deckungsgleich mit der Registerzeile und mit
`src/integrations/supabase/client.ts` — der Auszug betrifft nachweislich das
Projekt, das die App benutzt.

## Bewertung

**Die Datenregion liegt in der EU.** Schweden ist seit 1995 Mitglied. Damit ist
der Entscheidungspunkt aus WP 0.3 („**wenn** Nicht-EU: Übergang befristet
akzeptieren vs. Phase 7 vorziehen") **nicht** ausgelöst; die Reihenfolge des
Programms bleibt wie geplant — Phase 6 vor Phase 7.

**Das entlastet den Anbieter nicht.** Die ADR hat den Fall vorweggenommen und
verworfen: „*EU-Region eines US-Anbieters genügt.* — Der Anbieter bleibt
US-Recht unterworfen (CLOUD Act); die Region verschiebt Latenz, nicht
Jurisdiktion." Supabase Inc. ist ein US-Unternehmen. Die Feststellung senkt die
**Dringlichkeit** der Ablösung, nicht ihre Notwendigkeit; die Registerzeile
bleibt „Übergang, befristet".

## Zwei Nebenbefunde aus demselben Auszug

Beide standen nicht im Auftrag von WP 0.3, sind aber zu protokollieren, weil
sie eine Annahme des Audits berühren.

### 1. `Last Backup: No backups`

BTR-10 in [`audit.md`](../audit.md) hält fest: „Serverseitig gibt es heute kaum
eigenen Zustand — *Supabase managed die wenigen Tabellen*." Das trifft so nicht
zu. In dem Projekt liegen laut Register die **Auth** (E-Mail/OAuth, also Konten
und bcrypt-Hashes), MCP-Aggregate, Bank-Sync-Artefakte, Rate-Limits und das
Kategorie-Template.

Die Tragweite steht bereits im Plan: WP 7.2 setzt einen „Export aus Supabase
(bcrypt-Hashes, E-Mails, IDs)" als Quelle des ID-erhaltenden Imports voraus.
Ohne Sicherung gibt es diese Quelle nicht, wenn das Projekt verloren geht —
Bestandsnutzer verlören ihren Zugang dauerhaft. Local-first rettet dabei die
**Finanzdaten** (IndexedDB, auf dem Gerät), nicht die Identität.

### 2. `Last Migration: No migrations`

Das Repo führt 17 Dateien unter `supabase/migrations/`, und **kein CI-Schritt
wendet sie an** (geprüft: `.github/workflows/*.yml`) — dasselbe Muster, das
AGENTS.md §11 für Edge Functions bereits als Betriebsreibung benennt. Das
Schema wurde ausserhalb des Migrationssystems aufgespielt; ein belegter Weg vom
Repo zum Schema existiert nicht.

### Einordnung und Entscheidung

Beide Punkte sind aus einem Dashboard-Auszug gelesen, nicht am Projekt
verifiziert: „No backups" kann am Tarif liegen (`NANO`), „No migrations" kann
ein vollständiges, aber ungetracktes Schema bedeuten.

**Betreiber-Entscheidung vom 2026-08-16: an Supabase wird nichts geändert.**
Beide Lücken werden beim EU-Zweitanbieter von vornherein nicht entstehen —
Backup- und Migrationsinfrastruktur für ein System zu bauen, das Phase 7
abschaltet, wäre Arbeit gegen den eigenen Plan. Als Bauvorgaben wandern sie in
WP 6.2 (EntitlementService): nachverfolgte Migrationen mit CI-Anwendung und
Restore-Probe, bevor der Dienst den ersten echten Datensatz hält — das ist
genau das „vom ersten Tag an" aus BTR-10.

**Offen bleibt:** der AVV-Status (→ WP 0.9) und die Restlaufzeit-Bedingung —
bis zum Cutover ist die Auth-Datenbank ohne Sicherung, und ab WP 6.2 hängt an
ihren userIds das bezahlte Abo. Empfehlung zum Verkaufsstart siehe WP 6.3.

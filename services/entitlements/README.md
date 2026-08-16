# EntitlementService

Serverseitige, widerrufbare Berechtigungen an der **internen userId** — der
erste EU-souveräne Dienst der App (WP 6.2) und zugleich die Generalprobe für
die Supabase-Ablösung in Phase 7.

> **Nicht bei Supabase.** Die ADR
> [`supabase-abloesung.md`](../../docs/architecture/supabase-abloesung.md)
> verhängt einen Neubau-Stopp: keine neuen Tabellen, Functions oder
> `auth`-Aufrufstellen. Neue serverseitige Fähigkeiten entstehen auf
> EU-Infrastruktur. Dieser Dienst ist deshalb portabel gebaut; das Deployment
> wartet auf den Host aus WP 3.2/3.3.

## Was er speichert — und was nicht

| Gespeichert | Nie gespeichert |
|---|---|
| `userId` (intern, WP 2.1) · `product` · `validUntil` · `source` | Kartendaten |
| `mollie_customer_id` · `mollie_subscription_id` | Betrag, Adresse, Zahlungsverlauf |

Kartendaten sieht der Dienst nie: Der Kauf läuft über Mollies gehostete
Checkout-Seite, der Browser wird dorthin weitergeleitet. „Kartendaten nie bei
uns" ist damit eine Struktureigenschaft, kein Versprechen.

## Die vier tragenden Eigenschaften

1. **Dem Webhook-Rumpf wird nicht geglaubt.** Mollie liefert nur eine
   Payment-ID; Status und Zuordnung holt der Dienst über die authentifizierte
   Mollie-API zurück. Ein gefälschter Aufruf kann damit nur eine ID
   *behaupten*.
2. **Idempotenz** über `(payment_id, status)`. Mollie stellt bei
   Zeitüberschreitung erneut zu — ohne Dedupe verlängert jede Wiederholung das
   Abo weiter.
3. **Issuer ist Konfiguration** (`AUTH_JWKS_URL`, `AUTH_ISSUER`). Phase 7
   tauscht zwei Umgebungsvariablen, keine Zeile Code.
4. **Der Nutzer kommt nur aus dem Token.** Es gibt keinen Parameter, über den
   jemand nach fremden Berechtigungen fragen könnte (Messlatte aus
   [#298](https://github.com/DBocken/Fintracker/issues/298)).

## Lokal starten

```bash
pnpm --dir services/entitlements install --ignore-workspace
cp .env.example .env          # Werte eintragen (Mollie-Testmodus genügt)
docker compose up -d db
pnpm --dir services/entitlements migrate
pnpm --dir services/entitlements dev
```

## Migrationen — der belegte Weg vom Repo zum Schema

Das Supabase-Projekt zeigt `Last Migration: No migrations`, während das Repo
17 SQL-Dateien führt und **kein CI-Schritt** sie anwendet (Beleg:
[`belege/wp-0.3-supabase-region.md`](../../docs/betrieb-2026-08/belege/wp-0.3-supabase-region.md)).
Damit ist unbekannt, welche Schritte tatsächlich im Schema stehen — genau die
Auskunft, die man für eine Wiederherstellung braucht.

Hier ist das anders gelöst, und der Unterschied liegt nicht in der
Versionstabelle, sondern in der **Prüfsummen-Kontrolle**:

- Eine nachträglich **geänderte** Migration bricht den Lauf ab. Sonst
  entstünde ein Schema, das mit dem Repo nicht mehr übereinstimmt, ohne dass
  irgendetwas rot wird. Korrekturen gehören in eine **neue** Migration.
- Eine angewandte, aber im Repo **verschwundene** Migration bricht ebenfalls
  ab — dann beschreibt das Repo das Schema nicht mehr vollständig.
- Doppelte Versionsnummern und nachträglich eingeschobene kleinere Nummern
  werden abgelehnt.

Die Regeln stehen in `src/db/migrations.ts` und sind **ohne Datenbank**
getestet; CI wendet sie zusätzlich gegen ein Wegwerf-Postgres an und beweist
damit, dass ein leeres Postgres allein aus dem Repo auf Stand kommt.

## Sicherung und Restore-Probe

BTR-10 gilt ab dem ersten eigenen Zustand: *„Kein eigener zustandsbehafteter
Dienst ohne Backup beim Zweitanbieter und ohne automatisierte Restore-Probe —
vom ersten Tag an."* Dieser Dienst ist dieser erste Zustand.

Portabel mitgeliefert (der Rest ist WP 3.3 und wartet auf den Host):

```bash
# Sicherung
pg_dump --format=custom --no-owner "$DATABASE_URL" > entitlements-$(date -u +%Y%m%dT%H%M%SZ).dump

# Restore-Probe: in eine WEGWERF-Datenbank, nie ins Original
createdb entitlements_probe
pg_restore --dbname=entitlements_probe --no-owner entitlements-<stempel>.dump

# Integritaetspruefung: Zeilen da, und keine Berechtigung ohne Ende
psql entitlements_probe -c "SELECT count(*) FROM entitlements;"
psql entitlements_probe -c "SELECT count(*) FROM entitlements WHERE valid_until IS NULL;"  -- muss 0 sein
```

> „Backup ist erst ein Backup, wenn Restore getestet wurde." Die Probe gehört
> in den Cron aus WP 3.3 samt Dead-Man-Alarm (Alarm beim **Ausbleiben** des
> Erfolgssignals, nicht beim Fehlschlag).

**Warum das hier schon steht, obwohl die Tabelle noch leer ist:** Solange sie
leer ist, ist die Einrichtung billig. Sobald sie Abos enthält, ist sie teuer —
und ein Verlust nicht mehr reparabel, sondern nur noch erstattbar.

## Grenzen, benannt

- **Kein Deployment.** Der Dienst läuft lokal und in CI; der EU-Host entsteht
  in WP 3.2/3.3.
- **Kein Echtgeld.** Bis WP 6.1 (Mollie-Konto, AVV, USt/OSS, Rechtstexte)
  läuft alles im Testmodus.
- **Kein Rate-Limiting.** Der Webhook ist offen erreichbar; das ist zulässig,
  weil ihm nichts geglaubt wird ausser der ID, aber eine Drosselung gehört vor
  den Produktivbetrieb.

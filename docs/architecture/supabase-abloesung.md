# Supabase wird jetzt entkoppelt und mittelfristig abgelöst — ab sofort gilt ein Neubau-Stopp

Status: verbindliche Konvention (ADR). **Entschieden am 2026-08-10**
(Betreiber-Entscheidung im Betriebsprogramm, Optionen abgewogen in
[`docs/betrieb-2026-08/audit.md`](../betrieb-2026-08/audit.md), BTR-3).
Umsetzung: Phase 2 (Naht) und Phase 7 (Ablösung) in
[`docs/betrieb-2026-08/plan.md`](../betrieb-2026-08/plan.md). Durchgesetzt ab
WP 2.3 durch `pnpm check:supabase-boundary` (Ratsche + Bestandsliste).

## Kontext

Supabase trägt heute genau vier Rollen: optionale Auth (E-Mail/OAuth), fünf
Edge Functions als Geheimnis-Broker (`gocardless-sync`, `market-quotes`,
`etoro-proxy`, `refresh-balances`, `delete-account`), eine Handvoll Tabellen
(MCP-Aggregate, Bank-Sync-Artefakte, Rate-Limits, Kategorie-Template) und die
Auth-Mails. Der Datenbestand der App liegt local-first auf dem Gerät —
Supabase ist schmal, aber an 15 Stellen in 8 Dateien direkt verwachsen
(`supabase.auth.*`), und `AuthProvider` exportiert rohe Supabase-Typen in den
React-Kontext.

Supabase Inc. ist ein US-Unternehmen; auch mit EU-Region bleibt es US-Recht
unterworfen. Das kollidiert mit der EU-only-Regel
([`eu-souveraenitaet.md`](eu-souveraenitaet.md)). Zusätzlich deployen Edge
Functions nicht automatisch (AGENTS.md §11-Ritual) — eine wiederkehrende
Betriebsreibung, die zwei offene „Deployment ausstehend"-Issues erzeugt hat.

## Entscheidung

**Jetzt (Phase 2):** Die App programmiert gegen eine eigene Naht, nicht gegen
Supabase-Interna —

- ein internes `Identity`-Modell mit **stabiler interner userId** (das
  IdP-Subject ist ein Anbieterdetail; die Zuordnungsregel macht den späteren
  Issuer-Wechsel zur Konfiguration statt zur Datenmigration),
- `auth-service` als einzige Stelle für Token, Login, Logout, Session
  (Capacitor-Deep-Link-Bridge ruft dieselbe Naht),
- keine Supabase-Typen außerhalb der Naht.

**Ab sofort: Neubau-Stopp.** Keine neuen Supabase-Tabellen, -Functions oder
-`auth`-Aufrufstellen. Neue serverseitige Fähigkeiten entstehen auf der
EU-Infrastruktur des Programms (ab Phase 3). Sicherheitsrelevante Fixes am
Bestand bleiben ausdrücklich frei. Der Wächter kennt die Bestandsliste; die
Ratsche darf nur sinken.

**Mittelfristig (Phase 7):** Ablösung durch self-hosted IdP (Entscheidung
gegen den Kriterienkatalog aus WP 2.4 — Pflichtkriterium **ID-erhaltender
Nutzerimport** der bcrypt-Hashes) + eigenes Postgres + portierte Services auf
EU-Infrastruktur. Cutover-Bedingungen: Löschpfad-Parität (Art. 17) **vor**
jeder Datenbewegung, Zwei-Nutzer-Autorisierungstest im Zielsystem (Messlatte
aus [#298](https://github.com/DBocken/Fintracker/issues/298)),
Rollback-Fenster mit lesbarem Supabase-Bestand.

## Verworfene Alternativen

- **Sofortige Ablösung.** Verworfen: Ohne die Naht wäre der Umbau riskant
  (15 verwachsene Stellen), und vor dem ersten EU-Standbein gäbe es kein
  Ziel, auf das man ablösen könnte. Die Naht ist billig, die Ablösung teuer —
  in dieser Reihenfolge sinkt das Risiko beider.
- **Dauerhaft behalten mit EU-Region.** Verworfen: Region verschiebt nicht
  die Jurisdiktion (CLOUD Act); widerspräche der EU-only-ADR dauerhaft statt
  befristet. Bis zur Ablösung läuft Supabase als **befristete
  Übergangsausnahme** im Anbieter-Register.
- **Supabase self-hosted.** Verworfen: Die ganze Plattform (GoTrue, PostgREST,
  Storage, Realtime, Studio) selbst zu betreiben ist Überbau für „Auth +
  wenige Tabellen + fünf kleine Services" — IdP + Postgres + eigene Services
  sind der kleinere, wartbarere Zuschnitt.
- **IdP-Wahl heute festlegen (z. B. ZITADEL).** Verworfen: Angebote und
  Fakten altern bis Phase 7; auch die externe Review empfahl, Anbieterwahl
  erst vor Umsetzung erneut zu prüfen. Entschieden werden heute die
  **Anforderungen** (WP 2.4), nicht der Name — die Wahl wird eine eigene ADR.

## Preis

- **Doppelbetrieb im Übergang.** Ab Phase 6 laufen EU-Dienste neben Supabase;
  ab Phase 7 zeitweise zwei Auth-Systeme mit Rollback-Fenster — mehr
  Betriebsfläche, bewusst bezahlt für einen Cutover ohne Bruch für
  Bestandsnutzer.
- **Migrationsrisiko Nutzerbestand.** bcrypt-Export und ID-erhaltender Import
  sind machbar, aber unverzeihlich bei Fehlern — deshalb Testkreis,
  Entitlement-Kontinuitätstest und Rollback-Protokoll als Akzeptanzkriterien,
  nicht als Hoffnung.
- **Der Neubau-Stopp kostet Bequemlichkeit.** Kleine serverseitige Wünsche
  können nicht mehr „schnell als Edge Function" entstehen, sondern warten auf
  das EU-Standbein (Phase 3) — das ist Absicht: Jede neue Supabase-Fläche
  vergrößerte die Ablösemasse.

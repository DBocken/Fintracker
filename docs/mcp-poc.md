# MCP-Sprach-/KI-Zugriff — Proof of Concept

Ziel: Finanzfragen wie „Wie viel habe ich diesen Monat für Lebensmittel
ausgegeben?" per Sprache/Chat aus **Claude** oder **ChatGPT** beantworten lassen
— gestützt auf die Daten dieser App.

> **Wichtig:** Dies ist ein **Proof of Concept**, der das **Local-only-Designkonzept
> der App bewusst aufweicht**. Es ist standardmäßig aus und nur über eine
> doppelte rote Bestätigung aktivierbar.

## Warum das nötig ist (die harten Grenzen)

- Ein MCP-Client (Claude/ChatGPT) kann **nicht** direkt in einen offenen
  Browser-Tab greifen. MCP läuft über stdio/HTTP zwischen Client und einem
  Server-Prozess, nie zum DOM.
- Fintracker ist **local-first mit verschlüsseltem IndexedDB-Vault**; Klartext
  existiert nur im entsperrten Tab.
- ChatGPT-Connector verlangen einen **öffentlichen HTTPS-Server** (kein lokaler
  stdio-Prozess, kein `localhost`). Damit Sprache/Chat vom Handy die Daten
  erreichen, muss ein Endpunkt erreichbar sein → Cloud.
- **Voice-Realität (Stand Mitte 2026):** Weder ChatGPTs Advanced Voice noch
  Claudes Voice-Chat lösen MCP-Tools aus — nur **Text-Chat** tut das. „Per
  Sprache auf dem Handy" = **Diktat** in das Textfeld, kein Freisprechen.

## Architektur

```
Claude/ChatGPT (Text-Chat, Eingabe per Diktat)
        │  MCP über HTTPS (JSON-RPC), Token im Pfad: /api/mcp/<token>
        ▼
Vercel-Function  api/mcp/[token].ts   (gleiche Domain wie die App!)
        │  liest token-gegatet via RPC get_mcp_snapshot (anon-Key, KEIN Secret)
        ▼
Supabase: mcp_aggregate_snapshots (1 Aggregat-Snapshot pro Nutzer, RLS)
        ▲
        │  Upsert NUR von Aggregaten, nur nach doppelter Bestätigung
Fintracker Web-App (entsperrter Vault)
  └─ src/services/cloud-mcp-sync-service.ts  (die einzige Cloud-Ausnahme)
```

Der MCP-Endpunkt ist Teil der App und deployt automatisch mit (kein separater
Server, kein extra Secret). Read-Zugriff läuft über eine SECURITY-DEFINER-RPC,
die nur bei passendem Token-Hash etwas zurückgibt — der öffentliche anon-Key
genügt. (Alternative für rein lokalen Betrieb: `mcp-poc/`.)

## Was das Gerät verlässt — und was nicht

**Hochgeladen** (siehe `McpAggregateSnapshot`):
- Monatsausgaben je Kategorie (Summen), Budget-Status (spent/remaining/ratio/
  health), Cashflow-Eckwerte, Ausreißer-Kategorien.

**Niemals hochgeladen:**
- Rohtransaktionen, `payee`, `counterparty_iban`, `original_text`, `description`,
  Konten/IBANs, der verschlüsselte Vault.

Der Privacy-Test `local-data-boundary.security.test.ts` erzwingt diese Grenze:
alle anderen Services bleiben strikt lokal; `cloud-mcp-sync-service.ts` ist die
einzige, ausdrücklich getestete Ausnahme (aggregat-only + Consent-Gate).

## Schutzmaßnahmen im POC

1. **Opt-in + doppelte Bestätigung:** Risiko-Checkbox **und** wörtlich getippte
   Phrase (`daten verlassen mein gerät`), sonst wirft `assertSyncConsent`.
2. **Read-only Tools** (`readOnlyHint: true`) — keine Schreibpfade im Server.
3. **Datensparsamkeit:** nur Aggregate; Tool-Rückgaben gehen an den KI-Anbieter,
   daher bewusst keine Rohdaten.
4. **Token statt offenem Zugriff:** pro Nutzer ein zufälliges Token; nur dessen
   SHA-256-Hash wird gespeichert; Klartext wird einmalig angezeigt.
5. **RLS** auf der Tabelle (Nutzer sehen nur die eigene Zeile).

## Bekannte POC-Grenzen (für „produktiv" zu schließen)

- **Auth:** statisches Bearer-Token im URL-Pfad statt **OAuth 2.1** (URL-Token
  kann in Logs landen). Produktiv: OAuth 2.1 + RFC 8707 Audience-Bindung.
- **Kein** Origin-Header-/DNS-Rebinding-Schutz, **kein** Rate-Limit.
- Snapshot ist eine **Momentaufnahme** — Frische hängt am manuellen „Sync".
- **Voice ruft keine Tools** (s. o.); Freisprechen bräuchte die OpenAI
  Realtime-API in einer eigenen App.

## Einrichtung — was DU noch tun musst

Vorbereitet ist alles: Der MCP-Endpunkt läuft als Vercel-Function in dieser App
(`api/mcp/[token].ts`), same-origin, ohne extra Secret. Es bleiben nur:

1. **Einmalig: Migration anwenden** — `supabase db push`, oder das SQL aus
   `supabase/migrations/20260627120000_add_mcp_aggregate_snapshots.sql` im
   Supabase-Dashboard → SQL Editor ausführen. (Geht nur mit deinem DB-Zugang.)
2. **In der App aktivieren** — Einstellungen → **Sprach-/KI-Zugriff (MCP)** →
   doppelte Bestätigung → Connector-URL kopieren
   (`https://<deine-app>/api/mcp/<token>`).
3. **In Claude eintragen** — Claude → Einstellungen → **Connectors** → Custom
   Connector hinzufügen → die URL einfügen (Auth „None"). Die App zeigt nach der
   Aktivierung genau diese URL + die Claude-Schritte an. (ChatGPT geht auch:
   Developer Mode, Plus/Pro.)

> Voice ruft (Stand 2026) bei Claude UND ChatGPT keine MCP-Tools auf → im
> **Text-Chat** fragen, Eingabe per **Diktat**.

Optional statt Vercel-Function: separater Server `mcp-poc/` + `VITE_MCP_POC_URL`.

## Privatere Alternative (kein Cloud-Abfluss)

Claude **Desktop** + lokaler **stdio**-MCP-Server + localhost-WebSocket-Bridge
zum offenen, entsperrten Tab + Diktat. Daten bleiben auf dem Gerät, kein
öffentlicher Endpunkt. Nachteil: Desktop statt Handy, Claude statt ChatGPT.

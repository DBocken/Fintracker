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
        │  MCP über HTTPS (Streamable HTTP), Token im Pfad
        ▼
fintracker-mcp-poc  (gehosteter Node-Server, mcp-poc/)
        │  liest mit Service-Role-Key, matcht Token-Hash
        ▼
Supabase: mcp_aggregate_snapshots (1 Aggregat-Snapshot pro Nutzer, RLS)
        ▲
        │  Upsert NUR von Aggregaten, nur nach doppelter Bestätigung
Fintracker Web-App (entsperrter Vault)
  └─ src/services/cloud-mcp-sync-service.ts  (die einzige Cloud-Ausnahme)
```

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

## Einrichtung (Kurz)

1. `supabase db push` (Migration `…_add_mcp_aggregate_snapshots.sql`).
2. `mcp-poc/` deployen oder tunneln (öffentliches HTTPS); siehe `mcp-poc/README.md`.
3. In der Web-App `VITE_MCP_POC_URL` = öffentliche Server-Basis-URL setzen.
4. App → **Einstellungen → Sprach-/KI-Zugriff (MCP)** → aktivieren (doppelte
   Bestätigung) → Connector-URL + Token kopieren.
5. URL als „No Auth"-MCP-Connector in Claude/ChatGPT eintragen; Frage **diktieren**.

## Privatere Alternative (kein Cloud-Abfluss)

Claude **Desktop** + lokaler **stdio**-MCP-Server + localhost-WebSocket-Bridge
zum offenen, entsperrten Tab + Diktat. Daten bleiben auf dem Gerät, kein
öffentlicher Endpunkt. Nachteil: Desktop statt Handy, Claude statt ChatGPT.

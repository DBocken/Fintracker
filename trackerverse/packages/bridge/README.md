# @trackerverse/bridge

Der **Capability-Broker** für den Cross-App-Datenaustausch im Trackerverse —
framework-unabhängig und voll getestet. Dieses Paket ist das sicherheitskritische
Herzstück von Option B (Subdomains + Vault-Origin).

## Modell

- **App** = eine Identität (`AppId`), gebunden an genau **einen Origin**
  (`AppRegistry`).
- **Scope** = `"<providerApp>:<resource>:read"`, z. B. `shoptrack:receipts:read`.
  Keine Wildcards, in v1 nur `read` (Least Privilege).
- **Grant** = eine widerrufbare Berechtigung `(consumerApp → scope)`
  (`CapabilityStore`, Default-deny).
- **Provider** = Handler, der für eine `(providerApp, resource)` die minimalen
  Daten liefert.

## Ablauf (Vault-Host)

```ts
import {
  AppRegistry, CapabilityStore, CapabilityBroker, attachBrokerHost,
} from '@trackerverse/bridge';

const broker = new CapabilityBroker({
  registry: new AppRegistry([
    { appId: 'fintrack',  origin: 'https://fin.trackerverse.de'  },
    { appId: 'shoptrack', origin: 'https://shop.trackerverse.de' },
  ]),
  capabilities: new CapabilityStore({ onChange: persistGrants }),
  requestConsent: (req) => showConsentDialog(req), // -> boolean | Promise<boolean>
  onAudit: logCrossAppAccess,
});

// shoptrack stellt seine Belege bereit; nur das nötige Minimum zurückgeben.
broker.registerProvider('shoptrack', 'receipts', ({ params }) => readReceipts(params));

attachBrokerHost(broker); // hört auf window 'message' im Vault-Origin
```

## Ablauf (Consumer-App)

```ts
import { createBridgeClient, createWindowClientTransport } from '@trackerverse/bridge';

const transport = createWindowClientTransport(vaultIframe.contentWindow!);
const client = createBridgeClient({
  appId: 'fintrack',
  vaultOrigin: 'https://vault.trackerverse.de',
  transport,
});

const receipts = await client.request('shoptrack:receipts:read', { month: '2026-06' });
```

## Sicherheitsgarantien (durch Tests abgedeckt)

| Garantie | Umsetzung |
|---|---|
| **Confused-Deputy-Abwehr** | `appId` wird gegen den **echten `event.origin`** geprüft — vor Scope, vor Grant. Falscher Origin ⇒ `origin_mismatch`. |
| **Default-deny** | Ohne Grant kein Zugriff; ungültiger Scope / kein Provider / Consent abgelehnt ⇒ Fehler. |
| **Kein Privilege-Creep** | Scopes ohne Wildcards, nur `read` in v1. |
| **Widerrufbarkeit** | `revoke`/`revokeAll` entzieht den Zugriff sofort. |
| **Keine Broadcast-Lecks** | Antworten gehen an **exakt** den anfragenden Origin, nie an `"*"`. |
| **Nur Antworten vom Vault** | Der Client ignoriert Nachrichten, deren `origin` nicht der Vault-Origin ist. |
| **Datenminimierung** | Provider liefern nur die angefragte Ressource, nicht den ganzen Vault. |

## Tests

```bash
pnpm test            # alle
pnpm test:security   # nur [SECURITY]-Fälle
```

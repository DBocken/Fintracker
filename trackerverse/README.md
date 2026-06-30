# Trackerverse

Eine Suite **local-first** Tracker-Apps (FinTrack, ShopTrack, MealTrack, FitTrack,
CarTrack, …), die Daten **untereinander** austauschen können — ohne die
Local-First-/Privacy-Garantie aufzugeben.

## Architektur (Option B: Subdomains + Capability-Broker)

Jede App läuft auf ihrem **eigenen Origin** (`fin.trackerverse.de`,
`shop.trackerverse.de`, …) und hat ihren **eigenen verschlüsselten Vault**. Es
gibt **keinen gemeinsamen Topf**. Cross-App-Zugriff läuft ausschließlich über
einen **Vault-Origin** (`vault.trackerverse.de`), der als verstecktes iframe
eingebettet wird und einen **Capability-Broker** hostet.

```
fin.trackerverse.de  ─┐
shop.trackerverse.de ─┤  postMessage   ┌─────────────────────────┐
meal.trackerverse.de ─┼──────────────► │ vault.trackerverse.de   │
car.trackerverse.de  ─┘                │  Capability-Broker       │
                                       │  + Per-App-Vaults        │
                                       └─────────────────────────┘
```

### Warum so (Sicherheits-Begründung)

Das zentrale Risiko einer App-Suite ist der **Blast Radius**: Eine geteilte
Bridge macht das ganze System nur so sicher wie seine schwächste App. Ein Bug in
einer harmlosen App (z. B. MealTrack) darf **nicht** bis zu Bankdaten in FinTrack
durchschlagen. Deshalb:

- **Origin-Isolation pro App** — eigene CSP, eigene Supply-Chain-Blast-Grenze.
- **Default-deny Capability-Broker** — jeder Cross-App-Zugriff braucht eine
  explizit erteilte, **widerrufbare** Berechtigung (`scope`), wie OAuth-Scopes
  *zwischen* den Apps.
- **Strikte Origin-Bindung** — eine App-Identität ist an genau einen Origin
  gebunden (Confused-Deputy-Abwehr).
- **Datenminimierung** — Provider liefern nur die angefragte Ressource, nicht den
  ganzen Vault (DSGVO).

## Pakete

| Paket | Zweck | Status |
|---|---|---|
| `packages/bridge` | Capability-Broker-Protokoll (framework-unabhängig, voll getestet) | ✅ erster Baustein |
| `packages/core` | Per-App-Vault (Krypto/IndexedDB), aus FinTrack extrahiert | geplant |
| `apps/vault-host` | Vault-Origin, hostet Broker + Per-App-Vaults | geplant |
| `apps/fintrack` | bestehende App, dockt als Consumer/Provider an | geplant |

## Entwicklung

```bash
cd trackerverse
pnpm install
pnpm test        # alle Pakete
```

# Programm „Produktionsreife & EU-Souveränität" — Status

> **Protokoll.** Paketstand und Wiedereinstieg; die Wahrheit über Inhalte
> steht in [`plan.md`](plan.md) (Arbeitsplan) und [`audit.md`](audit.md)
> (Belege). Nicht nachgeführte Zahlen altern absichtlich.

**Baseline:** `main@b2513b7`, Version `2026.8.0`, 2026-08-10.

## Wiedereinstieg für eine neue Sitzung

1. `AGENTS.md` lesen (gilt auch gegenüber dem Plan).
2. [`plan.md`](plan.md): Arbeitsregeln (v. a. Regel 7 [OPS] und Regel 8
   Datenfluss), Vorentschiedenes, Abhängigkeitskanten.
3. ADRs [`eu-souveraenitaet.md`](../architecture/eu-souveraenitaet.md) und
   [`supabase-abloesung.md`](../architecture/supabase-abloesung.md) sowie das
   [`Anbieter-Register`](../security/anbieter-register.md) — die dauerhaften
   Regeln, gegen die jedes Paket arbeitet.
4. Erstes unerledigtes Kästchen der niedrigsten offenen Phase nehmen —
   **gegen die Kantenliste geprüft**, nicht nur gegen die Phasennummer
   (WP 5.1 ist ab Phase 0 zulässig, WP 5.2 nicht).

## Paketstand

Epic: [#308](https://github.com/DBocken/Fintracker/issues/308).

| Phase | Issue | Pakete | Stand |
|---|---|---|---|
| 0 · Souveränität des Ist-Zustands | [#300](https://github.com/DBocken/Fintracker/issues/300) | 12 (0.1–0.12) | 2/12 (0.3, 0.8) |
| 1 · Release Engineering | [#301](https://github.com/DBocken/Fintracker/issues/301) | 4 (1.1–1.4) | offen |
| 2 · Identity-Entkopplung | [#302](https://github.com/DBocken/Fintracker/issues/302) | 4 (2.1–2.4) | 1/4 (2.1) |
| 3 · EU-Standbein | [#303](https://github.com/DBocken/Fintracker/issues/303) | 5 (3.1–3.5) | offen |
| 4 · Observability | [#304](https://github.com/DBocken/Fintracker/issues/304) | 4 (4.1, 4.2, 4.3, 4.5) | offen |
| 5 · Native-Lebenszyklus | [#305](https://github.com/DBocken/Fintracker/issues/305) | 2 (5.1–5.2) | offen |
| 6 · Payments & Entitlements | [#306](https://github.com/DBocken/Fintracker/issues/306) | 4 (6.1–6.4) | 2/4 (6.2, 6.3) |
| 7 · Supabase-Ablösung + Server-DR | [#307](https://github.com/DBocken/Fintracker/issues/307) | 7 (7.1–7.7) | offen |

**Gesamt: 42 Pakete, 5 abgeschlossen** (Stand 2026-09-01). Belege zu
[OPS]-Paketen sammeln sich unter `docs/betrieb-2026-08/belege/`.

Zwei Pakete sind seit der Baseline hinzugekommen, beide als Folge bereits
abgeschlossener Arbeit: **WP 0.12** (Auth-Bestand exportierbar — aus dem
`No backups`-Befund von WP 0.3) und **WP 6.4** (Inbetriebnahme-Gate des
EntitlementService — aus den benannten Folgen von WP 6.2/6.3).

## Nächster Schritt

Phase 0 weiter: **WP 0.1** (Versionierungspraxis) und **WP 0.12**
(Auth-Export). WP 0.12 hat Vorrang vor allem in Phase 7 — ohne Export ist
WP 7.2 gegenstandslos, und der Bestand liegt heute ohne Backup bei einem
Anbieter, der abgelöst werden soll.

**Nicht scharf schalten, bevor WP 6.4 läuft:** `VITE_ENTITLEMENT_BASE_URL` zu
setzen zieht heute drei Folgen gleichzeitig nach sich (CSP blockt, Alpha-Tester
verlieren Premium, Dienst ohne Backup). Solange die Variable leer ist, ändert
sich nichts — das ist der bewusst gewählte Zustand, kein Versehen.

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
4. Erstes unerledigtes Kästchen der niedrigsten offenen Phase nehmen;
   Phase 5 ist parallel ab Phase 0 zulässig.

## Paketstand

| Phase | Pakete | Stand |
|---|---|---|
| 0 · Souveränität des Ist-Zustands | 11 (0.1–0.11) | offen |
| 1 · Release Engineering | 4 (1.1–1.4) | offen |
| 2 · Identity-Entkopplung | 4 (2.1–2.4) | offen |
| 3 · EU-Standbein | 5 (3.1–3.5) | offen |
| 4 · Observability | 4 (4.1, 4.2, 4.3, 4.5) | offen |
| 5 · Native-Lebenszyklus | 2 (5.1–5.2) | offen |
| 6 · Payments & Entitlements | 3 (6.1–6.3) | offen |
| 7 · Supabase-Ablösung + Server-DR | 7 (7.1–7.7) | offen |

**Gesamt: 40 Pakete, 0 abgeschlossen.** Belege zu [OPS]-Paketen sammeln sich
unter `docs/betrieb-2026-08/belege/`.

## Nächster Schritt

Phase 0, beginnend mit WP 0.1 (Versionierungspraxis) und WP 0.8 (Wächter
`check:external-endpoints`) — der Wächter zuerst gibt allen folgenden Paketen
ihre Messlatte. WP 0.3 (Supabase-Region) früh einplanen: Sein Ergebnis kann
einen Entscheidungspunkt des Betreibers auslösen.

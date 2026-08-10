# Feature-Slice: `contract-records` (Vertrags-, Beleg- und Garantieakte)

> **Status: vorbereitet, ungenutzt seit 2026-07-19.** Der Slice enthält heute nur
> `domain/`; es gibt **keinen** Konsumenten außerhalb der eigenen Tests. Entschieden
> in WP 6.1 (ARCH-2): kennzeichnen statt löschen — Begründung unten.

## Zweck

Eine **nutzereigene** Akte für Verträge, Belege und Garantien mit **abgeleiteten**
Fristen (spätester Kündigungstermin, nächste Fälligkeit, Restlaufzeit,
Garantieablauf, Preisverlauf). Geplant als Epic B der Roadmap
`docs/product/roadmap-new-capabilities-2026-07.md` (Architekturleitplanke **AD5**,
Slices S6–S8 / Issues #244–#246).

Die Akte **ergänzt** die abgeleitete Vertragserkennung
(`src/lib/contract-derivation.ts`, `ContractDecision`) und ersetzt sie nicht: Ein
optionaler `fingerprint` verlinkt weich auf eine erkannte Vertragsfamilie, die Akte
kann aber auch ganz ohne Transaktion existieren (Garantie eines Barkaufs). Deshalb
ist `ContractsDashboard`/`/contracts` **nicht** automatisch der erste Konsument —
dort läuft die Erkennung, nicht die Akte.

## Bestand

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `deadlines.ts`, `warranty.ts` | Reine Ableitungen (kein React, kein I/O): Periodenende, weitergerollter Kündigungstermin, nächste Fälligkeit, Restlaufzeit · Garantieablauf, sortierter Preisverlauf, erkannte Preisänderungen. |
| `data/` | — | fehlt |
| `application/` | — | fehlt |
| `presentation/` | — | fehlt |

Persistenz und I/O liegen bereits außerhalb des Slice und sind **ebenfalls
konsumentenlos**:

- `src/lib/schemas/contract-record.schema.ts` — zod-Schema (`ContractRecord`,
  Belege, Garantie, Preisverlauf, Verknüpfungen).
- `src/services/contract-record-service.ts` — CRUD über die registrierte
  Collection `contractRecords` (`src/services/local-storage-keys.ts`), zod an
  beiden Boundaries.

**Nie persistiert** (AD5): jede Frist und jeder Garantieablauf wird neu berechnet.
Es gibt keine abgeleiteten Felder im Schema.

## Warum kennzeichnen statt löschen (WP 6.1)

1. `contractRecords` ist eine **registrierte Collection** in `LOCAL_FINANCE_KEYS`
   und läuft damit generisch durch Backup, Verschlüsselung und Reset. Die
   Ableitungen hier sind das einzige, was diesen Daten Bedeutung gibt — sie zu
   löschen ließe eine persistierte Collection ohne ihre Fachlogik zurück.
2. Die Roadmap ist aktiv (`docs/README.md` führt sie unter geltenden Dokumenten)
   und plant den Slice ausdrücklich weiter (S8/#246 hängt an D1).

## Was ihn anschließt

Eine eigene Akten-Oberfläche (`application/` + `presentation/`) über
`contract-record-service`, die `latestCancellationDate`/`nextDueDate` als
Fristenliste und `warrantyExpiry`/`detectPriceChanges` als Garantie- und
Preissicht zeigt. Erst dieser Schritt macht `data/`-Query-Keys nötig; vorher gibt
es nichts zu cachen.

## Offen (nicht in WP 6.1 behoben)

- `contractRecords` fehlt in `VaultPayload` (`src/services/vault-format.ts`) —
  Backup deckt die Collection ab, der Cloud-Sync nicht.

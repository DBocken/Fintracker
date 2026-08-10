# Feature-Slice: `household-settlement` (lokaler Haushaltsausgleich)

> **Status: vorbereitet, ungenutzt seit 2026-07-19.** Der Slice enthält heute nur
> `domain/`; es gibt **keinen** Konsumenten außerhalb der eigenen Tests. Entschieden
> in WP 6.1 (ARCH-2): kennzeichnen statt löschen — Begründung unten.
>
> Anders als die beiden Nachbar-Slices ist hier nur die **Auswertung** unbenutzt:
> die Daten, aus denen sie rechnet, entstehen bereits in der laufenden Oberfläche.

## Zweck

„Wer hat bezahlt, wer schuldet wem" — centgenau und rein lokal. Geplant als Epic C
der Roadmap `docs/product/roadmap-new-capabilities-2026-07.md`
(Architekturleitplanke **AD6**, Slices S9–S10 / Issues #247, #248).

Salden und der Ausgleichsplan sind **reine Ableitungen** aus Splits (Soll-Anteile +
Ist-Zahler) und Ausgleichsbuchungen — sie werden nie gespeichert. Gerechnet wird in
Integer-Cent, damit die Summe aller Salden exakt 0 ist.

## Bestand

| Schicht | Dateien | Verantwortung |
|---|---|---|
| `domain/` | `balances.ts` | `computeMemberBalances` (Nettosaldo je Mitglied), `computeDebts` (minimaler Ausgleichsplan, Greedy, deterministisch), `settlementProgress` (`settled`/`partial`/`open`), `settlementTransactionIds` (Analytik-Ausschluss interner Ausgleichszahlungen, Invariante 2). Kein React, kein I/O. |
| `data/` | — | fehlt |
| `application/` | — | fehlt |
| `presentation/` | — | fehlt |

## Umgebung: die Datenhälfte lebt bereits

| Was | Wo | Zustand |
|---|---|---|
| Haushalt, Mitglieder, Splits (Typen) | `src/lib/household-types.ts` | benutzt |
| CRUD Haushalt/Mitglieder/Splits, `splitEqually` | `src/services/household-service.ts` | benutzt |
| Haushalt + Mitglieder pflegen | `src/components/settings/HouseholdSettings.tsx` | **live** |
| Buchung aufteilen, Ist-Zahler setzen | `src/components/transactions/HouseholdSplitPanel.tsx` | **live** |
| Ausgleichsbuchungen (CRUD, Collection `householdSettlements`) | `src/services/household-settlement-service.ts` | konsumentenlos |
| Salden & „wer schuldet wem" | `domain/balances.ts` (hier) | konsumentenlos |

Es fehlt also genau eine Fläche: die Ausgleichsansicht. Nutzer können heute Kosten
aufteilen, aber nicht sehen, wer wem was schuldet.

## Warum kennzeichnen statt löschen (WP 6.1)

1. `householdSettlements` ist eine registrierte Collection
   (`src/services/local-storage-keys.ts`) **und** Teil von `VaultPayload`
   (`src/services/vault-format.ts`, inkl. Merge) — die Daten sind sync- und
   backupfähig persistiert, `balances.ts` ist ihre Auswertung.
2. `settlementTransactionIds` ist kein Beiwerk, sondern eine
   Invarianten-Absicherung: ohne den Ausschluss zählt eine interne
   Ausgleichszahlung als echte Ausgabe (Invariante 2).

Warum nicht angeschlossen: Ein Saldo-Readout in `HouseholdSettings.tsx` wäre keine
Verdrahtung, sondern ein neues Feature (zusätzliche Abfrage in der Darstellung —
gegen die Richtung von `check:view-data` —, neue i18n-Keys in allen
`SUPPORTED_LOCALES` plus Overlays, Leer- und Fehlerzustand nach §9.1). Das gehört in
Slice C2, nicht in eine Entscheidungs-WP.

## Was ihn anschließt

`application/use-household-settlement.ts` über `household-service` +
`household-settlement-service`, dazu eine Präsentation, die `computeDebts` als
Ausgleichsvorschläge und `settlementProgress` als Fortschritt zeigt. Zusätzlich
muss `settlementTransactionIds` in die Konsumauswertung eingehängt werden, sobald
die erste Ausgleichsbuchung entstehen kann.

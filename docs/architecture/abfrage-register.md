# Abfrage-Register — wie eine Frage zu einer Antwort kommt

Stand: Welle 2 (2026-08). Ergänzt `AGENTS.md` §3 um die Mechanik; die
verbindlichen Regeln stehen dort, nicht hier.

## Der Grundriss in einem Satz

Eine neue beantwortbare Frage ist **ein Eintrag neben dem Feature**, das die
Antwort ohnehin schon berechnet — keine Änderung an der Chat-Fläche.

```
Freitext
  → question-matcher.ts   (Router: Stufe 0a–0c, 1, 2)   → Eintrag + Slots
  → QuestionEntry.antwort(slots, daten)                 → { wert, i18n-Key, deepLink }
  → MoneyQuestionsPane                                  → Satz, Betrag, Link
```

Drei Festlegungen tragen alles Weitere und stehen ausführlich im Kopf von
`src/lib/question-registry.ts`: Ein Eintrag liefert **nie fertigen Text**,
`antwort()` ist **rein und synchron**, und die Datei importiert **nichts aus
`src/features/`**.

## Die Stufen des Routers

| Stufe | Was sie tut | Warum sie zuerst kommt |
|---|---|---|
| **0a** Budget-Aktion | Imperativ-Grammatik erkennt einen BEFEHL | Ein Befehl ist kein Fragetyp; eine Frage darf strukturell nie zu einem werden |
| **0b** Szenario | ≥ 2 erkannte Veränderungen (oder 1 + Schwelle) | Mehrere Deltas sind stärkere Evidenz als jedes Auslösewort |
| **0c** Vergleich | Zwei Partner derselben Achse | Ein Vergleich braucht ein PAAR; die Wortebene kennt nur die längste Größe |
| **1** Lexikalisch | Auslöser-Phrasen + Slot-Punkte | Läuft bei jedem Tastendruck, Mikrosekunden |
| **2** Klassifikator | Complement NB über Subword-Merkmale | Läuft nur beim Absenden; schlägt vor, entscheidet nie allein |

**Jede Schranke der Stufe 1 muss auch für Stufe 2 gelten.** Das Szenario-Gate
lag bis Welle 2 nur an der Wortebene — der Klassifikator konnte deshalb für
eine hypothetische Frage einen Eintrag vorschlagen, den die Wortebene
ausgeschlossen hatte (`budget.aktion` auf „was wenn ich … reduzier"). Wer eine
Stufe hinzufügt, geht die Schranken der vorherigen durch.

## Datenkanäle (`needs`)

Ein Eintrag deklariert, welche Quellen er braucht; `use-money-questions.ts`
lädt sie und prüft **genau diese** auf Lade- und Fehlerzustand.

| Kanal | Quelle | Seit |
|---|---|---|
| `transactions`, `categories`, `accounts` | Grundbedarf — ohne sie gibt es kein Vokabular | WP-C |
| `allocations` | `getAllocationMap()` | deklariert WP-C, **geladen ab Welle 2** |
| `contractDecisions`, `debts`, `budgets` | je eigener Dienst | WP-C |
| `settings` | `getUserSettings()` | Welle 2 |
| `specialCategories` | Anlässe **und** ihre Zuordnungen | Welle 2 |
| `portfolios` | Depots samt Positionen, in EINER Abfrage | Welle 2 |
| `netWorth` | `getNetWorthBreakdown()` | Welle 2 |
| `taxReserve` | Rücklage des laufenden Jahres | Welle 2 |

Drei Regeln dazu:

1. **`undefined` heisst „nicht geladen", nie „leer".** Der Split-Kanal stand
   ab WP-C in `DataNeed`, vier Budget-Einträge forderten ihn an, und geladen
   hat ihn niemand — gesplittete Buchungen zählten dadurch mit ihrem vollen
   Betrag gegen ein Budget. Lautlos.
2. **Der Grundbedarf sperrt global, alles andere je Frage.** Ein unlesbarer
   Steuersatz hat mit „Wie viel habe ich bei Rewe ausgegeben?" nichts zu tun.
3. **Eine unlesbare Quelle wird BENANNT** (Ausgang `quellenfehlt`), nicht als
   leer ausgegeben.

## Slots

`zeitraum`, `kategorie` (eine MENGE), `haendler`, `konto`, `betrag`, `anlass`.
Dazu zwei, die nie einzeln nachgefragt werden: `vergleich` (der zweite
Partner) und `szenario` (die Veränderungs-Menge).

Die Punktzahl eines gefüllten Slots ist keine Stellschraube, sondern eine
Aussage über die Verlässlichkeit des Signals:

| Slot | Punkte | Grund |
|---|---|---|
| `anlass` | 3 | Ein vom Nutzer SELBST vergebener Eigenname („Urlaub Italien") kann nicht zufällig im Satz stehen |
| `kategorie`, `haendler`, `betrag` | 2 | Ein Kategoriewort („Freizeit") kommt auch in der Alltagssprache vor |
| `konto` | 1 | Meist beiläufig genannt, selten die eigentliche Absicht |

Welche Slots die Fläche mit echten Kandidaten erfragen kann, steht in
`ERFRAGBARE_SLOTS` — der Katalog-Test liest dieselbe Liste, statt eine zweite
zu führen.

## Was gemessen wird

Drei Ratschen, drei Dateien, drei Fragen:

| Datei | Misst | Stand |
|---|---|---|
| `question-eval-ratchet.test.ts` | 243 reale Fragen (WP-F-Auftrag) | 100 % / 0 falsch |
| `wave1-ratchet.test.ts` | Rechenarten und Vergleiche | Muster 100 %, Varianten 88 % |
| `wave2-ratchet.test.ts` | Konten … Steuer | Muster 100 %, Varianten 100 % |

Jeder Korpus führt zwei Sorten Zeile: die **Mustersätze** des Auftrags
(Pflicht) und **getippte Varianten**. Ohne die zweite misst der Korpus, ob der
Router Schablonen auswendig kann. Trainiert wird die Stufe 2 **nie** auf einem
Korpus — `paraphrases.test.ts` erzwingt die Disjunktheit.

## Benannte Grenzen

Diese Fragen bleiben bewusst unbeantwortet, und der Chat sagt warum:

- **Kosten pro Nutzung** („Was kostet mich mein Auto pro Fahrt?") — es gibt
  keine Nutzungsdaten. Kosten pro Monat werden beantwortet.
- **Fremdwährung** — kein Kurs, keine Umrechnung (`currency-eur-only.md`).
  Bestände werden ausgewiesen, nie summiert.
- **Umsatzsteuer** — die EÜR ist Kleinunternehmer (§ 19 UStG).
- **Vermögens-Historie** — es gibt nur den Ist-Stand, keine Zeitreihe.

Die ersten drei stehen als Lücken-Zeilen in `wave2-corpus.ts`: Dass der Chat
sich dort zurückhält, ist gemessen und nicht bloß behauptet.

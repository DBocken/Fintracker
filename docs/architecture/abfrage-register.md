# Abfrage-Register — wie eine Frage zu einer Antwort kommt

Stand: Welle 5 (2026-08). Ergänzt `AGENTS.md` §3 um die Mechanik; die
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
| **0a** Aktionen | Vier Imperativ-Grammatiken (Übertrag → Anlass → Kategorie → Budget) | Ein Befehl ist kein Fragetyp; eine Frage darf strukturell nie zu einem werden. Reihenfolge: das engste Gate zuerst |
| **0b** Szenario | ≥ 2 erkannte Veränderungen (oder 1 + Schwelle) | Mehrere Deltas sind stärkere Evidenz als jedes Auslösewort |
| **0c** Vergleich | Zwei Partner derselben Achse | Ein Vergleich braucht ein PAAR; die Wortebene kennt nur die längste Größe |
| **1** Lexikalisch | Auslöser-Phrasen + Slot-Punkte | Läuft bei jedem Tastendruck, Mikrosekunden |
| **2** Klassifikator | Complement NB über Subword-Merkmale | Läuft nur beim Absenden; schlägt vor, entscheidet nie allein |

**Ein schreibender Eintrag ist NUR über seine eigene Grammatik erreichbar.**
Das Imperativ-Gate sitzt dort; Wortebene und Klassifikator sind für ihn
gesperrt (`istAktionsEintrag`). Der Welle-5-Korpus fand beide Wege offen —
„Wie ordne ich Rewe zu Lebensmitteln?" landete über den Auslöser „ordne" bei
der Schreib-Aktion, obwohl das Gate die Frage abgewiesen hatte. Ein
Aktions-Eintrag braucht folgerichtig auch keine Paraphrasen.

**Ein Gate schützt nicht eine Funktion, sondern vor einer Verwechslung.** Das
Szenario-Gate hiess bis Welle 3 „nur die Simulation darf hypothetische Fragen
nehmen". Das war zu eng formuliert: `schulden.sondertilgung` rechnet die
veränderte Welt ebenfalls, nur deterministisch. Was das Gate abwehrt, ist
unverändert — eine BESTANDSAUSWERTUNG, die eine Frage über eine andere Welt
mit Ist-Zahlen beantwortet.

**Ein Stichentscheid darf die Frage nicht WEITEN.** Löst Stufe 2 einen
Gleichstand zugunsten einer Familie ohne Bezugsgröße auf, während die Frage
eine NENNT, die der Router nicht auflösen konnte, bekommt jemand das Ganze
statt des Teils — eine falsche Zahl mit richtigem Anstrich. Erkannt wird die
Position (Inhaltswort hinter „für"/„bei"), nicht das Wort.

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
| `merchantRules` | Gelernte Händlerregeln — nur zum ERKLÄREN | Welle 3 |
| `netWorthHistory` | Fortgeschriebene Vermögens-Zeitreihe | Welle 4 |

Drei Regeln dazu:

1. **`undefined` heisst „nicht geladen", nie „leer".** Der Split-Kanal stand
   ab WP-C in `DataNeed`, vier Budget-Einträge forderten ihn an, und geladen
   hat ihn niemand — gesplittete Buchungen zählten dadurch mit ihrem vollen
   Betrag gegen ein Budget. Lautlos.
2. **Der Grundbedarf sperrt global, alles andere je Frage.** Ein unlesbarer
   Steuersatz hat mit „Wie viel habe ich bei Rewe ausgegeben?" nichts zu tun.
3. **Eine unlesbare Quelle wird BENANNT** (Ausgang `quellenfehlt`), nicht als
   leer ausgegeben.
4. **Ein neuer Kanal wird in der Katalog-Fixture belegt.** Die Zusicherung
   unten prüft nur, was dort steht: Als Welle 2 fünf Kanäle öffnete, blieben
   sie in `question-catalog.test.ts` leer, 15 von 61 Einträgen fielen in
   ihren Leer-Zweig und lagen ausserhalb jeder Prüfung — aufgefallen ist es
   erst im Browser. Ein eigener Wächter hält jetzt jeden angemeldeten Kanal
   gegen die Fixture.

## Deep-Link: `quelle` oder `kontext`

`quelle` heisst: **eine Buchungsliste unter `/transactions?…`, deren Anzahl
und Summe die genannte Zahl einlösen.** Nur dafür kann der Katalog-Test die
Zusicherung nachrechnen, und nur dort ist `anzahl` eine Zahl von Buchungen —
die Präsentation hängt beides daran (Zähl-Zeile und Leer-Aussage).

Alles andere ist `kontext`: `/accounts`, `/trading`, `/euer`,
`/special-categories`. Dort IST der Link zwar die Quelle der Zahl, aber
niemand kann prüfen, ob er sie einlöst — und ein unprüfbares `quelle` wird
zum Etikett. Es hat prompt „Aus 2 Buchungen" erzeugt, wo zwei Konten gezählt
waren.

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
| `wave3-ratchet.test.ts` | Zielrückrechnung … Erklärbarkeit | Muster 100 %, Varianten 100 % |
| `wave5-ratchet.test.ts` | Die schreibenden Befehle | Muster 100 %, Varianten 100 % — plus die Zusicherung, dass KEINE Frage in einer Aktions-Familie landet |

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
- **Sinking Funds** („monatlich zurücklegen, damit Jahresrechnungen nicht
  überraschen") — kommt mit Welle 4. Bis dahin darf keine Sparraten-Familie
  danach greifen: Sie fragte nach einem Zielbetrag, den der Fragende gar
  nicht hat.
- **Immobilienfinanzierung** — es gibt kein Darlehensmodell, also auch keine
  Aussage über eine tragbare Kaufsumme bei 30 % Belastungsquote.

Die ersten drei stehen als Lücken-Zeilen in `wave2-corpus.ts`: Dass der Chat
sich dort zurückhält, ist gemessen und nicht bloß behauptet.

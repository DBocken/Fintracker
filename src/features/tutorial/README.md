# Feature-Slice: Tutorial (`src/features/tutorial/`)

Die geführte Einführung: Datenquellen-Weiche, Lehrplan, Overlay, Coach-Anbindung
— und diese Anleitung, wie ein neues Tutorial entsteht.

## Aufbau

| Ordner | Was darin liegt | Regel |
|---|---|---|
| `domain/` | `tutorial-sequence.ts` (Kapitel, Reihenfolge, Datenreife), `tutorial-steps.ts` (Schritte, Anker, Schlüssel), `tutorial-coach.ts` (Brücke zum Coach) | Rein. Kein React, kein DOM, kein I/O. Ohne Mock testbar. |
| `data/` | `data-readiness-service.ts` | Nur I/O. Liest, urteilt nicht. |
| `application/` | `useTutorialRun.ts` | Der Lauf: welches Kapitel, welcher Schritt, was beim Abschluss passiert. |
| `presentation/` | `TutorialHost`, `TutorialOverlay`, `TutorialInvitation`, `useAnchorRect` | Sichtbares. Eine Präsentation für alle Bildschirmgrößen (Begründung unten). |

Produktentscheidungen, die diesem Slice vorausgehen und **nicht** hier stehen:
`docs/tutorial-sequence.md` (Reihenfolge der Kapitel, Datenreife),
`docs/tutorial-progressive-disclosure.md` (Freischaltungs-Achse),
`docs/tutorial-script-transactions.md` (das ausgearbeitete Beispiel).

---

# Ein Tutorial erstellen — Schritt für Schritt

Verbindliche Anleitung. Die Buchungsseite ist die Referenz: vier Kapitel,
30 Schritte, jedes Bedienelement erklärt.

## Schritt 1: Die Oberfläche inventarisieren

**Bevor ein Wort geschrieben wird**, wird aufgelistet, was auf der Seite
tatsächlich bedienbar ist. Nicht aus dem Gedächtnis — aus dem Code:

```bash
# Alle sichtbaren Beschriftungen einer Seite
grep -oE "t\(['\"][a-zA-Z.]+['\"]\)" src/pages/DeineSeite.tsx | sort -u
# Welche Unterkomponenten hängen dran?
grep -oE "<[A-Z][A-Za-z]+" src/pages/DeineSeite.tsx | sort -u
```

Ergebnis ist eine Liste jedes Knopfes, jedes Auswahlfelds, jedes Schalters.
**Jeder Eintrag bekommt am Ende einen Schritt oder eine begründete Absage.**

## Schritt 2: In Akte schneiden

Ein Kapitel ist **ein Arbeitsschritt**, kein Bildschirm. Faustregel: 2–8
Schritte. Wird es mehr, zerfällt die Seite in mehrere Kapitel.

Die Buchungsseite zerfiel so:

| Akt | Was gelernt wird |
|---|---|
| I `transactions` | Die Liste lesen |
| II `transactionsFilter` | Finden |
| III `transactionDetails` | Eine Buchung korrigieren |
| IV `transactionSplit` | Aufteilen |

Der erste Akt muss allein tragen: Wer danach aufhört, soll das Wichtigste
gesehen haben.

## Schritt 3: Kapitel im Lehrplan eintragen

In `domain/tutorial-sequence.ts`:

```ts
chapter('transactionsFilter', 'core', null, (r) => r.transactionCount >= 20),
```

- **`stage`** — `core` (immer), `optional` (nur bei gewähltem Bereich),
  `closing` (Abschluss, läuft auch für Abbrecher).
- **`feature`** — der Bereich, den das Kapitel freischaltet, oder `null`.
- **`requires`** — die Datenvoraussetzung. **Kein Kapitel ohne sie.** Ein
  Rahmen um einen leeren Bildschirm lehrt nichts, er beschädigt das Vertrauen
  in die Erklärung.

Steht ein Bedienelement hinter einer Tarif-Schranke, gehört das in `requires`
(`r.hasPremiumAccess`). Eine Führung, die auf ein Schloss zeigt, verkauft,
statt zu erklären.

## Schritt 4: Anker setzen

`data-tour-id` an die Elemente — **nie** an sichtbaren Text gekoppelt, sonst
bricht jede Umbenennung die Führung still.

```tsx
<SelectTrigger data-tour-id="filter-account" aria-label={…}>
```

Bei Listen nur das **erste** Element markieren; `querySelector` nähme ohnehin
das erste:

```tsx
<div data-tour-id={isFirstRow ? 'transactions-first-row' : undefined}>
```

Bewährte Stellen: `SelectTrigger`, der Wrapper eines Abschnitts, der Knopf
selbst. Nicht geeignet: `display: contents`-Wrapper — `getBoundingClientRect()`
liefert dort Nullen.

## Schritt 5: Schritte definieren

In `domain/tutorial-steps.ts`:

```ts
transactionDetails: [
  step('open',  '/transactions', 'transactions-first-row'),
  step('panel', '/transactions', 'transaction-detail', OPEN_DETAIL),
  step('basics','/transactions', 'detail-basics',      OPEN_DETAIL),
],
```

`step(id, route, anchor?, openAnchor?)`:

- **`id`** — stabil, Teil des i18n-Schlüssels. Wird **nie** mit einer
  Beschriftung umbenannt.
- **`route`** — der Lauf navigiert vorher dorthin.
- **`anchor`** — was eingerahmt wird. Ohne Anker gilt der Schritt der ganzen
  Ansicht.
- **`openAnchor`** — was die Führung **anklickt**, wenn das Ziel fehlt.

> **Die wichtigste Regel zu `openAnchor`:** Er gehört an **jeden** Schritt, der
> in dem geöffneten Bereich spielt — nicht nur an den ersten. Schließt der
> Nutzer die Detailansicht mitten im Kapitel, ist das Ziel weg; nur mit dem
> Öffner am Schritt selbst macht die Führung sie wieder auf, statt ins Leere zu
> zeigen. Genau dieser Fehler ist im Praxistest aufgefallen.

## Schritt 6: Texte schreiben

Schlüssel entstehen mechanisch: `tutorial.<kapitel>.<schritt>.title` und
`.body`. **Kein String im Code.**

Vier Regeln für den Text:

1. **Ein Schritt, eine Sache.** Erklärt ein Text zwei Bedienelemente, gehört
   er geteilt.
2. **Sag, was es *nützt*, nicht was es *ist*.** „Auf ähnliche anwenden" ist
   der Name — „aus einer Korrektur wird eine Regel" ist der Grund. Nur das
   Zweite bleibt hängen.
3. **Modulnamen referenzieren, nicht abschreiben.** `chapterNameKey` zeigt auf
   die vorhandenen `nav.items.*`-Schlüssel; eine Umbenennung schlägt dadurch
   automatisch durch.
4. **Alle Sprachen zugleich.** `SUPPORTED_LOCALES` sind `de`, `en`, `ru`
   (+ `tlh` inaktiv). Fehlt ein Text, zeigt `t()` **den Schlüssel** — es knallt
   nicht, es steht nur `tutorial.x.y.title` im Popup.

**Erzeuge Schrittdefinitionen und Texte aus einer Tabelle**, nicht von Hand in
zwei Dateien. Dann können Schlüssel und Definitionen strukturell nicht
auseinanderlaufen. Vorlage:
`docs/tutorial-script-transactions.md` und das Skript-Muster darin.

## Schritt 7: Absichern

Diese Tests laufen automatisch mit und decken neue Kapitel ohne Zutun ab:

| Test | Was er verhindert |
|---|---|
| `tutorial-steps.test.ts` `[REGRESSION]` | Ein Schritttext fehlt in einer Sprache und steht als Schlüssel im Popup |
| `tutorial-steps.test.ts` | Ein `openAnchor` zeigt auf einen Anker, den es nicht gibt |
| `tutorial-steps.test.ts` | Ein Kapitel wird zur Vorlesung (Obergrenze Schritte) |
| `tutorial-sequence.test.ts` | Reihenfolge, Datenreife, Kernkapitel |

Zusätzlich schreiben: einen bilingualen Test je neuem Kapitel, dass Titel und
Text erscheinen.

---

## Warum das Overlay ist, wie es ist

Drei Entscheidungen, die aus dem Praxistest kommen und leicht rückgängig
gemacht würden, wenn der Grund nicht dabeisteht:

**Immer ein an das Ziel geheftetes Popover — auch mobil.** Ein Bottom Sheet
nimmt die untere Bildschirmhälfte und damit oft genau das Element, von dem der
Schritt spricht. Bewusste Ausnahme von AGENTS.md §4: Dieselbe Präsentation ist
hier nicht Sparzwang, sondern Bedingung.

**Die Seite kommt aus der Ankerlage, nicht von Radix.** Radix weicht dem
Bildschirmrand aus, kennt aber das ausgeschnittene Loch nicht — auf schmalen
Geräten legte es die Erklärung genau über das Gezeigte. Jetzt gilt: Ziel in der
oberen Bildschirmhälfte ⇒ Erklärung darunter, sonst darüber.

**Der Anker wird durchgehend beobachtet, nicht einmal gemessen.**
`useAnchorRect` prüft im Takt, ob das Ziel noch da ist. Verschwindet es, meldet
der Hook `null` und das Overlay öffnet den Bereich wieder. Vorher lief die
Führung stumpf weiter, wenn der Nutzer eine Detailansicht schloss.

**Das Loch bleibt bedienbar** (`pointer-events-none` auf dem Overlay). Eine
Führung, die das Gezeigte sperrt, kann nicht zum Mitmachen auffordern.

## Was der Lauf speichert

Abgeschlossene **Kapitel**, nicht die Position im Kapitel. Zwei bis acht
Schritte noch einmal zu sehen kostet Sekunden; eine halb gespeicherte Position
erzeugt Zustände, die niemand nachvollziehen kann.

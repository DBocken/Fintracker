# Behutsame Heranführung & Tutorial — Vorüberlegungen

Status: **noch nicht implementiert.** Diese Datei hält die Vorüberlegungen
fest, damit sie bei der Umsetzung nicht neu erarbeitet werden müssen und die
bereits getroffenen Entscheidungen nicht versehentlich untergraben werden.

Vor jeder Arbeit an Tutorial, Freischaltung oder „behutsamer Heranführung":
diese Datei **zuerst** lesen, zusammen mit `docs/onboarding-life-situations.md`
(die Bereichsauswahl, auf der alles aufsetzt).

## Das Ziel

Nutzer sollen nicht von der Menge an Funktionen erschlagen werden. Es soll
möglich sein, sie **langsam** heranzuführen: manche Funktionen sind zunächst
ausgeblendet und werden im Verlauf eines Tutorials freigeschaltet. Wer will,
schaltet alles auf einmal frei — oder Teile davon.

Ein Tutorial ist dabei eine **fokussierte Führung**: das erklärte Element wird
eingerahmt, der Rest des Bildschirms tritt zurück (abgedunkelt/ausgegraut), und
ein Popup erklärt, was man sieht, wofür es gut ist und was man tun soll.

## Die wichtigste Festlegung: drei getrennte Achsen

Ein Bereich kann aus **verschiedenen Gründen** unsichtbar sein. Diese Gründe
dürfen nicht in dasselbe Feld fallen.

| Achse | Frage | Wem gehört die Entscheidung | Heute im Code |
|---|---|---|---|
| Relevanz | „Passt das zu mir?" | dem Nutzer | `enabled_nav_features` |
| Freischaltung | „Bin ich schon so weit?" | der App (Tempo), Nutzer kann übersteuern | **fehlt noch** |
| Berechtigung | „Darf ich das?" | dem Tarif | `requiredTier` (zeigt Badge, versteckt nicht) |

Sichtbar ist ein Bereich, wenn er **gewählt UND freigeschaltet** ist.

### Warum die Trennung nicht verhandelbar ist

Fielen Relevanz und Freischaltung in ein Feld, entstünden zwei falsche
Botschaften:

- Eine Freischaltung sähe aus, als schalte die App etwas wieder ein, das der
  Nutzer bewusst abgewählt hat.
- Ein Abwählen sähe aus, als hätte der Nutzer etwas „noch nicht gelernt".

Deshalb kommt die Freischaltung als **eigenes Feld** dazu (z. B.
`unlocked_features`), additiv. `enabled_nav_features` behält seine Bedeutung
unverändert.

### Abgrenzung zu `DEFAULT_OFF_FEATURES`

Das ist ein **drittes**, davon verschiedenes Konzept: Bereiche, die für die
meisten Nutzer *nie* relevant werden (aktuell die EÜR). Das heißt nicht
„später", sondern „nur auf Wunsch". Nicht mit der Freischaltung vermischen.

Der Einzelunternehmer-Modus ist zugleich der bereits existierende Präzedenzfall
für das Muster „standardmäßig unsichtbar, später über die Lebenssituation oder
manuell dazuschaltbar" — siehe `docs/onboarding-life-situations.md`.

## Befunde zur Umsetzung

Erhoben am Bestand, nicht geraten:

- **Keine Tour-Bibliothek.** driver.js, Shepherd, intro.js wären der Reflex,
  verstoßen aber gegen AGENTS.md §7 (UI ausschließlich shadcn/Tailwind).
  Selbst gebaut ist hier klein: Overlay mit ausgeschnittenem Loch über
  `box-shadow`-Spread, Position über `getBoundingClientRect`, das Popup als
  Radix-`Popover` — der ist bereits im Stack und bringt Fokusfalle und
  Positionierung mit. Vorhanden sind `popover`, `dialog`, `sheet`,
  `alert-dialog`; eine Tour-Infrastruktur existiert **nicht**.
- **Anker-Stabilität ist das eigentliche Risiko.** Touren zeigen auf
  DOM-Elemente. Ohne stabile Marker (`data-tour-id`) bricht jeder Refactor die
  Tour still. Ein fehlender Anker muss den Schritt **überspringen**, nie den
  Nutzer blockieren.
- **Mobile ≠ Desktop** (AGENTS.md §4, Feature-Parität): dieselben Schritte,
  andere Präsentation. Auf 375 px wird aus dem Popover ein Bottom Sheet, und
  ein Rahmen um eine breite Tabelle ergibt dort ohnehin keinen Sinn.
- **Keine Sackgassen.** Dieselbe Regel wie beim Onboarding: Routen bleiben
  registriert. Ein nicht freigeschalteter Bereich, den jemand per Deep-Link
  oder Lesezeichen aufruft, muss funktionieren — höchstens mit dem Angebot,
  die Führung dazu zu starten.
- **Der Ausgang muss dauerhaft sichtbar sein.** „Alles freischalten" gehört
  neben „Alle Bereiche anzeigen" in die Einstellungen. Ohne prominenten
  Ausgang kippt Behutsamkeit in Bevormundung.
- **`prefers-reduced-motion` respektieren** (AGENTS.md §9). Abdunkeln und
  Rahmen sind bewegungsarm — kein Grund für Ausnahmen.
- **Zugänglichkeit:** Fokusfalle im Popup, `aria-describedby` für den
  Erklärtext, Escape beendet die Führung, Fortschritt bleibt erhalten.
- **Persistenz local-first**, wie alle Einstellungen. Muss „Situation neu
  wählen" überleben — sonst verliert ein Wechsel der Lebenssituation den
  Lernfortschritt.

## Vor dem Bauen zu entscheiden

1. **Reihenfolge.** ✅ **Entschieden in `docs/tutorial-sequence.md`.** Dort
   steht die Kapitelfolge, die Datenquellen-Weiche (Datei/Bank/Beispieldaten)
   und die Begründung, warum die Reihenfolge als *eine* globale Konstante lebt
   und **nicht** — wie hier ursprünglich vermutet — in den `features`-Listen
   von `src/lib/life-situations.ts`: `resolveFeatureSelection` sortiert deren
   Ergebnis ohnehin nach `FEATURE_ORDER`, eine dort hinterlegte Reihenfolge
   käme nie an.
2. **Auslöser.** ✅ **Entschieden in `docs/tutorial-sequence.md`**: Kapitel,
   deren Datenvoraussetzung noch nicht erfüllt ist, werden *vertagt* statt leer
   gezeigt, und der `coach-service` trägt sie als „das wäre jetzt dein nächster
   Schritt", sobald die Voraussetzung eintritt — keine zweite
   Benachrichtigungswelt.
3. **Verbindlichkeit.** Muss man die Führung durchlaufen, um den Bereich zu
   bekommen, oder erklärt sie ihn nur beim ersten Auftauchen? Ersteres macht
   das Tutorial zum Türsteher — das verträgt sich nur mit einem sehr sichtbaren
   „alles freischalten".

## Reihenfolge der Umsetzung

Zuerst die **Freischaltungs-Achse** (Datenmodell, Sichtbarkeitsregel,
Einstellungen-Schalter, Tests), danach das Overlay. Das Overlay ohne die Achse
wäre eine Führung, die nichts freischaltet; die Achse ohne Overlay ist bereits
für sich nutzbar.

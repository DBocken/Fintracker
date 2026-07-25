# Onboarding-LifeSituationn

Verbindliche Beschreibung der Nutzer-LifeSituationn, die das Onboarding
(„Welche Situation beschreibt dich am ehesten?") anbietet. Der Code dazu ist
`src/lib/lifeSituations.ts` — bei Widerspruch gilt der Code, dieses Dokument
erklärt das **Warum**.

## Ziel

Nutzer sehen zunächst nur die Bereiche, die zu ihrer Lebenssituation passen,
können aber jederzeit alles aktivieren. Die Auswahl steuert ausschließlich die
**Sichtbarkeit in der Navigation** — kein Zugriff wird gesperrt:

- Alle Routen bleiben registriert. Deep-Links, Lesezeichen und die
  Coach-Verlinkungen (`InteractiveCard to="/debts"`) funktionieren unverändert,
  auch wenn der Bereich ausgeblendet ist.
- Bestandsdaten bleiben sichtbar und werden weiter berechnet.
- Genau dieses Muster gab es bereits für den Einzelunternehmer-Modus
  (`businessOnly` in `nav-config.ts`); das Onboarding verallgemeinert es.

## Zwei Ebenen

Lebensphase und Lebensumstand sind unabhängig voneinander (Familie *und*
verschuldet, Ruhestand *und* vermietend). Eine einzige Kachelliste hätte
deshalb 15+ Einträge gebraucht. Stattdessen:

1. **Lebenssituation** (genau einer) — die Lebensphase, bestimmt das Grundgerüst.
2. **Umstände** (mehrere) — schalten zusätzliche Bereiche frei, **rein
   additiv**.
3. **Bereichsliste** — alles einzeln an-/abwählbar, vorbelegt aus 1 + 2.

### Warum Modifikatoren nichts abwählen dürfen

Dürfte ein Umstand einen Bereich entfernen, hinge das Ergebnis von der
Reihenfolge der Klicks ab und wäre dem Nutzer nicht mehr erklärbar. Die Regel
ist als Test über alle Lebenssituation×Modifikator-Paare abgesichert.

### Warum keine Status-Kacheln

Niemand klickt freiwillig auf ein Etikett wie „verschuldet" oder „wohlhabend".
Deshalb:

- Vermögen ist **kein** eigener Lebenssituation — das deckt `employed_stable` plus
  die Umstände „Ich lege Geld an" / „Immobilie" ab.
- Überschuldung ist als **Ziel** formuliert: „Schulden abbauen"
  (`debt_focus`), nicht als Zustand.

## Die LifeSituationn

| ID | Kachel | Situation | Vorausgewählt |
|---|---|---|---|
| `student_school` | Schüler:in oder Azubi | Taschengeld, Nebenjob, Ausbildungsvergütung. Kaum Fixkosten, erste Abo-Fallen. | Budgets, Meilensteine, Verträge, Finanzstadt |
| `student_university` | Studium | BAföG, Werkstudentenjob, Eltern — unregelmäßig. Ausgaben in Blöcken (Semesterbeitrag, Kaution). | + Liquidität, Einkommen |
| `career_starter` | Berufseinstieg | Erstes volles Gehalt, erste eigene Wohnung, erste Steuererklärung, Pendelweg. | Liquidität, Budgets, Meilensteine, Einkommen, Steuer, Nettovermögen, Verträge |
| `employed_stable` | Angestellt, Haushalt läuft | Fixkosten im Griff; Frage ist Optimierung und Vermögensaufbau. | + Anlässe, Trends & Berichte, Trading |
| `family` | Familie mit Kindern | Geteilte Haushaltskasse; der Schmerz sind die großen unregelmäßigen Ausgaben. | Liquidität, Budgets, Meilensteine, **Anlässe**, Steuer, Nettovermögen, Trends, Verträge |
| `single_parent` | Alleinerziehend | Ein Einkommen trägt alles, Unterhalt läuft rein und raus. | + Schulden; ohne Vermögens-/Trading-Themen |
| `self_employed` | Selbstständig / freiberuflich | Schwankende Umsätze, nachgelagerte Steuer. | + **EÜR**, `business_mode`, Rücklage 30 % |
| `creator` | Creator oder Influencer | Plattform-Auszahlungen aus vielen Quellen, Sachbezüge, Equipment als Investition. | wie `self_employed`, Rücklage 35 %, + Trends |
| `retired` | Ruhestand | Feste Bezüge, Vermögens*verzehr* statt -aufbau. | Liquidität, Budgets, Meilensteine, Steuer, Nettovermögen, Trading, Verträge |
| `debt_focus` | Schulden abbauen | Geringes Einkommen, Jobverlust, Bürgergeld, Trennung. Bis zum Monatsende kommen. | Schulden, Liquidität, Budgets, Meilensteine, Verträge |

### Begründungen zu Einzelentscheidungen

- **`single_parent` ist eine eigene Kachel, kein Umstand.** Die
  Feature-Konsequenz ist gegenläufig zu `family`: nichts wird geteilt, ein
  Einkommen trägt alles, der Puffer muss sitzen. Als Umstand hätte sie nur
  hinzufügen können — nötig ist aber ein anderer Zuschnitt.
- **`creator` ist von `self_employed` getrennt**, obwohl beide `business_mode`
  setzen: das Selbstverständnis ist ein anderes, die Rücklage liegt höher, und
  das Tier-System kennt bereits ein `creatorPack`.
- **`student_school` bekommt bewusst weder Steuer noch Depot noch
  Nettovermögen.** Das wäre nur Ballast; die Kachel ist der schlankste
  Lebenssituation und setzt zusätzlich `enable_subcategories: false`.
- **`debt_focus` bekommt kein Nettovermögen und kein Trading.** In dieser
  Situation ist eine Vermögensübersicht blanker Hohn.
- **Sanfter Ton** (`gentle_mode`) wird nur für belastende Situationen
  vorgeschlagen: `student_school`, `student_university`, `single_parent`,
  `debt_focus`.

## Die Umstände

| ID | Chip | Schaltet zusätzlich frei |
|---|---|---|
| `repaying_debt` | Ich zahle Kredite oder Schulden ab | Schulden |
| `children` | Kinder im Haushalt | Anlässe |
| `investing` | Ich lege Geld an | Trading, Nettovermögen |
| `irregular_income` | Meine Einnahmen schwanken | Liquidität, Einkommen |
| `commute` | Ich pendle oder arbeite im Homeoffice | Steuer |
| `side_business` | Ich habe Nebeneinkünfte oder ein Kleingewerbe | EÜR (+ `business_mode`), Steuer |
| `property` | Ich besitze oder vermiete eine Immobilie | Nettovermögen, Steuer |

Aufgenommen ist nur, was tatsächlich einen Nav-Bereich schaltet. Ein Chip ohne
sichtbare Wirkung wäre eine leere Geste — deshalb fehlt „Ich teile Kosten
(WG/Partner:in)" vorerst: das Haushalts-Splitting hat noch kein eigenes
Nav-Ziel.

## Kernbereiche

Diese Bereiche sind **nicht** abwählbar und erscheinen im Onboarding als reine
Aufzählung (kein dauerhaft deaktivierter Schalter, der das Gegenteil
suggerieren würde):

`/coach`, `/dashboard`, `/transactions`, `/accounts`, `/csv`, `/export`,
`/settings`

Gründe:

- `/coach`, `/dashboard`, `/transactions` speisen die mobile Bottom-Nav
  (`getBottomNavItems`). Fehlt eines, verliert die Bottom-Nav stillschweigend
  einen Tab.
- `/settings` ist der Rückweg — dort schaltet man Bereiche wieder frei. Wäre es
  ausblendbar, könnte man sich selbst aussperren.
- `/accounts`, `/csv`, `/export` sind Dateneingang und -ausgang.

## Persistenz

In `UserSettings` (lokal, wie alle Einstellungen):

| Feld | Bedeutung |
|---|---|
| `onboarding_life_situation` | `undefined` = nie gefragt (Dialog erscheint), `null` = gefragt und übersprungen, sonst die gewählte ID |
| `onboarding_modifiers` | gewählte Umstände (nur für Anzeige/Neuvorschlag) |
| `enabled_nav_features` | die **bestätigte Nutzerauswahl**; `null` = keine Einschränkung ⇒ alles sichtbar |

Gefiltert wird ausschließlich über `enabled_nav_features`, nicht über den
Lebenssituation. Nur so überschreibt ein späterer Wechsel der Lebenssituation keine manuell
getroffenen Entscheidungen.

`business_mode` wird aus dem Feature `euer` **abgeleitet** statt doppelt
gepflegt — sonst könnten Nav-Sichtbarkeit und Fachlogik (Steuer-Tank,
Steuerstufe im Wasserfall) auseinanderlaufen.

## Verhalten für Bestandsnutzer

`enabled_nav_features` ist bei bestehenden Installationen nicht gesetzt
(`null`). `getVisibleNavGroups` behandelt das als „keine Auswahl getroffen" und
zeigt unverändert alles. Ein Update darf niemandem stillschweigend die halbe
Navigation wegnehmen — das ist als `[REGRESSION]`-Test abgesichert.

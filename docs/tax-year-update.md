# Neuen Veranlagungszeitraum (VZ) einpflegen

Checkliste für Steuerrechts-Updates (neues Jahr oder geänderte Sätze/Höchstbeträge).
Ziel: Jede Zahl ist auf eine amtliche Fundstelle rückführbar, jede Änderung erzeugt
einen erzwungenen, sichtbaren Review-Diff, und der Rechenweg in der App bleibt
per Taschenrechner nachvollziehbar.

## Wo die Zahlen leben

| Baustein | Datei | Zweck |
|---|---|---|
| `TAX_YEAR_PARAMS` | `src/data/tax-catalog.ts` | Aufgelöste Werte je VZ (Spread aus `CONSTANT_PARAMS` + Jahres-Overrides) |
| `TAX_PARAM_LEGAL_BASIS` | `src/data/tax-catalog.ts` | Rechtsgrundlage je Parameter — typerzwungen (`Record<NumericParam, …>`) |
| Golden-Table-Test | `src/data/__tests__/tax-params-golden.test.ts` | Pinnt die vollständigen aufgelösten Werte je VZ als Literale |
| Musterrechnungen | `src/lib/__tests__/tax-report.test.ts` (E2E), Golden-Test (Parameter-Ebene) | Verifizieren die Mathematik gegen nachrechenbare Beispiele |
| Rechenweg-UI | `src/components/tax/TaxRubricCard.tsx` | Zeigt `calculation`-Trace aus `compute35aCredit` 1:1 an |

## Checkliste

1. **Amtliche Werte + Fundstellen recherchieren** (Gesetzestext/BGBl., nicht Blogposts):
   Welche Parameter ändern sich, ab welchem VZ, durch welches Gesetz?
2. **`TAX_YEAR_PARAMS[<jahr>]` ergänzen** — Muster: `{ ...CONSTANT_PARAMS, vz: <jahr>, <nur geänderte Werte> }`
   mit Quellen-Kommentar an jedem Override.
   **Nie `CONSTANT_PARAMS` für ein Einzeljahr ändern** — das würde rückwirkend alle
   VZ ändern. `CONSTANT_PARAMS` nur für Korrekturen anfassen, die für ALLE
   abgedeckten Jahre gelten; danach müssen bewusst alle Golden-Literale
   aktualisiert werden (die Tests erzwingen das).
3. **`TAX_PARAM_LEGAL_BASIS` aktualisieren**: `note` der geänderten Parameter um den
   Jahresbezug ergänzen („ab VZ 20XX: … (<Gesetz>)"). Neue Parameter erzwingt der
   `Record`-Typ automatisch.
4. **Golden-Table-Test erweitern** (`tax-params-golden.test.ts`):
   - Neues vollständiges Jahres-Literal (`it('VZ 20XX: …')`).
   - Horizont-Assertion anheben (`[2024, 2025, 2026]` → `[…, 20XX]`) — sie failt
     absichtlich, solange das nicht geschehen ist.
5. **Musterrechnung ergänzen**, wenn sich Mathematik/Werte ändern (E2E in
   `tax-report.test.ts` für §35a/Pendler/Homeoffice; Parameter-Ebene im Golden-Test),
   mit vollständigem Rechenweg im Kommentar.
6. **i18n prüfen**: Nur nötig, wenn sich Struktur/Satzlogik ändert (Sätze und Caps
   kommen zur Laufzeit aus den Parametern — `creditExact`/`rechenweg` sind
   parametrisiert und dürfen NIE Zahlen hartkodieren).
7. **`npm run test && npm run lint && npm run build`** — der Review-Diff zeigt
   Werte + Fundstellen nebeneinander.

## Verwandte Schutzmechanismen

- Unbekannte Jahre clampen zur Laufzeit auf das nächste bekannte Jahr;
  die UI warnt via `exact:false` → `tax.page.paramsClamped` (kein CI-„Wecker"
  auf Kalenderbasis — bewusste Entscheidung, siehe Kommentar im Golden-Test).
- Fachliche Invariante 21 (`docs/domain-invariants.md`): Parameter vergangener VZ
  ändern sich nie unbemerkt.

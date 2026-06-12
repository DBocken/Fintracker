# RDG-Textregeln für das Schulden-Modul

Diese Regeln gelten für **alle** nutzerseitigen Texte im Schulden-Modul
(Epic #24). Hintergrund: Das Rechtsdienstleistungsgesetz (RDG) verbietet
individuelle Rechtsberatung ohne Zulassung. Die App **informiert,
strukturiert, rechnet und motiviert** — sie berät nicht rechtlich.

## Grundregel

> Allgemeine Information ist erlaubt. Eine Empfehlung, was der Nutzer in
> **seinem konkreten Fall** rechtlich tun soll, ist verboten.

## Erlaubt ✅

- Allgemeine, neutrale Rechtsinformation:
  - „Forderungen können nach 3 Jahren verjähren — eine Schuldnerberatung
    prüft das kostenlos."
  - „Gegen einen Mahnbescheid kann man innerhalb von 14 Tagen Widerspruch
    einlegen. Eine Schuldnerberatung hilft dir dabei sofort und kostenlos."
- Rechnen und Strukturieren: Tilgungspläne, Gebühren-Eskalation zeigen,
  Forderungen deduplizieren, Beträge zusammenfassen.
- Aktiver Verweis auf anerkannte, **kostenlose** Beratungsstellen
  (Caritas, Diakonie, Verbraucherzentralen) inkl. Warnung vor
  kommerziellen „Schuldenregulierern".
- Sachliche Hinweise zur Selbstprüfung: „Inkassounternehmen müssen im
  Rechtsdienstleistungsregister eingetragen sein — dort kannst du
  kostenlos nachschlagen."
- Psychologische Einordnung ohne Rechtsbewertung: „Eingeordnet in deinen
  Plan — ändert fast nichts."

## Verboten ❌

- Individuelle Handlungsempfehlungen mit Rechtscharakter:
  - „Das musst du nicht zahlen."
  - „Widersprich diesem Bescheid."
  - „Diese Forderung ist verjährt."
  - „Diese Inkassogebühren sind unzulässig."
- Bewertung/Interpretation einzelner SCHUFA-Einträge (#49).
- Jede Formulierung, die eine Prüfung „für deinen Fall" verspricht.

## Faustregeln für Formulierungen

1. **„kann/können" statt „ist/musst":** Möglichkeit beschreiben, nie den
   Einzelfall entscheiden.
2. **Immer mit Brücke:** Wo eine Rechtsfrage auftaucht, endet der Satz
   mit dem Verweis auf die kostenlose Schuldnerberatung.
3. **Keine Alarm-Rhetorik, keine Verharmlosung:** Mahnbescheid wird ernst
   eingeordnet (14-Tage-Frist), aber ohne rote Banner (#48).
4. **Zahlung nur nach Bestätigung:** Keine Zahlungsempfehlung, bevor der
   Nutzer „Forderung ist berechtigt" bestätigt hat (Fake-Mahnungs-Schutz).

## Code-Review-Checkliste (in jeden Schulden-PR kopieren)

- [ ] Keine neuen Texte mit „musst nicht zahlen" / „widersprich" /
      „ist verjährt" / „unzulässig" o. Ä.
- [ ] Rechtsinformationen sind allgemein formuliert („kann") und enden
      mit dem Verweis auf kostenlose Schuldnerberatung.
- [ ] Mahnbescheid-Pfade bieten keine Zahlungs-Mikro-Aktion und keinen
      GiroCode an.
- [ ] Verweise zeigen nur auf anerkannte, kostenlose Stellen
      (`COUNSELING_SERVICES` in `debt-guardrails-service.ts`).
- [ ] Keine Bewertung einzelner SCHUFA-Einträge.

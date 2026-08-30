# Slice `onboarding` — der Einstieg

Der Weg vom Übergabepunkt der übergeordneten Website bis zur ersten gefüllten
Fläche. Eine Route (`/willkommen/*`), acht Schritte, eine Bewegungssprache.

## Schritte

| # | Kennung | Frage |
|---|---|---|
| 1 | `sprache` | Welche Sprache? (Begrüßung gleichzeitig in allen) |
| 2 | `weg` | Anonym oder angemeldet? |
| 3 | `anmeldung` | Google oder E-Mail/Passwort? *(entfällt anonym)* |
| 4 | `begruessung` | Wie soll die App dich ansprechen? |
| 5 | `situation` | Welche Lebenssituation? *(nur Vorauswahl)* |
| 6 | `bereiche` | Welche Funktionen sind wichtig? |
| 7 | `premium` | Was ist kostenlos, was Premium? |
| 8 | `start` | Woher kommen die Daten — und Tutorial? |

## Warum es so gebaut ist

**Der Schritt steht in der Adresse, nicht nur im Zustand.** Sonst hätte der
Zurück-Knopf des Browsers keine Bedeutung, und ein Neuladen führte an den
Anfang. Was die Adresse behauptet, beschneidet `resolveStartStep` —
dieselbe Regel, die auch die Wiederaufnahme bestimmt (`domain/onboarding-steps.ts`).

**Der Fortschritt liegt im `localStorage`, nicht im React-Zustand.** Die ersten
Schritte laufen, bevor es eine Identität und einen lesbaren
Einstellungsspeicher gibt — und der OAuth-Umweg verlässt die Seite
vollständig. Der Entwurf (`domain/onboarding-draft.ts`, zod-geprüft) ist das
Einzige, was ihn übersteht.

**Geschrieben wird genau einmal.** `data/onboarding-commit.ts` baut EINEN
Patch. Acht Einzelschreibungen kurz hintereinander setzen aufeinander auf,
bevor die jeweils vorige durch ist — dieser Befund steht seit WP 7.3 in
`e2e-tests/fixtures/vertical-slice.ts` dokumentiert.

**Der Slice liest die Navigation nicht.** Labels und Symbole der Bereiche
kommen als `FeatureCatalog` von aussen (`domain/feature-rows.ts`), gefüllt von
`src/pages/OnboardingPage.tsx` bzw. den Einstellungen. Sonst müsste eine
zweite Präsentation die alte Oberfläche mitschleppen — genau das, was
`pnpm check:slice-presentation` zählt.

## Aussen

- `presentation/OnboardingGate.tsx` — die Schranke vor der `AppShell`.
- `presentation/PendingTutorialStarter.tsx` — löst den vorgemerkten
  Tutorial-Wunsch ein, sobald die App steht (der Einstieg selbst steht
  ausserhalb von `TutorialHost`).
- `@/features/shared/presentation/DissolveTransition` — die Auflösung des
  Abgewählten; die Rechnung dazu in `@/lib/dissolve-particles`.

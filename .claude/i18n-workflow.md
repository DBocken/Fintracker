# i18n Workflow für Fintracker

## Standard: Jeder sichtbare Text MUSS i18n-kompatibel sein

Diese Dokumentation erklärt, wie i18n in Fintracker funktioniert und wie du neue Features hinzufügst.

---

## 1️⃣ TDD Workflow für neue Features

### Schritt 1: Translations definieren (je Sprache in `src/i18n/translations/<locale>.ts`)

Seit WP 4.5 liegt jeder Sprachbaum in einer eigenen Datei
(`de.ts`, `en.ts`, `ru.ts`, dazu inaktiv `tlh.ts`); `src/i18n/translations.ts`
ist nur noch ein Barrel für Tests und Typ-Herleitung — Produktionscode
importiert ihn nicht.

```typescript
// src/i18n/translations/de.ts
export const de = {
  myFeature: {
    title: 'Meine Überschrift',
    description: 'Eine Beschreibung',
    noData: 'Keine Daten vorhanden',
  },
  // …
}

// src/i18n/translations/en.ts (analog ru.ts)
export const en = {
  myFeature: {
    title: 'My Heading',
    description: 'A description',
    noData: 'No data available',
  },
  // …
}
```

**WICHTIG:** Alle Sprachen in `SUPPORTED_LOCALES` (`src/i18n/locale.ts` —
aktuell `de`, `en`, `ru`) MÜSSEN die gleichen Keys haben; `tlh` ist inaktiv
und nicht paritätspflichtig.

### Schritt 2: Tests schreiben (vor Implementierung!)

```typescript
// Kopiere aus .claude/templates/i18n-test.template.tsx
it('sollte deutsche Texte rendern', () => {
  renderWithI18n(<MyComponent />, 'de');
  expect(screen.getByText('Meine Überschrift')).toBeInTheDocument();
});

it('sollte englische Texte rendern', () => {
  renderWithI18n(<MyComponent />, 'en');
  expect(screen.getByText('My Heading')).toBeInTheDocument();
});

it('[REGRESSION] sollte alle i18n-Keys existieren', () => {
  const keys = ['myFeature.title', 'myFeature.description'];
  // Prüfe dass Schlüssel in de UND en vorhanden
  // Siehe Template für vollständiges Beispiel
});
```

### Schritt 3: Komponente implementieren

```typescript
// Kopiere aus .claude/templates/i18n-component.template.tsx
export default function MyComponent() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
    </div>
  );
}
```

### Schritt 4: Tests sollten grün sein ✅

---

## 2️⃣ Automatische Compliance-Überprüfung

### Check: `pnpm check:i18n` (Pre-Commit + CI, agentenunabhängig)

**Vor jedem Commit** (`.githooks/pre-commit`) und in CI läuft automatisch eine Überprüfung:

```
❌ FALSCH: <h1>Willkommen</h1>
```

Der Check erkennt hardcodierte deutsche/englische Strings und blockiert den
Commit — im Diff (lokal `--staged`, in CI `--range origin/main...HEAD`) **und**
über den ganzen Bestand (`--all`, läuft ebenfalls in Pre-Commit und CI). Er
gilt für ALLE Agenten (Claude, Codex, …) und menschliche Entwickler
gleichermaßen.

**Lösung:**
1. Zeile aus Komponente entfernen
2. In jedem Sprachbaum unter `src/i18n/translations/` als
   `myFeature.welcome: 'Willkommen'` (bzw. Übersetzung) hinzufügen
3. In Komponente mit `t('myFeature.welcome')` ersetzen

### Anti-Patterns & Häufige Fehler

| ❌ FALSCH | ✅ RICHTIG |
|---|---|
| `<h1>Willkommen</h1>` | `<h1>{t('page.welcome')}</h1>` |
| `"Keine Daten" + status` | `t('page.noData').replace('{status}', status)` |
| Test nur auf Deutsch | Test auf DE + EN (Bilingual!) |
| String in Komponente hardcodiert | String in den Sprachbäumen `src/i18n/translations/<locale>.ts` |
| Nur `t()` ohne I18nProvider wrapping | `renderWithI18n()` helper verwenden |

### Check-Überprüfungen

- ✅ Erkennt hardcodierte Strings in Zeichenketten, Template-Literalen und JSX-Text
- ✅ Ignoriert Kommentare, Importe, Test-Dateien
- ✅ Ignoriert bereits übersetzte Strings (mit `t()`)
- ❌ Prüft **nicht** die Key-Symmetrie zwischen den Sprachen — das tut
  `src/i18n/__tests__/locale-parity.test.ts` (sagt `scripts/check-i18n.mjs`
  im Kopf selbst)

---

## 3️⃣ Checkliste für PRs

**Vor dem Push:**

- [ ] Alle sichtbaren Texte in den Sprachbäumen `src/i18n/translations/<locale>.ts`
- [ ] `useI18n()` in Komponente importiert
- [ ] Alle Texte mit `t('namespace.key')` aufgerufen
- [ ] Tests mit `renderWithI18n()` Wrapper
- [ ] Tests überprüfen beide Sprachen (DE + EN)
- [ ] Keys in **allen** `SUPPORTED_LOCALES` ergänzt (`de`, `en`, `ru`) — `tlh`
      ist inaktiv und nicht paritätspflichtig
- [ ] `pnpm test src/i18n/__tests__/locale-parity.test.ts` — Key-Symmetrie grün
- [ ] `[REGRESSION] Tests überprüfen dass Keys existieren`
- [ ] `pnpm test` — alle Tests grün
- [ ] `pnpm build` — TypeScript OK

---

## 4️⃣ Häufige Fragen

### F: Was ist wenn ich ein Wort übersetzen muss, das ich nicht kenne?

A: Google Translate ist OK als Startpunkt. Die Community kann später verbessern (z.B. durch PR-Review).

### F: Können wir neue Sprachen hinzufügen?

A: **Ja — sechs Schritte:**
1. Neuen Sprachbaum `src/i18n/translations/<locale>.ts` anlegen (alle Keys
   kopieren + übersetzen)
2. `Locale` und `SUPPORTED_LOCALES` in `src/i18n/locale.ts` erweitern
3. Lazy-Import in `src/i18n/translation-registry.ts` ergänzen
4. `LOCALE_META` in `src/i18n/locale-options.ts` ergänzen (der
   `LanguageSwitcher` liest daraus — er selbst braucht keine Änderung)
5. Overlay `src/i18n/overlays/everyday/<locale>.ts` anlegen — Pflicht,
   erzwungen durch `src/i18n/__tests__/overlay-coverage.test.ts`
6. `locale-parity.test.ts` grün — fertig

### F: Was ist wenn ich dynamischen Text habe?

A: Template-Strings verwenden:

```typescript
// src/i18n/translations/de.ts
de: {
  page: {
    greeting: 'Hallo {name}, willkommen!'
  }
}

// Komponente
const greeting = t('page.greeting').replace('{name}', userName);
```

Oder Format-Helper aus `src/i18n/format.ts`:

```typescript
import { replaceTemplate } from '@/i18n/format';
const greeting = replaceTemplate(t('page.greeting'), { name: userName });
```

### F: Sind Tests wirklich notwendig für Übersetzungen?

A: **Ja!** Warum:
- Sichert AB, dass Keys in BEIDEN Sprachen existieren
- [REGRESSION] Tests verhindern dass jemand einen Key nur in einer Sprache ändert
- UI-Test mit Sprache wechsel ist die beste Qualitätskontrolle

---

## 5️⃣ Dateistruktur

```
src/i18n/
  ├── translations/            ← DIE SPRACHBÄUME
  │   ├── de.ts · en.ts · ru.ts   ← aktive Sprachen (paritätspflichtig)
  │   └── tlh.ts                  ← inaktiv, nicht paritätspflichtig
  ├── translations.ts          ← nur Barrel für Tests + Typen (kein Laufzeitpfad)
  ├── translation-registry.ts  ← Lazy-Import je Sprache (Laufzeitpfad)
  ├── locale.ts                ← Locale, SUPPORTED_LOCALES, INACTIVE_LOCALES
  ├── locale-options.ts        ← LOCALE_META für die Sprachauswahl
  ├── overlays/everyday/       ← Alltagssprache je Sprache (Pflicht, s. overlay-coverage)
  ├── wording.ts · glossary.ts ← Sprachstil-Achse
  ├── serviceT.ts              ← t() für services/lib (ohne React-Kontext)
  ├── useI18n.ts               ← Hook für Komponenten
  ├── I18nProvider.tsx         ← React Context Provider
  ├── format.ts                ← Helper (pluralize, formatDaysUntil, etc.)
  └── __tests__/               ← u. a. locale-parity, overlay-coverage, call-site-keys

scripts/
  ├── check-i18n.mjs           ← Auto-Check (Pre-Commit + CI, blockiert hardcodierte Strings)
  ├── i18n-core.mjs            ← die Erkennung, ohne git testbar
  └── check-i18n-module-consts.mjs ← t() im Initializer einer Modul-const

.claude/
  ├── templates/
  │   ├── i18n-component.template.tsx   ← Copy-Paste Template
  │   └── i18n-test.template.tsx        ← Copy-Paste Test-Template
  └── i18n-workflow.md         ← Diese Datei
```

---

## 6️⃣ Beispiel: Feature "Sparkline" übersetzen

### Anforderung
Component zeigt eine kleine Grafik mit dynamischem Label.

### Schritt 1: Translations
```typescript
// src/i18n/translations/de.ts (analog en.ts, ru.ts)
de: {
  sparkline: {
    title: 'Ausgabentrend',
    description: 'Letzte 12 Monate',
    noData: 'Keine Daten',
    loading: 'Lade Daten…',
  }
},
en: {
  sparkline: {
    title: 'Spending trend',
    description: 'Last 12 months',
    noData: 'No data',
    loading: 'Loading data…',
  }
}
```

### Schritt 2: Tests (TDD!)
```typescript
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/i18n/I18nProvider";
import Sparkline from "../Sparkline";

function renderWithI18n(component, locale = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

describe("Sparkline", () => {
  it("sollte deutsche Texte anzeigen", () => {
    renderWithI18n(<Sparkline />, "de");
    expect(screen.getByText("Ausgabentrend")).toBeInTheDocument();
  });

  it("sollte englische Texte anzeigen", () => {
    renderWithI18n(<Sparkline />, "en");
    expect(screen.getByText("Spending trend")).toBeInTheDocument();
  });
});
```

### Schritt 3: Komponente
```typescript
import { useI18n } from "@/i18n/useI18n";

export default function Sparkline() {
  const { t } = useI18n();
  
  return (
    <div>
      <h3>{t('sparkline.title')}</h3>
      <p className="text-sm">{t('sparkline.description')}</p>
      {/* Grafik */}
    </div>
  );
}
```

### Schritt 4: Commit
```
feat(i18n): Add Sparkline component with full DE/EN support

Translates Sparkline component to both German and English. Includes
bilingual tests to ensure all keys exist in both languages.

Tests: 3 new sparkline i18n tests, all passing (1530/1530 total).

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 🎯 TL;DR (Kurzfassung)

1. **Schreibe Tests zuerst** (für beide Sprachen!)
2. **Definiere Strings** in jedem Sprachbaum `src/i18n/translations/<locale>.ts`
3. **Verwende `useI18n()` Hook** in Komponenten
4. **Hook überprüft** automatisch auf Fehler
5. **Commit & Push** — fertig!

---

**Fragen?** → Siehe AGENTS.md §6 (i18n)

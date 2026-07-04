# i18n Workflow für Fintracker

## Standard: Jeder sichtbare Text MUSS i18n-kompatibel sein

Diese Dokumentation erklärt, wie i18n in Fintracker funktioniert und wie du neue Features hinzufügst.

---

## 1️⃣ TDD Workflow für neue Features

### Schritt 1: Translations definieren (zentral in `src/i18n/translations.ts`)

```typescript
export const translations = {
  de: {
    myFeature: {
      title: 'Meine Überschrift',
      description: 'Eine Beschreibung',
      noData: 'Keine Daten vorhanden',
    }
  },
  en: {
    myFeature: {
      title: 'My Heading',
      description: 'A description',
      noData: 'No data available',
    }
  }
}
```

**WICHTIG:** Beide Sprachen MÜSSEN die gleichen Keys haben!

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

### Hook: `.claude/hooks/i18n-compliance.mjs`

**Wenn du Code schreibst**, läuft automatisch eine Überprüfung:

```
❌ FALSCH: <h1>Willkommen</h1>
```

Der Hook erkennt hardcodierte deutsche/englische Strings und blockiert den Commit.

**Lösung:**
1. Zeile aus Komponente entfernen
2. In `translations.ts` als `myFeature.welcome: 'Willkommen'` hinzufügen
3. In Komponente mit `t('myFeature.welcome')` ersetzen

### Hook-Überprüfungen

- ✅ Erkennt hardcodierte Strings in JSX
- ✅ Prüft Asymmetrie zwischen DE/EN (Schlüssel müssen gleich sein)
- ✅ Ignoriert Kommentare, Importe, Test-Dateien
- ✅ Ignoriert bereits übersetzte Strings (mit `t()`)

---

## 3️⃣ Checkliste für PRs

**Vor dem Push:**

- [ ] Alle sichtbaren Texte in `translations.ts` (DE + EN)
- [ ] `useI18n()` in Komponente importiert
- [ ] Alle Texte mit `t('namespace.key')` aufgerufen
- [ ] Tests mit `renderWithI18n()` Wrapper
- [ ] Tests überprüfen beide Sprachen (DE + EN)
- [ ] `[REGRESSION] Tests überprüfen dass Keys existieren`
- [ ] `npm test` — alle Tests grün
- [ ] `npm run build` — TypeScript OK

---

## 4️⃣ Häufige Fragen

### F: Was ist wenn ich ein Wort übersetzen muss, das ich nicht kenne?

A: Google Translate ist OK als Startpunkt. Die Community kann später verbessern (z.B. durch PR-Review).

### F: Können wir neue Sprachen hinzufügen?

A: **Ja, sehr einfach!**
1. Neue Sprache in `translations.ts` hinzufügen (alle Keys kopieren + übersetzen)
2. Type in Zeile 12 erweitern: `export type Locale = 'de' | 'en' | 'fr';`
3. LanguageSwitcher.tsx erweitern (UI für Sprachauswahl)
4. Fertig — alle Komponenten unterstützen automatisch die neue Sprache!

### F: Was ist wenn ich dynamischen Text habe?

A: Template-Strings verwenden:

```typescript
// translations.ts
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
  ├── translations.ts          ← ZENTRAL: Alle Übersetzungen (DE + EN)
  ├── useI18n.ts              ← Hook für Komponenten
  ├── I18nProvider.tsx         ← React Context Provider
  ├── format.ts                ← Helper (pluralize, formatDaysUntil, etc.)
  └── __tests__/
      ├── i18n.test.ts
      └── format.test.ts

.claude/
  ├── hooks/
  │   └── i18n-compliance.mjs  ← Auto-Check (blockiert hardcodierte Strings)
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
// src/i18n/translations.ts
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
2. **Definiere Strings zentral** in `src/i18n/translations.ts`
3. **Verwende `useI18n()` Hook** in Komponenten
4. **Hook überprüft** automatisch auf Fehler
5. **Commit & Push** — fertig!

---

**Fragen?** → Siehe CLAUDE.md Abschnitt "Internationalisierung"

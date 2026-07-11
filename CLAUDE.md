# Claude Development Guidelines für Fintracker

## Test-Driven Development (TDD) Workflow

### 1. **Ziel → Test → Implementierung**

Bei jeder Aufgabe folgen Sie diesem Ablauf:

```
1. Anforderung verstehen & Ziel definieren
2. Entsprechenden Test schreiben (rot → grün)
3. Minimale Implementierung (grün → refactor)
4. Kommentar hinzufügen (nur wenn WARUM nicht klar ist)
```

### 2. **Test-Struktur & Namenskonventionen**

#### Naming Convention:
```typescript
// ✅ GUT:
describe('CategoryTwoStepSelect', () => {
  it('sollte Unterkategorien anzeigen wenn Hauptkategorie Kinder hat', () => {})
  it('[REGRESSION] sollte parent_id Migration funktionieren', () => {})
})

// ❌ SCHLECHT:
describe('tests', () => {
  it('test 1', () => {})
  it('test category', () => {})
})
```

#### Test-Kategorien:
- **Happy Path**: Normales Verhalten
- **Edge Cases**: Grenzbedingungen (leere Arrays, null, undefined)
- **Error Cases**: Fehler & Exceptions
- **[REGRESSION]**: Tests für behobene Bugs (verhindert Rückfall)

### 3. **Test-Organisation**

```typescript
describe('Feature/Component Name', () => {
  // Gruppe 1: Normales Verhalten
  describe('Normal Behavior', () => {
    it('sollte X tun', () => {})
    it('sollte Y tun', () => {})
  })

  // Gruppe 2: Edge Cases
  describe('Edge Cases', () => {
    it('sollte mit leeren Arrays umgehen', () => {})
    it('sollte undefined vs null unterscheiden', () => {})
  })

  // Gruppe 3: Regression Tests
  describe('Regression Protection', () => {
    it('[REGRESSION] sollte nach Migration funktionieren', () => {})
  })
})
```

### 4. **Agent Prompting für TDD**

Beim Delegieren an Agenten verwenden Sie diese Struktur:

```markdown
## Task: [Kurze Beschreibung]

### Ziel
- Was soll erreicht werden?
- Warum ist es wichtig?

### Test-First Approach
1. **Schreibe zuerst Tests für diese Szenarien:**
   - Hauptfall: [Beschreibung]
   - Edge Case 1: [Beschreibung]
   - Edge Case 2: [Beschreibung]
   - [REGRESSION] Bekannter Bug: [Beschreibung]

2. **Implementiere dann die Lösung** um die Tests grün zu machen

3. **Commit-Nachricht** muss Ziel + Test-Abdeckung erwähnen

### Akzeptanzkriterien
- [ ] Alle neuen Tests grün
- [ ] Bestehende Tests nicht kaputt
- [ ] Kommentare nur für nicht-offensichtliche WARUM
```

### 5. **Typische Test-Patterns für Fintracker**

#### Category/Hierarchy Tests:
```typescript
describe('Category Hierarchy', () => {
  // Pattern 1: Struktur-Tests
  it('sollte Hauptkategorien erkennen (parent_id === null)', () => {
    const categories = [
      { id: 'main', name: 'Wohnen', parent_id: null },
      { id: 'sub', name: 'Miete', parent_id: 'main' },
    ]
    const { mains } = buildIndex(categories)
    expect(mains).toHaveLength(1)
  })

  // Pattern 2: Migrations-Tests
  it('[REGRESSION] sollte fehlende parent_id nachfüllen', () => {
    const old = [{ id: 'cat', name: 'Wohnen' }] // parent_id fehlt
    const migrated = migrateParentIds(old)
    expect(migrated[0].parent_id).toBe(null)
  })

  // Pattern 3: Robustness-Tests
  it('sollte verwaiste Unterkategorien ignorieren', () => {
    const categories = [
      { id: 'orphan', parent_id: 'non-existent' },
    ]
    const { childrenByParent } = buildIndex(categories)
    expect(childrenByParent.size).toBe(0)
  })
})
```

#### Transaction Tests:
```typescript
describe('Transaction Processing', () => {
  // Pattern: Daten-Transformations-Tests
  it('sollte Transfer-Flag setzen wenn is_transfer=true', () => {
    const tx = { ...transaction, is_transfer: true }
    expect(isTransferTransaction(tx)).toBe(true)
  })
})
```

### 6. **Kommentar-Richtlinien**

```typescript
// ❌ NICHT: "Diese Funktion berechnet die Summe"
//    (Das Code-Name sagt bereits: `sum()`)

// ❌ NICHT: "Issue #123 benötigte diese Workaround"
//    (Das gehört ins PR-Description, nicht ins Code)

// ✅ OK: "Normalisiere IBAN mit Leerzeichen entfernt und Großbuchstaben"
//    (Erklärt WARUM der spezifische Algorithmus)

// ✅ OK: "Nur verknüpfen bei eindeutigem Treffer—mehrdeutige Fälle
//         zur manuellen Bestätigung offenlassen (Sicherheit)"
//    (Erklärt eine nicht-offensichtliche Business-Logik)
```

### 7. **Workflow-Beispiel**

**Anforderung:** "Nutzer kann bei Transfers Unterkategorien nicht wählen"

**Step 1: Ziel definieren**
```
Ziel: Kategorie-Hierarchie korrekt laden & anzeigen
      (auch für Kategorien die parent_id fehlte)
Warum: Unterkategorien sind wichtig für bessere Finanzorganisation
```

**Step 2: Tests schreiben**
```typescript
describe('Category Hierarchy Migration', () => {
  it('sollte fehlende parent_id aus Defaults nachfüllen', () => {})
  it('sollte Hauptkategorien von Unterkategorien unterscheiden', () => {})
  it('[REGRESSION] sollte nach Migration korrekt funktionieren', () => {})
})
```

**Step 3: Implementierung**
```typescript
// Minimal code um Tests grün zu machen
function migrateParentIds(stored) {
  return stored.map(cat => ({
    ...cat,
    parent_id: cat.parent_id ?? (defaultCat?.parent_id ?? null)
  }))
}
```

**Step 4: Commit-Message**
```
Fix: Restore category hierarchy when parent_id is missing

Categories stored before migration lacked parent_id. Now auto-restored
from defaults. Ensures subcategories display correctly for all transaction types.

Tests: 16 new regression tests prevent regressions.
```

---

## Integration mit Claude Code CLI

### Pre-Commit Checks
```bash
npm run test      # Alle Tests müssen grün sein
npm run lint      # Keine Warnungen
npm run build     # TypeScript muss kompilieren
```

### PR Workflow
1. Branch: `claude/[task-name]`
2. Tests schreiben (rot)
3. Implementieren (grün)
4. Pushen
5. Vercel & CI abwarten
6. Review-Kommentare bearbeiten

---

## Häufige Fehler vermeiden

| ❌ Anti-Pattern | ✅ Besser |
|---|---|
| "Ich behebe das schnell" → keine Tests | "Ich schreibe erst einen Regression-Test" |
| 100 Zeile Änderung in einem Commit | "Logische Commits mit Tests pro Feature" |
| Kommentare die den Code kopieren | "Nur WARUM-Kommentare für nicht-Offensichtliches" |
| Tests "irgendwo" ablegen | "Tests neben dem Code: `__tests__/` Ordner" |
| Alten Bug beheben → vergessen zu testen | "[REGRESSION] Test schreiben um Rückfall zu verhindern" |

---

## Internationalisierung (i18n) — Verbindliches Standard

**REGEL:** Jeder sichtbare Text muss über i18n laufen. Keine hardcodierten Strings für UI-Text.

### i18n Compliance Checklist

**Für jede neue Komponente/Feature:**

```typescript
// ❌ NICHT ERLAUBT (hardcodierter String):
export default function MyComponent() {
  return <h1>Meine Überschrift</h1>
}

// ✅ ERFORDERLICH (i18n):
export default function MyComponent() {
  const { t } = useI18n();
  return <h1>{t('myFeature.title')}</h1>
}
```

### Test-Template für i18n-Compliance

**Jeder Component-Test MUSS i18n überprüfen:**

```typescript
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/i18n/I18nProvider";

// Helper: Alle Tests mit I18nProvider wrappen
function renderWithI18n(component: React.ReactElement, locale: 'de' | 'en' = 'de') {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

describe('MyComponent', () => {
  // Pattern 1: Deutsch überprüfen
  it('sollte deutsche Texte korrekt rendern', () => {
    renderWithI18n(<MyComponent />, 'de');
    expect(screen.getByText(/Meine Überschrift/)).toBeInTheDocument();
  });

  // Pattern 2: Englisch überprüfen (i18n Vollständigkeit)
  it('sollte englische Texte korrekt rendern', () => {
    renderWithI18n(<MyComponent />, 'en');
    expect(screen.getByText(/My Heading|Meine Überschrift/)).toBeInTheDocument();
  });

  // Pattern 3: [REGRESSION] i18n-Keys existieren
  it('[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben', () => {
    const keys = ['myFeature.title'];
    const { de, en } = translations;
    keys.forEach(key => {
      const path = key.split('.');
      let deValue = de as any;
      let enValue = en as any;
      path.forEach(p => {
        expect(deValue[p]).toBeDefined();
        expect(enValue[p]).toBeDefined();
        deValue = deValue[p];
        enValue = enValue[p];
      });
    });
  });
});
```

### Workflow: Neue Strings hinzufügen

**Schritt 1: Translations hinzufügen** (`src/i18n/translations.ts`)
```typescript
export const translations = {
  de: {
    myFeature: {
      title: 'Meine Überschrift',
      description: 'Eine Beschreibung'
    }
  },
  en: {
    myFeature: {
      title: 'My Heading',
      description: 'A description'
    }
  }
}
```

**Schritt 2: Komponente schreiben**
```typescript
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

**Schritt 3: Tests schreiben (TDD!)**
```typescript
it('sollte deutsche Texte rendern', () => {
  renderWithI18n(<MyComponent />, 'de');
  expect(screen.getByText('Meine Überschrift')).toBeInTheDocument();
});

it('sollte englische Texte rendern', () => {
  renderWithI18n(<MyComponent />, 'en');
  expect(screen.getByText('My Heading')).toBeInTheDocument();
});
```

### Anti-Patterns & Häufige Fehler

| ❌ FALSCH | ✅ RICHTIG |
|---|---|
| `<h1>Willkommen</h1>` | `<h1>{t('page.welcome')}</h1>` |
| `"Keine Daten" + status` | `t('page.noData').replace('{status}', status)` |
| Test nur auf Deutsch | Test auf DE + EN (Bilingual!) |
| String in Komponente hardcodiert | String in `translations.ts` zentral |
| Nur `t()` ohne I18nProvider wrapping | `renderWithI18n()` helper verwenden |

### Pre-Commit Hook (automatische Überprüfung)

Wird überprüft durch `.claude/hooks/i18n-compliance.mjs`:
- ❌ Blockiert: Neue hardcodierte deutsche/englische Strings in JSX
- ❌ Blockiert: Neue Keys ohne beide Sprachen in `translations.ts`
- ✅ Erlaubt: Keys aus `lib/constants`, `lib/utils`, Kommentare

---

## Security — Verbindlicher Standard

**REGEL:** Für die folgenden Schwachstellen-Klassen gelten die Regeln aus
**`docs/security-guidelines.md`** verbindlich. Jede Klasse hat einen Wächter-Test
in `src/security/` (läuft in `pnpm test` und `pnpm test:security`) — Verstöße
werden in CI rot.

### Kurzfassung (Details + ❌/✅-Beispiele in den Guidelines)

1. **child_process:** nie `execSync`/String-Interpolation — immer
   `execFileSync('cmd', [args, '--', file])`; `import.meta.url` nur via `fileURLToPath`.
2. **HTTP-Header:** Web-App über `vercel.json`/`netlify.toml`; neue Express-Server
   → `helmet` als erste Middleware; Serverless-JSON → `nosniff` + `no-store`.
3. **Secrets:** echte Secrets nur `process.env` ohne Fallback (`requireEnv`);
   Supabase-Anon-Key env-first (public-by-design); `.env` nie committen.
4. **GitHub Actions:** `uses:` nur mit 40-Hex-SHA + `# vX.Y.Z`-Kommentar;
   top-level `permissions: contents: read` in jeder Workflow-Datei.
5. **Redirects:** externe URLs vor `window.location.href`/`window.open` immer
   durch `isSafeExternalAuthUrl` (`@/lib/safe-url`); `window.open` mit `noopener`.
6. **Android:** `allowBackup="false"`, Network-Security-Config ohne Klartext,
   keine neuen exportierten Komponenten ohne Begründung + Test.

### Testpflicht (TDD, wie oben)

- Änderungen in diesen Klassen **nur mit `[SECURITY]`/`[REGRESSION]`-Test im
  selben Commit** — behobene Schwachstellen bekommen immer einen
  `[REGRESSION]`-Test gegen den Rückfall.
- Neue Wächter-Tests (Repo-/Config-Scans) → `src/security/*.security.test.ts`;
  Unit-Tests für Security-Utilities → neben den Code (`__tests__/`).
- Vor jedem Push: `pnpm test:security` und `pnpm security:secrets` grün.

---

## Design & Animation (verbindlich)

Vollständige Prinzipien: **`docs/design-principles.md`**. Kurzfassung für jede UI-Arbeit:

1. **Geschwindigkeit als Feature** (Local-First, sofort, offline-fähig)
2. **Bewegung mit Bedeutung — datengetriebener Aufbau ist die Animations-Baseline**
3. **Ruhe vor Fülle** (eine Hauptaussage pro Screen, werbefrei)
4. **Unsichtbare Intelligenz, sichtbare Erklärung** (Confidence + Gründe, editierbare Regeln)
5. **Vertrauen zuerst** (erst ausprobieren, dann Bank verbinden)
6. **Konsistentes Token-System** (Farbe/Icon/Typo app-weit)
7. **Accessibility** (`prefers-reduced-motion` überall)
8. **Karten sind Aktionen** (Karten-Optik ⇒ ganze Fläche klickbar; reine Info ohne Follow-up ohne Karte)

### Karten-Regel (Klickbarkeit)
- **Karten-Optik = Klick-Versprechen.** Eine Fläche mit Karten-Chrome (Rahmen + Hintergrund +
  Schatten) muss als **Ganzes** klickbar sein und entweder **navigieren**, ein **Popup/Sheet/Dialog**
  öffnen oder **auf-/zuklappen**. Kein „toter" Karten-Rahmen mit nur einem verschachtelten Button.
- **Reine Anzeige-Info ohne Follow-up** gehört **nicht** in eine Karte → gebündelt **ohne**
  Karten-Chrome (klar/präzise) darstellen.
- **Bausteine:** klickbar → `@/components/common/InteractiveCard` (Link/Popup/Akkordion, ganze
  Fläche, Fokusring, Hover, Touch-Ziel ≥ 44px, Chevron); reines Readout →
  `@/components/common/InfoGroup` / `InfoStatStrip` (kein Rahmen/Schatten).
- Ein PostToolUse-Hook (`.claude/hooks/card-clickability-check.mjs`) erinnert automatisch, wenn
  Karten-Chrome ohne Klick-Aktion auftaucht. Vollständig: `docs/design-principles.md` (Prinzip 8).

### Animations-Regel
- **Baseline = unsere eigene, datengetriebene Implementierung** (SVG / Framer Motion / CSS /
  `requestAnimationFrame` / Recharts). **Lottie ist NICHT Baseline** – nur eine Option für
  expressive Set-Pieces (Celebration/Empty-State), die wir künftig prüfen.
- **Visualisierte Daten poppen nicht auf, sie werden *aufgebaut*** (hochzählen, füllen, wachsen,
  zeichnen) – je nach Visualisierungstyp unterschiedlich. **Kein `isAnimationActive={false}`** bei
  Charts, außer mit kurzer Begründung.
- **Immer daten- & schwellwertbewusst**: Farb-/Statuswechsel an Schwellen (wie `colorForFill`/
  Budget-Ampel). `prefers-reduced-motion` → Aufbau überspringen, Zielzustand direkt zeigen.
- Ein PostToolUse-Hook (`.claude/hooks/animation-baseline-check.mjs`) erinnert automatisch, wenn
  Daten aufpoppen oder ein Chart die Aufbau-Animation/Schwellwerte ignoriert.

---

## Questions?

Geben Sie Agenten/Entwicklern dieses Dokument als Kontext beim Starten neuer Tasks.

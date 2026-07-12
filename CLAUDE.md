@AGENTS.md

Verbindliche Basis für alle Agenten: AGENTS.md — zuerst lesen.

## Claude-Code-spezifische Mechanik

Diese Datei ergänzt `AGENTS.md` nur um das, was **spezifisch für Claude Code**
ist (Hooks, `.claude/`-Werkzeuge). Alle inhaltlichen Regeln (TDD, i18n,
Architektur, Security, Design) stehen ausschließlich in `AGENTS.md` — keine
Duplikate hier.

### PostToolUse-Hooks (`Write|Edit|MultiEdit`)

| Hook | Modus | Prüft |
|---|---|---|
| `.claude/hooks/test-structure-check.mjs` | **blockierend** (exit 2) | Testdateien nur in `__tests__/` (Ausnahme `src/security/*.security.test.ts`) |
| `.claude/hooks/animation-baseline-check.mjs` | advisory | Datengetriebener Aufbau statt „Aufpoppen" (`docs/design-principles.md` Prinzip 2) |
| `.claude/hooks/card-clickability-check.mjs` | advisory | Karten-Chrome ⇒ ganze Fläche klickbar (`docs/design-principles.md` Prinzip 8) |

i18n wird agentenunabhängig via `pnpm check:i18n` (Pre-Commit + CI)
erzwungen — dafür gibt es keinen Claude-Code-Hook mehr.

### `.claude/`-Verzeichnis

- `agents/i18n-enforcer.md` — Subagent, der i18n-Verstöße in einer Datei-/
  Verzeichnisliste direkt behebt (Strings nach `translations.ts`, `t()`-Calls,
  bilinguale Tests).
- `workflows/i18n-full-repo-sweep.mjs` — Skript für einen repo-weiten
  i18n-Sweep.
- `templates/i18n-component.template.tsx`, `templates/i18n-test.template.tsx`
  — Copy-Paste-Vorlagen für neue i18n-pflichtige Komponenten/Tests.
- `i18n-workflow.md` — ausführlicher i18n-Workflow (Schritt-für-Schritt,
  dynamische Strings, neue Sprache hinzufügen).

### Agent-Prompting-Template für TDD-Tasks

Beim Delegieren an Subagenten (`Agent`-Tool) diese Struktur verwenden:

```markdown
## Task: [Kurze Beschreibung]

### Ziel
- Was soll erreicht werden? Warum ist es wichtig?

### Test-First Approach
1. Tests zuerst für: Hauptfall, Edge Cases, [REGRESSION] bekannter Bug
2. Implementierung, bis Tests grün sind
3. Commit-Nachricht nennt Ziel + Test-Abdeckung

### Akzeptanzkriterien
- [ ] Alle neuen Tests grün
- [ ] Bestehende Tests nicht kaputt
- [ ] Kommentare nur für nicht-offensichtliche WARUM
```

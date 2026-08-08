# Dokumentation — was gilt, was ist Protokoll

Diese Datei ist die Landkarte. Sie existiert, weil in `docs/` zwei Arten von
Dokumenten nebeneinander lagen, die man ihnen nicht ansieht:

- **Geltend (normativ):** sagt, was *jetzt* zu tun ist. Wer dagegen verstößt,
  macht einen Fehler. Diese Dokumente werden gepflegt.
- **Protokoll:** sagt, was zu einem *Zeitpunkt* gefunden oder entschieden
  wurde. Es wird nicht nachgeführt — die Zahlen darin altern absichtlich.

Ein Audit von Juli, das nicht als Protokoll erkennbar ist, liest sich wie eine
Regel. Genau so ist ein Test-Inventar mit 783 Tests im Wurzelverzeichnis stehen
geblieben, während der Baum längst 4634 hatte.

**Faustregel für neue Dokumente:** Trägt der Titel ein Datum oder beschreibt er
einen Lauf („Audit", „Bericht", „Ergebnisse", „Fortschritt"), gehört er nach
`docs/archive/` — spätestens, sobald die daraus folgende Arbeit erledigt ist.
Regeln, die aus einem Lauf entstehen, wandern in die geltenden Dokumente; der
Bericht bleibt als Beleg.

---

## Die oberste Ebene

| Datei | Rolle |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | **Die kanonische Regelquelle** für alle Agenten und Menschen. Bei Widerspruch zu jedem anderen Dokument gilt diese Datei |
| [`CLAUDE.md`](../CLAUDE.md) | Nur die Claude-Code-spezifische Mechanik (Hooks, `.claude/`). Keine inhaltlichen Regeln |
| [`AI_RULES.md`](../AI_RULES.md) | Wegweiser auf `AGENTS.md`, für Werkzeuge, die genau diesen Dateinamen erwarten |
| [`README.md`](../README.md) | Einstieg: Stack, Setup, Kommandos |

## Geltend — Architektur & Handwerk

| Datei | Inhalt |
|---|---|
| [`coding-guide.md`](coding-guide.md) | Entwickler-Leitfaden, Schichten im Detail |
| [`architecture/feature-structure.md`](architecture/feature-structure.md) | Kochrezept für Feature-Slices, Entscheidungsbaum Desktop/Mobile |
| [`architecture/entity-references.md`](architecture/entity-references.md) | Entitäten über stabile IDs adressieren, nicht über Anzeigenamen |
| [`domain-invariants.md`](domain-invariants.md) | Fachliche Invarianten, auf die sich Tests berufen |
| [`design-principles.md`](design-principles.md) | 7 Kernprinzipien + Karten- und Animationsregel |
| [`performance.md`](performance.md) | Performance-Ist-Zustand und geplante Phase B |

## Geltend — Sicherheit & Datenschutz

| Datei | Inhalt |
|---|---|
| [`security-guidelines.md`](security-guidelines.md) | Regeln je Schwachstellenklasse, mit ❌/✅-Beispielen |
| [`security-boundaries.md`](security-boundaries.md) | Wo Daten das Gerät verlassen dürfen — und wo nicht |
| [`security/threat-model.md`](security/threat-model.md) | Bedrohungsmodell |
| [`security/security-inventory.md`](security/security-inventory.md) | Stand der Schutzmaßnahmen |
| [`security/pentest-scope.md`](security/pentest-scope.md) | Geltender Prüfumfang für Pentests |
| [`security/security-headers.md`](security/security-headers.md) | Header-Konfiguration (Beispiel für Deployments) |

## Geltend — Fachdomäne & Produkt

| Datei | Inhalt |
|---|---|
| [`FEATURES.md`](FEATURES.md) | Steckbriefe versteckter und experimenteller Features |
| [`RDG_TEXTREGELN.md`](RDG_TEXTREGELN.md) | Formulierungsdisziplin im Schulden-Modul (Rechtsdienstleistungsgesetz) |
| [`tax-year-update.md`](tax-year-update.md) | Checkliste für einen neuen Veranlagungszeitraum |
| [`mcp-poc.md`](mcp-poc.md) | MCP-Zugriff als Proof of Concept samt seiner Grenzen |
| [`competitive-analysis.md`](competitive-analysis.md) | Wettbewerbsvergleich — Momentaufnahme Juni 2026, bewusst nicht nachgeführt |

## Geltend — Vorentschiedenes (vor der Arbeit daran lesen)

`AGENTS.md` §3 verweist auf diese Dokumente, damit getroffene Entscheidungen
nicht versehentlich untergraben werden:

| Datei | Thema |
|---|---|
| [`onboarding-life-situations.md`](onboarding-life-situations.md) | Onboarding, Lebenssituationen, Einzelunternehmer-Modus |
| [`tutorial-progressive-disclosure.md`](tutorial-progressive-disclosure.md) | Behutsame Heranführung, Freischaltung von Funktionen |
| [`tutorial-sequence.md`](tutorial-sequence.md) | Reihenfolge der Kapitel, Datenquellen-Weiche |
| [`tutorial-script-transactions.md`](tutorial-script-transactions.md) | Skript des Transaktions-Kapitels |
| [`debt-avoidance-recovery.md`](debt-avoidance-recovery.md) | Sanfter Modus, Vermeidungsverhalten, Grenzen für Umfrage und Werbung |
| [`feature-strategy-budgeting.md`](feature-strategy-budgeting.md) | Budget-Strategie |
| [`feature-strategy-sonderkategorien.md`](feature-strategy-sonderkategorien.md) | Sonderkategorien |
| [`product/roadmap-new-capabilities-2026-07.md`](product/roadmap-new-capabilities-2026-07.md) | Geplante Fähigkeiten — plant Arbeit, implementiert nichts |

## Laufendes Programm: AAA+

`docs/aaa-plus/` ist **kein Archiv**: das Programm hat offene Arbeitspakete.
Innerhalb davon gilt dieselbe Trennung.

| Datei | Rolle |
|---|---|
| [`aaa-plus/implementation-plan.md`](aaa-plus/implementation-plan.md) | Geltende Spezifikation der Arbeitspakete |
| [`aaa-plus/tdd-specs.md`](aaa-plus/tdd-specs.md) | Geltende Testspezifikationen je Paket |
| [`aaa-plus/decisions/decision-log.md`](aaa-plus/decisions/decision-log.md) | Getroffene Entscheidungen — geltend, weil sie binden |
| [`aaa-plus/offene-punkte.md`](aaa-plus/offene-punkte.md) | Was noch aussteht |
| [`aaa-plus/agent-graph.md`](aaa-plus/agent-graph.md) | Rollen im agentischen Programm |
| [`aaa-plus/test-architect-prompt.md`](aaa-plus/test-architect-prompt.md) | Prompt-Vorlage |
| [`aaa-plus/audits/state-coverage-matrix.md`](aaa-plus/audits/state-coverage-matrix.md) | Zustandsmatrix je Fläche — geltende Zielsetzung von `pnpm check:state-coverage` |
| `aaa-plus/progress.md` | **Protokoll.** Fortschrittsprotokoll, neueste Einträge oben |
| `aaa-plus/audits/2026-08-05-*.md` | **Protokoll.** Ist-Aufnahme zu einem Datum |
| `aaa-plus/evidence/2026-08-05-*.md` | **Protokoll.** Nachweise zu einem Lauf |
| `aaa-plus/critic-reports/*.md` | **Protokoll.** Bewertung eines Arbeitspakets |

## Laufendes Programm: Qualität 10/10 (2026-08)

`docs/qualitaet-2026-08/` ist **kein Archiv**: das Programm hat offene
Arbeitspakete. Nach Abschluss wandert das Verzeichnis nach `docs/archive/`.

| Datei | Rolle |
|---|---|
| [`qualitaet-2026-08/plan.md`](qualitaet-2026-08/plan.md) | Geltender Arbeitsplan: 7 Phasen, Arbeitspakete mit Akzeptanzkriterien, Vorentschiedenes |
| [`qualitaet-2026-08/audit.md`](qualitaet-2026-08/audit.md) | **Protokoll.** Qualitäts-Audit vom 2026-08-08 (`main@067244f`) — die Belege zum Plan |

## Protokoll: `docs/archive/`

Nichts hier ist eine geltende Regel. Jedes Dokument trägt oben einen Hinweis,
wofür es steht und wo die heutige Antwort steht.

| Datei | Was es festhält |
|---|---|
| `archive/claude-anweisung-und-produkt-audit-2026-06-21.md` | Produkt-Audit, 21.06.2026 |
| `archive/red-team-und-tokenstrategie-2026-06-21.md` | Plan des Red-Team-Laufs |
| `archive/red-team-ergebnisse-2026-06-21.md` | Befunde RT-01 bis RT-08, behoben |
| `archive/codequalitaet-audit-2026-07-02.md` | Repo-weiter Audit, 02.07.2026 |
| `archive/umsetzungsleitfaden-2026-07-02.md` | Task-Cards dazu, abgearbeitet |
| `archive/pentest-report-2026-07-18.md` | Pentest-Bericht |
| `archive/remediation-plan-2026-07-18.md` | Behebungsplan dazu, abgearbeitet |
| `archive/pentest-after-report-2026-07-18.md` | Nachbericht |
| `archive/technical-improvements-2026-06.md` | Sammelbericht bis Juni 2026, noch im Cloud-first-Rahmen |
| `archive/test-categories-2026-06.md` | Test-Inventar mit 783 Tests (heute 4634) |
| `archive/modul-2-ausgabentracker-spec.md` | Ehemalige Top-README |

## Nachschlagewerke der Werkzeuge

| Datei | Inhalt |
|---|---|
| [`../.claude/i18n-workflow.md`](../.claude/i18n-workflow.md) | i18n-Workflow Schritt für Schritt, neue Sprache hinzufügen |
| [`../src/features/*/README.md`](../src/features/) | Slice-eigene Kurzbeschreibungen |
| [`../research/forecasting/`](../research/forecasting/) | Vorarbeiten zur Prognose |

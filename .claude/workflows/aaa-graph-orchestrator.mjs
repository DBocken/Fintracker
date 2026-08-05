// Workflow-Skript für das Workflow-Tool. Wird nicht direkt von node ausgeführt —
// via `scriptPath` an das Tool übergeben. Liegt hier zur Wiederverwendung.
//
// Ausführbare Fassung des Entwurfs in docs/aaa-plus/agent-graph.md.
// Ersetzt die festen Critic-Ketten aus Implementierungsplan §10 durch einen
// gerichteten Graphen mit bedingten Kanten.
//
// Die drei tragenden Eigenschaften, alle als Code und nicht als Prompt-Bitte:
//
//  1. ROUTER MIT DETERMINISTISCHEM BODEN — `routeCritics()` leitet die
//     Pflichtprüfer aus einer Trigger-Matrix über die berührten Dateien ab.
//     Ein Modell darf Prüfer ergänzen, aber keinen streichen. Ohne diese
//     Asymmetrie routet ein auf Effizienz optimierendes Modell zuverlässig am
//     teuren Prüfer vorbei und meldet Erfolg.
//
//  2. MASCHINEN-GATE VOR DEN PRÜFERN — solange tsc/Tests rot sind, wird kein
//     Modell-Token für Kritik ausgegeben. Maschinelle Wahrheit ist billiger
//     als jedes Modellurteil und schlägt es im Zweifel.
//
//  3. EVIDENZ-GATE — jeder Befund wird von einem unabhängigen Verifier
//     angegriffen, dessen Auftrag WIDERLEGEN ist. Nicht reproduzierbare
//     Befunde werden zu `polish` herabgestuft und blockieren nicht. Das ist
//     der Hebel gegen plausibel klingende, unbelegbare Kritik, die sonst je
//     Befund eine volle Builder-Runde kostet, ohne etwas zu beheben.
//
// Modellstufen nach der Regel „Stärke dort, wo ein Fehler nicht von einem
// späteren Knoten gefangen wird": ein schwacher Builder wird vom Maschinen-Gate
// korrigiert, ein schwaches Gate-Urteil nicht.

export const meta = {
  name: 'aaa-graph-orchestrator',
  description:
    'Graph-basierte AAA+-Orchestrierung: ein Router waehlt je Artefakt Pruefer UND Modellstufe, statt eine feste Gauntlet-Kette abzuarbeiten',
  phases: [
    { title: 'Bauen', detail: 'ein Builder je Dateigruppe, disjunkte Dateien (Sonnet)' },
    { title: 'Maschinen-Gate', detail: 'tsc + betroffene Tests — vor jeder Kritik (Sonnet)' },
    { title: 'Pruefung', detail: 'router-gewaehlte Pruefer, parallel (Sonnet)' },
    { title: 'Verifikation', detail: 'adversarische Gegenprobe je Befund (Sonnet)' },
    { title: 'Gate', detail: 'Entscheidung bestanden/nacharbeiten/eskaliert (Opus)' },
  ],
}

// ---------------------------------------------------------------------------
// Trigger-Matrix: Dateimuster -> Pflichtprüfer. Der deterministische Boden.
// ---------------------------------------------------------------------------
const TRIGGERS = [
  { critic: 'a11y', always: true },
  { critic: 'regression', always: true },
  { critic: 'dataviz', match: /recharts|charts?\/|Chart|Sankey|analysis-data/i },
  { critic: 'motion', match: /motion-tokens|framer-motion|Animation|transition/i },
  { critic: 'performance', match: /finance-city|three|canvas|WebGL/i },
  { critic: 'artdirection', match: /index\.css|skins|tailwind\.config|material-tokens/i },
  { critic: 'architecture', match: /src\/services\/|money|domain\//i },
]

const CRITIC_BRIEF = {
  a11y:
    'Accessibility Critic. Fokus, Tastatur, Kontrast, Screenreader-Semantik, prefers-reduced-motion. ' +
    'Nicht kompensierbar: jede Verletzung ist mindestens `critical`.',
  regression:
    'Regression Critic. Bestehende Funktionen, Datenintegritaet, geloeschte oder abgeschwaechte Tests. ' +
    'Eine entfernte Assertion ohne Begruendung ist `blocker`.',
  dataviz:
    'Data-Viz Critic. Fachliche Korrektheit der Darstellung, Skalen, Lesbarkeit, barrierefreie Alternative. ' +
    'Falsche Finanzdarstellung ist `blocker`.',
  motion:
    'Motion Director. Timing, Konsistenz der Bewegungssprache, Abbruchbarkeit, reduced-motion. ' +
    'Referenz: Linear (expo-out-Konsistenz).',
  performance: 'Performance Critic. Ladezeit, Frame Rate, Speicher, Mobile (375px).',
  artdirection: 'Art Director. Visuelle Identitaet, Komposition, Hierarchie, Token-Konsistenz.',
  architecture:
    'Product Architect. Schichtentrennung (lib/services/hooks/components), Datenmodell, ' +
    'Geld als Integer-Cent, Aggregation ueber @/lib/analysis-data.',
}

/**
 * Der Router. Deterministischer Boden aus der Trigger-Matrix; die Modellstufe
 * haengt am Knotentyp, nicht am Zufall.
 */
function routeCritics(files) {
  const blob = files.join('\n')
  return TRIGGERS.filter((t) => t.always || t.match.test(blob)).map((t) => t.critic)
}

const REPO_RULES = `
Verbindlich (AGENTS.md):
- Tests nur in __tests__/ neben dem Code. Testtitel deutsch: it('sollte ...').
- Kein hardcodierter UI-Text; alles ueber i18n (t()/serviceT), alle SUPPORTED_LOCALES.
- Geld ist Integer-Cent ueber @/lib/money.ts. Aggregation nur ueber @/lib/analysis-data.
- UI nur shadcn/@/components/ui + Tailwind-Utilities. Keine neuen Abhaengigkeiten.
- Bestehende Tests werden weder geloescht noch abgeschwaecht.
- Kommentare nur fuer nicht-offensichtliche WARUM-Gruende, auf Deutsch.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'claim', 'evidence'],
        properties: {
          severity: { type: 'string', enum: ['blocker', 'critical', 'major', 'minor', 'polish'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          claim: { type: 'string', description: 'Ein Satz: was ist defekt' },
          evidence: {
            type: 'string',
            description:
              'REPRODUKTION: fehlschlagender Test, axe-Regel-ID, tsc-Fehler, Messwert oder Datei+Zeile ' +
              'mit konkret falscher Aussage. Ohne das wird der Befund zu polish herabgestuft.',
          },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    adjustedSeverity: {
      type: 'string',
      enum: ['blocker', 'critical', 'major', 'minor', 'polish'],
    },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filesChanged', 'summary', 'seriesMigrated'],
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    seriesMigrated: { type: 'integer', description: 'Anzahl migrierter Recharts-Serien' },
    summary: { type: 'string' },
    skipped: { type: 'array', items: { type: 'string' }, description: 'Bewusst nicht geaendert, mit Grund' },
  },
}

const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'reasons'],
  properties: {
    decision: { type: 'string', enum: ['bestanden', 'nacharbeiten', 'eskaliert'] },
    reasons: { type: 'array', items: { type: 'string' } },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
}

// ---------------------------------------------------------------------------
// Auftrag
// ---------------------------------------------------------------------------
const task = args ?? {}
const GROUPS = task.groups ?? []
const GOAL = task.goal ?? ''
const SPEC = task.spec ?? ''

const allFiles = GROUPS.flatMap((g) => g.files)
const critics = routeCritics(allFiles)

log(`Graph: ${GROUPS.length} Baugruppen, ${allFiles.length} Dateien.`)
log(`Router waehlt ${critics.length} Pruefer: ${critics.join(', ')} (Pflichtmenge aus der Trigger-Matrix).`)

// --- Phase 1: Bauen. Disjunkte Dateien -> echt parallel, keine Worktrees noetig.
phase('Bauen')
const builds = await parallel(
  GROUPS.map((g) => () =>
    agent(
      `Du bist Builder im FinTracker AAA+ Programm, Gruppe "${g.label}".

## Ziel
${GOAL}

## Spezifikation (verbindlich, nichts dazuerfinden)
${SPEC}

## Deine Dateien — AUSSCHLIESSLICH diese
${g.files.map((f) => `- ${f}`).join('\n')}

Andere Dateien fasst du NICHT an. Andere Builder arbeiten zeitgleich an
benachbarten Dateien; jede Aenderung ausserhalb deiner Liste geht verloren
oder zerstoert deren Arbeit.

${REPO_RULES}

## Vorgehen
1. Lies jede deiner Dateien vollstaendig.
2. Wende die Spezifikation an.
3. Pruefe dein Ergebnis mit:
   npx --yes pnpm@10.12.4 exec tsc --noEmit
   Nur deine eigenen Fehler behebst du.
4. Melde zurueck, was du geaendert hast.

Wenn eine Datei die Spezifikation nachweislich nicht braucht, aendere sie
NICHT und trage sie mit Begruendung unter "skipped" ein. Ein unnoetiger
Diff ist schlechter als kein Diff.`,
      { label: `builder:${g.label}`, phase: 'Bauen', model: 'sonnet', schema: BUILD_SCHEMA },
    ),
  ),
)

const ok = builds.filter(Boolean)
const changed = ok.flatMap((b) => b.filesChanged ?? [])
log(`Gebaut: ${ok.length}/${GROUPS.length} Gruppen, ${changed.length} Dateien geaendert.`)

// --- Phase 2: Maschinen-Gate. Kante M->R: keine Kritik, solange die Maschine rot ist.
phase('Maschinen-Gate')
const machine = await agent(
  `Du bist das Maschinen-Gate. Du urteilst NICHT ueber Qualitaet — du fuehrst aus und berichtest.

Fuehre nacheinander aus und berichte je Schritt Exitcode und die relevanten Zeilen:

1. npx --yes pnpm@10.12.4 exec tsc --noEmit
2. npx --yes pnpm@10.12.4 lint
3. npx --yes pnpm@10.12.4 exec vitest run src/hooks/__tests__/useChartAnimation.test.ts src/lib/__tests__/motion-tokens.test.ts

Danach die Testdateien der geaenderten Komponenten, sofern vorhanden:
${changed.map((f) => `- ${f}`).join('\n')}
Finde sie ueber die __tests__/-Ordner daneben und fuehre genau die aus.

Wenn tsc Fehler meldet, die eindeutig aus dieser Migration stammen (falsche
Prop-Typen, fehlende Importe, Hook-Aufruf ausserhalb der Komponente), behebe
sie direkt und fuehre erneut aus. Alles andere meldest du nur.

Gib am Ende einen knappen Bericht: was gruen, was rot, was du behoben hast.`,
  { label: 'maschinen-gate', phase: 'Maschinen-Gate', model: 'sonnet' },
)

// --- Phase 3+4: Pruefung, jeder Befund sofort adversarisch gegengeprueft.
// pipeline statt parallel: kein Barrier zwischen Pruefen und Verifizieren.
phase('Pruefung')
const reviewed = await pipeline(
  critics,
  (critic) =>
    agent(
      `Du bist ${CRITIC_BRIEF[critic]}

Du bewertest folgende Aenderung im FinTracker-Repository:

## Ziel
${GOAL}

## Spezifikation
${SPEC}

## Geaenderte Dateien
${changed.map((f) => `- ${f}`).join('\n')}

## Maschinen-Gate (bereits gelaufen)
${String(machine ?? '(kein Bericht)').slice(0, 2000)}

Du bekommst NICHT: die Begruendungen der Builder, ihre Selbsteinschaetzung
oder Hinweise darauf, was aufwendig war. Urteile allein am Ergebnis.

## Beweispflicht
Jeder Befund braucht eine REPRODUKTION: ein fehlschlagender Test, eine
axe-Regel-ID, ein tsc-Fehler, ein Messwert, oder Datei+Zeile mit konkret
falscher Aussage. Ein Befund, den du nicht belegen kannst, gehoert nach
\`polish\` — nicht nach \`major\`. Lieber drei belegte Befunde als zehn
plausible.

Schlage keine Loesungen vor. Benenne Probleme.`,
      { label: `pruefer:${critic}`, phase: 'Pruefung', model: 'sonnet', schema: FINDINGS_SCHEMA },
    ),
  (review, critic) =>
    parallel(
      (review?.findings ?? [])
        .filter((f) => f.severity !== 'polish')
        .map((f) => () =>
          agent(
            `Du bist Verifier. Dein Auftrag ist zu WIDERLEGEN, nicht zu bestaetigen.

## Behauptung (${critic}, ${f.severity})
${f.claim}
Datei: ${f.file}${f.line ? `:${f.line}` : ''}

## Angegebene Reproduktion
${f.evidence}

## Auftrag
Lies die Datei. Pruefe die Reproduktion nach — fuehre den genannten Test aus,
pruefe die genannte Zeile, rechne den Messwert nach.

Setze \`refuted: true\`, wenn eines zutrifft:
- die Reproduktion laesst sich nicht nachvollziehen
- die Zeile sagt etwas anderes als behauptet
- das Verhalten ist beabsichtigt und dokumentiert
- der Befund beschreibt einen Zustand, der schon vor dieser Aenderung bestand

Im Zweifel: \`refuted: true\`. Ein falsch bestaetigter Befund kostet eine
volle Builder-Runde und behebt nichts.`,
            { label: `verifier:${f.file.split('/').pop()}`, phase: 'Verifikation', model: 'sonnet', schema: VERDICT_SCHEMA },
          ).then((v) => ({ ...f, critic, verdict: v })),
        ),
    ),
)

const confirmed = reviewed
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict && !f.verdict.refuted)

const blocking = confirmed.filter((f) =>
  ['blocker', 'critical', 'major'].includes(f.verdict?.adjustedSeverity ?? f.severity),
)

log(`Befunde bestaetigt: ${confirmed.length}, davon blockierend: ${blocking.length}.`)

// --- Phase 5: Gate. Opus, weil ein Fehler hier von keinem spaeteren Knoten gefangen wird.
phase('Gate')
const gate = await agent(
  `Du bist der Orchestrator und triffst die Gate-Entscheidung.

## Ziel
${GOAL}

## Bauergebnis
${ok.map((b) => `- ${b.summary} (${b.seriesMigrated} Serien)`).join('\n')}

## Maschinen-Gate
${String(machine ?? '').slice(0, 2000)}

## Bestaetigte Befunde (Verifier hat sie NICHT widerlegt)
${confirmed.length === 0 ? '(keine)' : confirmed.map((f) => `- [${f.verdict?.adjustedSeverity ?? f.severity}] ${f.file}: ${f.claim}\n  Beleg: ${f.evidence}`).join('\n')}

## Regeln
- Nicht kompensierbar: Accessibility, funktionale Richtigkeit, Performance.
  Eine Verletzung fuehrt unabhaengig vom Gesamtbild zu "nacharbeiten".
- Bei Zielkonflikt gilt: Accessibility > Performance > Funktionalitaet >
  Art Direction > Motion.
- "bestanden" nur, wenn das Maschinen-Gate gruen ist und kein blockierender
  Befund offen ist.
- "eskaliert" heisst NICHT bestanden: benenne dann den offenen Punkt so
  konkret, dass ein Mensch ihn ohne Rueckfrage entscheiden kann.

Entscheide knapp und begruendet.`,
  { label: 'gate', phase: 'Gate', model: 'opus', schema: GATE_SCHEMA },
)

return {
  gebaut: ok.map((b) => ({ summary: b.summary, files: b.filesChanged, series: b.seriesMigrated, skipped: b.skipped })),
  maschinenGate: String(machine ?? '').slice(0, 3000),
  gewaehlteP: critics,
  befundeGesamt: reviewed.flat().filter(Boolean).length,
  befundeBestaetigt: confirmed,
  blockierend: blocking.length,
  gate,
}

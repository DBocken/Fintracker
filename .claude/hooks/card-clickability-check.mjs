#!/usr/bin/env node
// Karten-Klickbarkeit-Check (Fintracker).
//
// Regel (aus dem Usability-Test): Eine Fläche, die wie eine KARTE aussieht
// (Rahmen + Hintergrund + Schatten/Elevation), MUSS als Ganzes anklickbar sein
// und entweder navigieren (Link), ein Popup/Sheet/Dialog öffnen oder auf-/
// zuklappen (Akkordion). Reine Anzeige-Info OHNE Follow-up gehört NICHT in eine
// Karte, sondern wird gebündelt und ohne Karten-Chrome dargestellt.
//
// Bausteine:
//   - Klickbare Karte  → <InteractiveCard to|href|onClick ... />
//   - Reines Readout   → <InfoGroup> / <InfoStatStrip> (kein Rahmen/Schatten)
//
// Dieser PostToolUse-Hook erinnert nach Bearbeitung einer UI-Datei, wenn
// Karten-Chrome auftaucht, ohne dass die Fläche klickbar ist (oder ohne dass
// die karten-lose Readout-Variante genutzt wird). Rein hinweisend (Exit 0).

import fs from "node:fs";

function main() {
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    return;
  }

  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    return;
  }

  const fp = data?.tool_input?.file_path || data?.tool_response?.filePath || "";
  if (!/src\/.+\.tsx$/.test(fp)) return;
  if (/\.(test|spec)\.tsx?$/.test(fp) || /__tests__/.test(fp)) return;
  // Die Primitive selbst und die UI-Basis-Karte sind Definitionen, keine Nutzung.
  if (/src\/components\/(ui\/card|common\/(InteractiveCard|InfoGroup))\.tsx$/.test(fp)) return;

  let content = "";
  try {
    content = fs.readFileSync(fp, "utf8");
  } catch {
    return;
  }

  // Karten-Chrome erkennen: <Card>-Komponente, .ds-section/.ds-summary-card,
  // oder ad-hoc „rounded-* … border … bg-card“-Boxen mit Schatten.
  const usesCardComponent = /<Card(\s|>|\/)/.test(content) || /<CardContent(\s|>)/.test(content);
  const usesDsSection = /\bds-section\b|\bds-summary-card\b/.test(content);
  const adHocCard =
    /className="[^"]*\brounded-(?:lg|xl|2xl)\b[^"]*\bborder\b[^"]*\bbg-card\b[^"]*"/.test(content) ||
    /className="[^"]*\bbg-card\b[^"]*\bborder\b[^"]*\bshadow/.test(content);
  const hasCardChrome = usesCardComponent || usesDsSection || adHocCard;
  if (!hasCardChrome) return;

  // Interaktivitäts-Signale (irgendwo in der Datei).
  const hasInteractivity =
    /\bInteractiveCard\b/.test(content) ||
    /\bonClick=/.test(content) ||
    /<Link\b/.test(content) ||
    /\bto=|\bhref=/.test(content) ||
    /\bSheetTrigger\b|\bDialogTrigger\b|\bPopoverTrigger\b|\bAccordionTrigger\b/.test(content) ||
    /role="button"/.test(content) ||
    /\buseNavigate\b/.test(content);

  // Karten-lose Readout-Variante genutzt?
  const usesInfoGroup = /\bInfoGroup\b|\bInfoStatStrip\b/.test(content);

  let msg = "";
  if (!hasInteractivity && !usesInfoGroup) {
    msg =
      `Karten-Regel: ${fp} enthält Karten-Chrome (Rahmen/Hintergrund/Schatten), aber keine ` +
      `Klick-Aktion. Karten müssen als Ganzes klickbar sein (Link/Popup/Akkordion) → ` +
      `<InteractiveCard to|href|onClick …>. Reine Info OHNE Follow-up gehört ohne Karte ` +
      `dargestellt → <InfoGroup>/<InfoStatStrip>. (Falls es ein Dialog-/Formular-/Chart-` +
      `Container ist: ok, dann bewusst ignorieren.)`;
  } else {
    msg =
      `Karten-Regel: In ${fp} bitte sicherstellen, dass die GANZE Kartenfläche das ` +
      `Klick-Ziel ist (nicht nur ein verschachtelter Button/Link) und eine Affordanz ` +
      `zeigt (Chevron, Hover, Fokusring, Touch-Ziel ≥ 44px). Baustein: <InteractiveCard>. ` +
      `Reine Anzeige-Info ohne Follow-up → <InfoGroup>/<InfoStatStrip> (ohne Karte).`;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
    }),
  );
}

main();

#!/usr/bin/env node
// Animations-Baseline-Check (Fintracker).
//
// Baseline: Unsere eigene, datengetriebene Implementierung (SVG/Framer/CSS/rAF/
// Recharts). Visualisierte Daten werden *aufgebaut* (animiert eingeblendet),
// nicht aufgepoppt – und berücksichtigen immer Daten & Schwellwerte. Lottie ist
// NICHT Baseline, sondern eine Option, die wir künftig prüfen.
//
// Dieser PostToolUse-Hook erinnert nach Bearbeitung einer UI-Datei, wenn
// visualisierte Daten ohne Aufbau-Animation auftauchen. Rein hinweisend (Exit 0).

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
  if (!/src\/.+\.(tsx|ts)$/.test(fp)) return;
  if (/\.(test|spec)\.tsx?$/.test(fp) || /__tests__/.test(fp)) return;

  let content = "";
  try {
    content = fs.readFileSync(fp, "utf8");
  } catch {
    return;
  }

  // Anti-Pattern: aufpoppende Daten – Aufbau-Animation explizit deaktiviert.
  const popsIn = /isAnimationActive\s*=\s*\{?\s*false\s*\}?/.test(content);
  const isChart = /from\s+['"]recharts['"]/.test(content);

  let msg = "";
  if (popsIn) {
    msg =
      `Animations-Baseline: In ${fp} steht isAnimationActive={false} – damit *poppen* die Daten auf. ` +
      `Baseline: visualisierte Daten werden aufgebaut (animiert eingeblendet), nicht sofort gesetzt. ` +
      `Aufbau aktivieren oder die Ausnahme kurz begründen. (prefers-reduced-motion wird separat behandelt.)`;
  } else if (isChart) {
    msg =
      `Animations-Baseline: Chart in ${fp} erkannt. Daten sollen sich aufbauen (Recharts-Aufbau-Animation ` +
      `aktiv lassen) und Daten/Schwellwerte berücksichtigen (z. B. Farbe/Status ab Schwelle, wie beim Tank). ` +
      `Lottie ist optional (Zukunft), nicht erforderlich.`;
  } else {
    return;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
    }),
  );
}

main();

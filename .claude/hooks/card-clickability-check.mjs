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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeCardRule } from "../../scripts/card-rule-core.mjs";

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

  // Dieselbe Prueflogik wie `pnpm check:card-rule` — WP-8.0 hat sie nach
  // `scripts/card-rule-core.mjs` gezogen. Vorher stand sie hier ein zweites
  // Mal; zwei Fassungen derselben Regel waeren auseinandergelaufen, und die
  // maschinelle Pruefung haette dann etwas anderes gemeint als der Hinweis.
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const relative = path.relative(repoRoot, fp).split(path.sep).join("/");
  const { violates, reason } = analyzeCardRule(relative, content);

  const msg = violates
    ? `Karten-Regel: ${relative} — ${reason}`
    : `Karten-Regel: In ${relative} bitte sicherstellen, dass die GANZE Kartenflaeche das ` +
      `Klick-Ziel ist (nicht nur ein verschachtelter Button/Link) und eine Affordanz ` +
      `zeigt (Chevron, Hover, Fokusring, Touch-Ziel >= 44px). Baustein: <InteractiveCard>. ` +
      `Reine Anzeige-Info ohne Follow-up → <InfoGroup>/<InfoStatStrip> (ohne Karte).`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
    }),
  );
}

main();

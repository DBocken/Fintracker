#!/usr/bin/env node
// Animations-Baseline-Check (Fintracker).
//
// Lottie ist die Animations-Baseline dieses Projekts. Dieser PostToolUse-Hook
// erinnert Claude nach jeder Bearbeitung einer UI-Datei daran, die gewählte
// Animationstechnik gegen die Baseline zu prüfen. Er erkennt *echte*
// Animationsmuster (framer-motion, requestAnimationFrame, @keyframes, CSS
// `animation:`) und ignoriert bewusst Tailwind-`transition`-Utilities, um
// Rauschen zu vermeiden. Rein hinweisend – blockiert nie (Exit 0).

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
  // Nur UI-Quellcode unter src/ (Tests ausgenommen).
  if (!/src\/.+\.(tsx|ts|css)$/.test(fp)) return;
  if (/\.(test|spec)\.(tsx?|css)$/.test(fp) || /__tests__/.test(fp)) return;

  let content = "";
  try {
    content = fs.readFileSync(fp, "utf8");
  } catch {
    return;
  }

  const usesLottie = /lottie|dotlottie/i.test(content);
  const found = [];
  if (/framer-motion/.test(content)) found.push("framer-motion");
  if (/requestAnimationFrame/.test(content)) found.push("requestAnimationFrame");
  if (/@keyframes/.test(content)) found.push("@keyframes");
  if (fp.endsWith(".css") && /\banimation\s*:/.test(content)) found.push("CSS animation");

  // Compliant (Lottie genutzt) oder keine echte Animation → nichts melden.
  if (usesLottie || found.length === 0) return;

  const msg =
    `Animations-Baseline-Check: In ${fp} wurde ${found.join(", ")} erkannt, aber kein Lottie. ` +
    `Lottie ist die Animations-Baseline dieses Projekts. Prüfe, ob hier eine Lottie-Animation ` +
    `passender ist – oder halte kurz fest (Code-Kommentar/PR-Notiz), warum ${found.join("/")} ` +
    `bewusst gewählt wurde (z. B. Micro-Interaction/Layout-Transition, für die Lottie ungeeignet ist).`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
    }),
  );
}

main();

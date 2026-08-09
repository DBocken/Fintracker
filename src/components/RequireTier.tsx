"use client";

import type { ReactNode } from "react";
import { FeatureGate } from "@/components/FeatureGate";
import type { FeatureKey } from "@/lib/tier";

type RequireTierProps = {
  feature: FeatureKey;
  children: ReactNode;
  /** Eigener Fallback statt des Standard-Locked-Previews. */
  fallback?: ReactNode;
};

/**
 * @deprecated Dünner Kompatibilitäts-Wrapper um {@link FeatureGate}.
 *
 * Die Guard-Logik (inkl. Login- vs. Premium-Story) lebt jetzt
 * zentral in `FeatureGate`/`PremiumUpsell`. Neue Aufrufer sollten direkt
 * `<FeatureGate>` verwenden; dieser Export bleibt nur, um bestehende
 * Importe nicht zu brechen.
 *
 * **Warum diese Datei bei WP 6.7 NICHT nach `features/shared/presentation/`
 * gezogen ist**, obwohl sie bis dahin unter `src/components/common/` lag: Sie
 * ist kein app-eigener Baustein im Sinne von AGENTS.md §8/§9, sondern ein
 * Alias auf ein Gate — und `FeatureGate` gilt der Codebasis ausdrücklich als
 * Infrastruktur, nicht als Darstellung (`istInfrastruktur()` in
 * `scripts/view-data-core.mjs`, benutzt von `check:view-data` und
 * `check:layers`). Sie gehört deshalb neben das Gate, das sie wrappt.
 *
 * Das ist keine nachträgliche Begründung für eine Zahl, sondern der Grund,
 * warum die Zahl es überhaupt gemeldet hat: Als einzige Datei des Umzugs
 * importiert sie aus `src/components/` und wäre in
 * `features/shared/presentation/` als Import in die Alt-Oberfläche gezählt
 * worden (`max` 12 → 13, eine Ratsche, die nur sinken darf). Die Alternative
 * wäre eine Infrastruktur-Ausnahme in der Zählregel gewesen — eine
 * Sonderregel für die ganze App, um eine einzige deprecated Datei am falschen
 * Ort zu halten.
 */
export default function RequireTier({ feature, children, fallback }: RequireTierProps) {
  return (
    <FeatureGate feature={feature} fallback={fallback}>
      {children}
    </FeatureGate>
  );
}

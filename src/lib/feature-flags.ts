/**
 * Feature-Flags (WP-11.1) — reine Domänenlogik, kein React, kein I/O.
 *
 * **Wozu sie hier da sind.** Phase 11 nennt „Feature Flags" und „Rollback" in
 * einem Atemzug, und das ist kein Zufall: In einer local-first App gibt es
 * keinen Server, auf dem man eine misslungene Funktion einfach abschaltet. Die
 * App liegt auf dem Gerät und läuft weiter. Ein Flag ist deshalb hier der
 * einzige Rückwärtsgang, den es überhaupt gibt.
 *
 * **Was ein Flag NICHT ist.** Kein A/B-Test und kein Ersatz für eine
 * Entscheidung. Jedes Flag hat einen Grund und ein Ablaufdatum im Kopf; ein
 * Flag, das drei Versionen alt ist und immer noch beide Zweige trägt, ist eine
 * Verzweigung, die niemand mehr versteht. `staleFlags()` macht das sichtbar,
 * statt darauf zu vertrauen, dass jemand daran denkt.
 *
 * **Warum die Voreinstellung im Code steht und nicht im Speicher.** Eine
 * gespeicherte Voreinstellung wäre eine zweite Quelle der Wahrheit: Wer sie
 * einmal gesetzt hat, bekommt eine spätere Korrektur nie zu sehen. Gespeichert
 * wird ausschließlich die *Abweichung* einer Person von der Voreinstellung.
 */

export type FeatureFlagKey =
  | 'telemetry'
  | 'feedback'
  | 'financeCity3d'
  | 'bankSync';

export type FeatureFlagDefinition = {
  /** Voreinstellung. Neues und Riskantes startet aus. */
  readonly defaultEnabled: boolean;
  /**
   * Darf eine Person das selbst umschalten? `false` heisst: reiner
   * Not-Aus-Schalter für einen Auslieferungsfehler, nicht in den Einstellungen.
   */
  readonly userToggleable: boolean;
  /** Version, mit der das Flag eingeführt wurde — Grundlage für `staleFlags`. */
  readonly since: string;
  /** Warum es dieses Flag gibt. Ohne Grund kein Flag. */
  readonly reason: string;
};

/**
 * Die Flags dieser App. Bewusst wenige und bewusst benannt: Ein Flag pro
 * Funktion, die im Zweifel abschaltbar sein muss.
 */
export const FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>> = {
  telemetry: {
    defaultEnabled: false,
    userToggleable: true,
    since: '1.3.0',
    reason:
      'Opt-in-Telemetrie (decision-log F-1). Aus in der Voreinstellung — alles andere waere kein Opt-in.',
  },
  feedback: {
    defaultEnabled: true,
    userToggleable: false,
    since: '1.3.0',
    reason:
      'Rueckmeldung aus der App heraus. Abschaltbar, falls der Empfaenger ausfaellt — ein Formular ins Leere ist schlimmer als keins.',
  },
  financeCity3d: {
    defaultEnabled: true,
    userToggleable: false,
    since: '1.0.0',
    reason:
      'WebGL-Stadt. Der Not-Aus fuer Geraete/Treiber, auf denen sie die App mitreisst — die Listenansicht traegt dieselben Daten.',
  },
  bankSync: {
    defaultEnabled: false,
    userToggleable: true,
    since: '1.2.0',
    reason:
      'Bankabgleich ueber GoCardless. Aus in der Voreinstellung, weil er Daten das Geraet verlassen laesst.',
  },
};

/** Gespeichert wird nur die Abweichung von der Voreinstellung. */
export type FeatureFlagOverrides = Partial<Record<FeatureFlagKey, boolean>>;

export function isFeatureEnabled(key: FeatureFlagKey, overrides: FeatureFlagOverrides): boolean {
  const override = overrides[key];
  return override === undefined ? FEATURE_FLAGS[key].defaultEnabled : override;
}

/**
 * Liest gespeicherte Abweichungen und wirft weg, was nicht mehr passt.
 *
 * Unbekannte Schlüssel entstehen zwangsläufig: Ein Flag wird entfernt, die
 * Einstellung von gestern kennt es noch. Sie hier still zu übernehmen hiesse,
 * sie für immer mitzuschleppen.
 */
export function parseOverrides(raw: unknown): FeatureFlagOverrides {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: FeatureFlagOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in FEATURE_FLAGS)) continue;
    if (typeof value !== 'boolean') continue;
    out[key as FeatureFlagKey] = value;
  }
  return out;
}

/**
 * Abweichungen, die eine Person selbst nicht setzen durfte, gehören nicht in
 * ihren Speicher — sonst wäre der Not-Aus über die Einstellungen aushebelbar.
 */
export function userSettableOverrides(overrides: FeatureFlagOverrides): FeatureFlagOverrides {
  const out: FeatureFlagOverrides = {};
  for (const [key, value] of Object.entries(overrides) as [FeatureFlagKey, boolean][]) {
    if (FEATURE_FLAGS[key].userToggleable) out[key] = value;
  }
  return out;
}

/** Vergleicht zwei Versionsangaben („1.10.0" > „1.9.0", nicht als Text). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Flags, die seit `maxMinorAge` Nebenversionen unverändert mitlaufen.
 *
 * Nicht als Fehlschlag gedacht, sondern als Frage: Ist die Funktion
 * angekommen? Dann kann der andere Zweig weg. Ist sie es nicht? Dann auch.
 */
export function staleFlags(currentVersion: string, maxMinorAge = 2): FeatureFlagKey[] {
  const [major, minor] = currentVersion.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).filter((key) => {
    const [flagMajor, flagMinor] = FEATURE_FLAGS[key].since
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
    if (flagMajor < major) return true;
    return flagMajor === major && minor - flagMinor >= maxMinorAge;
  });
}

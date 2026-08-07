import { describe, it, expect } from 'vitest';
import {
  FEATURE_FLAGS,
  compareVersions,
  isFeatureEnabled,
  parseOverrides,
  staleFlags,
  userSettableOverrides,
  type FeatureFlagKey,
} from '../feature-flags';

/**
 * WP-11.1 — Feature-Flags.
 *
 * In einer local-first App gibt es keinen Server, auf dem man eine misslungene
 * Funktion abschaltet. Die App liegt auf dem Gerät. Ein Flag ist deshalb der
 * einzige Rückwärtsgang, den Phase 11 überhaupt anbieten kann — und muss
 * entsprechend belastbar sein.
 */

describe('isFeatureEnabled', () => {
  it('sollte ohne Abweichung die Voreinstellung liefern', () => {
    expect(isFeatureEnabled('telemetry', {})).toBe(false);
    expect(isFeatureEnabled('feedback', {})).toBe(true);
  });

  it('sollte eine gespeicherte Abweichung anwenden', () => {
    expect(isFeatureEnabled('telemetry', { telemetry: true })).toBe(true);
    expect(isFeatureEnabled('feedback', { feedback: false })).toBe(false);
  });

  it('[SECURITY] sollte Telemetrie in der Voreinstellung AUS haben', () => {
    // `decision-log` F-1: Opt-in. Eine Voreinstellung „an" waere kein Opt-in,
    // sondern ein Opt-out mit anderem Namen.
    expect(FEATURE_FLAGS.telemetry.defaultEnabled).toBe(false);
  });

  it('[SECURITY] sollte den Bankabgleich in der Voreinstellung AUS haben', () => {
    // Er laesst Daten das Geraet verlassen — dieselbe Begruendung.
    expect(FEATURE_FLAGS.bankSync.defaultEnabled).toBe(false);
  });
});

describe('parseOverrides', () => {
  it('sollte unbekannte Schluessel verwerfen', () => {
    // Ein entferntes Flag lebt in gespeicherten Einstellungen weiter. Es hier
    // still zu uebernehmen hiesse, es fuer immer mitzuschleppen.
    expect(parseOverrides({ telemetry: true, laengstEntfernt: true })).toEqual({ telemetry: true });
  });

  it('sollte Werte verwerfen, die keine Wahrheitswerte sind', () => {
    expect(parseOverrides({ telemetry: 'ja' })).toEqual({});
  });

  it.each([null, undefined, 'text', 42])('sollte %s als leer behandeln', (raw) => {
    expect(parseOverrides(raw)).toEqual({});
  });
});

describe('userSettableOverrides', () => {
  it('[SECURITY] sollte den Not-Aus nicht ueber die Einstellungen aushebelbar machen', () => {
    // `financeCity3d` ist der Not-Aus fuer Geraete, auf denen WebGL die App
    // mitreisst. Koennte man ihn im Speicher ueberschreiben, waere er keiner.
    expect(FEATURE_FLAGS.financeCity3d.userToggleable).toBe(false);
    expect(userSettableOverrides({ financeCity3d: true, telemetry: true })).toEqual({
      telemetry: true,
    });
  });
});

describe('compareVersions', () => {
  it('[REGRESSION] sollte 1.10.0 als neuer als 1.9.0 erkennen', () => {
    // Als Text verglichen waere "1.10.0" < "1.9.0" — der Klassiker.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  });

  it('sollte Gleichstand erkennen', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('sollte fehlende Stellen als 0 lesen', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBe(1);
  });
});

describe('staleFlags', () => {
  it('sollte Flags melden, die zwei Nebenversionen alt sind', () => {
    // Ein Flag, das lange beide Zweige traegt, ist eine Verzweigung, die
    // niemand mehr versteht — die Frage danach soll automatisch kommen.
    expect(staleFlags('1.5.0')).toContain('financeCity3d');
  });

  it('sollte ein frisches Flag in Ruhe lassen', () => {
    expect(staleFlags('1.3.0')).not.toContain('telemetry');
  });

  it('sollte alle Flags einer aelteren Hauptversion melden', () => {
    expect(staleFlags('2.0.0').sort()).toEqual(
      (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).sort(),
    );
  });
});

describe('Flag-Register', () => {
  it('sollte fuer jedes Flag einen Grund und eine Version fuehren', () => {
    // Ein Flag ohne Begruendung ist eine Verzweigung ohne Absicht.
    for (const [key, definition] of Object.entries(FEATURE_FLAGS)) {
      expect(definition.reason.length, key).toBeGreaterThan(20);
      expect(definition.since, key).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

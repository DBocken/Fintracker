/**
 * FinRisk – Risiko-Diagnose (v27)
 *
 * Erzeugt aus den Modellresultaten eine klare, nicht-moralisierende Aussage –
 * keine reine P10/P50/P90-Wiedergabe. Folgt den Wording-Leitplanken aus
 * `PRODUCT_LOGIC.md` §3: keine Finanzberatung, keine absolute „maximal”-Aussage
 * (immer mit Sicherheitsniveau), keine Sicherheits-Versprechen.
 */
import type { StressCapacityLevel } from './scenario-payload-types';
import type { LumpyRiskProfile } from './lumpy-risk';
import { t } from '../../i18n/serviceT';

export interface RiskDiagnosisInput {
  /** Median-Endstand der Basis-Projektion. */
  baselineEndP50: number;
  /** Median-Endstand nach Szenario. */
  scenarioEndP50: number;
  /** Stress-Tragfähigkeit je Sicherheitsniveau. */
  stressCapacity: StressCapacityLevel[];
  /** Optionales Lumpy-Risikoprofil aus der Historie. */
  lumpy?: LumpyRiskProfile;
  /**
   * Maßgebliche Sicherheitsschwelle (Puffer) in EUR. Bestimmt, ob die Basis
   * selbst tragfähig ist. Fallback: Schwelle aus der Stress-Capacity, sonst 0.
   */
  threshold?: number;
}

export interface RiskDiagnosis {
  summary: string;
  baselineEndP50: number;
  scenarioEndP50: number;
  deltaEndP50: number;
}

/** Wählt die Stress-Capacity zum (oder nahe am) 90 %-Niveau. */
function pickCapacity(levels: StressCapacityLevel[]): StressCapacityLevel | null {
  if (levels.length === 0) return null;
  return (
    levels.find((l) => Math.abs(l.confidenceLevel - 0.9) < 1e-9) ??
    [...levels].sort(
      (a, b) => Math.abs(a.confidenceLevel - 0.9) - Math.abs(b.confidenceLevel - 0.9),
    )[0]
  );
}

/**
 * Baut die Diagnose-Zusammenfassung. Reine Funktion ohne IO.
 */
export function generateRiskDiagnosis(input: RiskDiagnosisInput): RiskDiagnosis {
  const delta = Math.round((input.scenarioEndP50 - input.baselineEndP50) * 100) / 100;
  const parts: string[] = [];

  // Die Eröffnung MUSS die Basis-Lage widerspiegeln. Eine bedingungslose
  // Entwarnung ist für ein Liquiditäts-Risiko-Tool der schädlichste Fehler:
  // Wer ohnehin auf ein Minus zusteuert, darf nicht zuerst „kommst du hin" lesen.
  const threshold = input.threshold ?? input.stressCapacity[0]?.thresholdAmount ?? 0;
  if (input.baselineEndP50 < 0) {
    parts.push(t('finrisk.diagnosisWarning1'));
  } else if (threshold > 0 && input.baselineEndP50 < threshold) {
    parts.push(t('finrisk.diagnosisWarning2'));
  } else {
    parts.push(t('finrisk.diagnosisBasicOk'));
  }

  if (input.lumpy && input.lumpy.lumpyCount > 0) {
    if (input.lumpy.lumpyRiskLevel === 'high') {
      parts.push(t('finrisk.diagnosisLumpyHigh'));
    } else {
      parts.push(t('finrisk.diagnosisLumpyMod'));
    }
  }

  if (delta < -1000) parts.push(t('finrisk.diagnosisMajor'));
  else if (delta < -250) parts.push(t('finrisk.diagnosisModerate'));
  else if (delta > 250) parts.push(t('finrisk.diagnosisRelief'));
  else parts.push(t('finrisk.diagnosisMinor'));

  const cap = pickCapacity(input.stressCapacity);
  if (cap) {
    const confidencePercent = (cap.confidenceLevel * 100).toFixed(0);
    const amount = Math.round(cap.maxAffordableShock);
    parts.push(
      t('finrisk.diagnosisStressCapacity')
        .replace(/{confidenceLevel}/g, confidencePercent)
        .replace(/{amount}/g, String(amount)),
    );
  }

  parts.push(t('finrisk.diagnosisDisclaimer'));

  return {
    summary: parts.join(' '),
    baselineEndP50: input.baselineEndP50,
    scenarioEndP50: input.scenarioEndP50,
    deltaEndP50: delta,
  };
}

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskSummaryCard from '../RiskSummaryCard';
import type { LumpyRiskProfile } from '@/lib/finrisk/lumpy-risk';
import type { StressCapacityLevel } from '@/lib/finrisk/scenario-payload-types';

function lumpy(level: LumpyRiskProfile['lumpyRiskLevel'], count = 5): LumpyRiskProfile {
  return {
    lumpyCount: count,
    lumpyRateAnnual: 4.2,
    lumpySeverityP50: 800,
    lumpySeverityP75: 1200,
    lumpySeverityP90: 1800,
    thresholdAmount: 300,
    topCategories: [],
    lumpyRiskLevel: level,
  };
}

function cap(value: number): StressCapacityLevel {
  return {
    confidenceLevel: 0.9,
    thresholdAmount: 1000,
    maxAffordableShock: value,
    criticalDay: 12,
    interpretation: '…',
  };
}

describe('RiskSummaryCard', () => {
  it('zeigt eine tragfähige Alltagslage und die Stress-Tragfähigkeit bei 90 %', () => {
    const { container } = render(
      <RiskSummaryCard lumpy={lumpy('low')} stress90={cap(2000)} baseBreachProbability={0} />,
    );
    expect(screen.getByText('tragfähig')).toBeInTheDocument();
    expect(screen.getByText(/bei 90 %/)).toBeInTheDocument();
    // Alltag grün.
    expect(container.querySelector('.bg-emerald-500')).toBeTruthy();
  });

  it('markiert hohes Lumpy-Risiko kritisch (rote Ampel)', () => {
    const { container } = render(
      <RiskSummaryCard lumpy={lumpy('high')} stress90={cap(2000)} baseBreachProbability={0} />,
    );
    expect(container.querySelector('.bg-destructive')).toBeTruthy();
  });

  it('zeigt einen Pufferbruch-Anteil, wenn die Basisprüfung bricht', () => {
    render(<RiskSummaryCard lumpy={lumpy('low')} stress90={cap(0)} baseBreachProbability={0.4} />);
    expect(screen.getByText(/40 % Pufferbruch/)).toBeInTheDocument();
  });
});

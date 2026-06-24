/// <reference lib="webworker" />

import { runScenarioPayload } from '@/lib/finrisk/scenario-engine';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type { MonteCarloConfig } from '@/lib/forecast-montecarlo-types';
import type { LumpyRiskProfile } from '@/lib/finrisk/lumpy-risk';
import type { ScenarioPayload } from '@/lib/finrisk/scenario-payload-types';

type Request = {
  input: ForecastInput;
  config: ForecastConfig;
  payload: ScenarioPayload;
  monteCarlo?: MonteCarloConfig;
  lumpy?: LumpyRiskProfile;
};

// Schwer (zwei Monte-Carlo-Läufe mit Pfaden) – daher im Worker, weg vom Main-Thread.
self.onmessage = (event: MessageEvent<Request>) => {
  const { input, config, payload, monteCarlo, lumpy } = event.data;
  self.postMessage(runScenarioPayload(input, config, payload, { monteCarlo, lumpy }));
};

export {};

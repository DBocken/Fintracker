/// <reference lib="webworker" />

import { evaluateAffordability } from '@/lib/finrisk/affordability';
import type { AffordabilityGoal, AffordabilityOptions } from '@/lib/finrisk/affordability';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';

type Request = {
  input: ForecastInput;
  config: ForecastConfig;
  goal: AffordabilityGoal;
  options?: AffordabilityOptions;
};

// Schwer (inverse Suche = viele Monte-Carlo-Läufe) – daher im Worker, weg vom
// Main-Thread. Alles bleibt lokal; nichts verlässt das Gerät.
self.onmessage = (event: MessageEvent<Request>) => {
  const { input, config, goal, options } = event.data;
  self.postMessage(evaluateAffordability(input, config, goal, options));
};

export {};

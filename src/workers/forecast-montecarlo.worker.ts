/// <reference lib="webworker" />

import { runMonteCarloForecast } from '@/lib/forecast-montecarlo';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';
import type { MonteCarloConfig } from '@/lib/forecast-montecarlo-types';

type Request = {
  input: ForecastInput;
  config: ForecastConfig;
  monteCarlo: MonteCarloConfig;
};

self.onmessage = (event: MessageEvent<Request>) => {
  const { input, config, monteCarlo } = event.data;
  self.postMessage(runMonteCarloForecast(input, config, monteCarlo));
};

export {};

import type { Portfolio } from '../types';
import { t } from '../i18n/serviceT';
import { callEtoroProxy, getEtoroCredentials } from './etoro-service';
import {
  EtoroAggregatePortfolioResponseSchema,
  type EtoroAggregatePortfolioResponse,
} from './etoro-api-schemas';

// -----------------------------------------------------------------------------
// eToro-Account-Service: Live-Abfragen jenseits des Positions-Syncs (Cash,
// Konto-Totals, Smart Portfolios, ...). Anders als Positionen werden diese
// Daten NICHT lokal persistiert — sie sind reine Live-Views (react-query im
// Client cached sie), da sie dem Nutzer nicht "gehören" wie erfasste Positionen.
//
// etoro-service.ts bleibt Sync-/Persistenz-fokussiert; hier liegen die
// lesenden Konto-Ansichten. Credentials-Guard und Proxy-Aufruf werden von dort
// wiederverwendet (getEtoroCredentials / callEtoroProxy).
// -----------------------------------------------------------------------------

/**
 * Fehler einer eToro-Live-Abfrage. `isAuthError` markiert 401/403 vom Upstream
 * — daran erkennt der Client (EtoroScopeGate), dass dem Key evtl. ein Scope
 * fehlt, und zeigt einen entsprechenden Hinweis statt eines generischen Fehlers.
 */
export class EtoroAccountError extends Error {
  readonly isAuthError: boolean;
  constructor(message: string, isAuthError: boolean) {
    super(message);
    this.name = 'EtoroAccountError';
    this.isAuthError = isAuthError;
  }
}

// supabase.functions.invoke bildet Upstream-401/403 auf einen FunctionsHttpError
// ab, dessen Statuscode in error.context.status steckt. Wir lesen ihn defensiv
// aus, um Auth-/Scope-Fehler von echten Transportfehlern zu unterscheiden.
function isAuthStatus(error: { message?: string; context?: unknown } | null): boolean {
  if (!error) return false;
  const status = (error.context as { status?: number } | undefined)?.status;
  return status === 401 || status === 403;
}

/**
 * Holt den aggregierten Konto-Snapshot (/trading/info/aggregate-portfolio):
 * Cash, Konto-Totals, pro-Instrument-Aggregate und Smart Portfolios (mirrors).
 * Wirft EtoroAccountError; bei 401/403 mit isAuthError=true (fehlender Scope).
 */
export async function fetchEtoroAggregatePortfolio(
  apiKey: string,
  userKey: string,
): Promise<EtoroAggregatePortfolioResponse> {
  const { data, error } = await callEtoroProxy(apiKey, userKey, { endpoint: 'aggregate-portfolio' });

  if (error) {
    throw new EtoroAccountError(
      t('etoroService.proxyError').replace('{error}', error.message || String(error)),
      isAuthStatus(error),
    );
  }
  const bodyError = data && typeof data === 'object' ? (data as Record<string, unknown>).error : undefined;
  if (bodyError) {
    const upstream = (data as Record<string, unknown>).upstream_status;
    throw new EtoroAccountError(
      t('etoroService.proxyError').replace('{error}', String(bodyError)),
      upstream === 401 || upstream === 403,
    );
  }

  const parsed = EtoroAggregatePortfolioResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[etoro-account-service] Unerwartetes Antwort-Schema (aggregate-portfolio).', {
      issues: parsed.error.issues,
      received: data,
    });
    throw new EtoroAccountError(t('etoroService.unexpectedResponse'), false);
  }

  return parsed.data;
}

/**
 * Convenience-Wrapper: liest die Credentials des Portfolios (mit
 * Verschlüsselungs-Guard) und holt den Konto-Snapshot. Für den direkten
 * Aufruf aus react-query-Fetchern im Client.
 */
export async function fetchEtoroAggregateForPortfolio(
  portfolio: Portfolio | null,
): Promise<EtoroAggregatePortfolioResponse> {
  const { apiKey, userKey } = getEtoroCredentials(portfolio);
  return fetchEtoroAggregatePortfolio(apiKey, userKey);
}

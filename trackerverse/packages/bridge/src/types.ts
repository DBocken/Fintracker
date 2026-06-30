// Wire-Protokoll und Kerntypen des Trackerverse Capability-Brokers.
// Bewusst framework-unabhängig: kein DOM, keine App-Logik — nur der Vertrag.

export const BRIDGE_PROTOCOL_VERSION = 1;

/** Stabile App-Kennung, z. B. "fintrack", "shoptrack". */
export type AppId = string;

/**
 * Scope = "<providerApp>:<resource>:<action>", z. B. "shoptrack:receipts:read".
 * Es gibt bewusst KEINE Wildcards (Least Privilege / Default-deny).
 */
export type Scope = string;

/** In v1 nur lesender Zugriff — Schreibzugriff folgt später, bewusst eng. */
export type ScopeAction = 'read';

export interface ParsedScope {
  providerApp: AppId;
  resource: string;
  action: ScopeAction;
}

/** Bindung einer App-Identität an genau einen Origin (Confused-Deputy-Abwehr). */
export interface AppRegistration {
  appId: AppId;
  origin: string;
}

export interface BridgeRequestMessage {
  __trackerverse: true;
  protocol: number;
  kind: 'request';
  /** Korrelations-ID, vom Consumer vergeben. */
  id: string;
  /** Wer fragt (Consumer-App). */
  appId: AppId;
  /** Was er will. */
  scope: Scope;
  /** Optionale Parameter für den Provider. */
  params?: unknown;
}

export type BridgeErrorCode =
  | 'malformed'
  | 'protocol_mismatch'
  | 'origin_mismatch'
  | 'invalid_scope'
  | 'no_provider'
  | 'consent_denied'
  | 'provider_error'
  | 'timeout';

export interface BridgeError {
  code: BridgeErrorCode;
  message: string;
}

export interface BridgeResponseMessage {
  __trackerverse: true;
  protocol: number;
  kind: 'response';
  id: string;
  ok: boolean;
  data?: unknown;
  error?: BridgeError;
}

export function isRequestLike(data: unknown): data is BridgeRequestMessage {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { __trackerverse?: unknown }).__trackerverse === true &&
    (data as { kind?: unknown }).kind === 'request'
  );
}

export function isResponseLike(data: unknown): data is BridgeResponseMessage {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as { __trackerverse?: unknown }).__trackerverse === true &&
    (data as { kind?: unknown }).kind === 'response' &&
    typeof (data as { id?: unknown }).id === 'string'
  );
}

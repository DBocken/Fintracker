import { CapabilityStore } from './capabilities';
import { AppRegistry } from './registry';
import { parseScope, scopeKey } from './scope';
import {
  BRIDGE_PROTOCOL_VERSION,
  type AppId,
  type BridgeErrorCode,
  type BridgeResponseMessage,
  type ParsedScope,
  type Scope,
} from './types';

export interface ProviderContext {
  consumerApp: AppId;
  resource: string;
  params: unknown;
}

export type ProviderHandler = (ctx: ProviderContext) => unknown | Promise<unknown>;

export interface ConsentRequest {
  consumerApp: AppId;
  scope: ParsedScope;
}

/** Consent-Callback darf ein Boolean oder { granted } liefern, sync oder async. */
export type ConsentCallback = (
  request: ConsentRequest,
) => boolean | { granted: boolean } | Promise<boolean | { granted: boolean }>;

export interface AuditEvent {
  at: string;
  appId: AppId;
  origin: string;
  scope?: Scope;
  decision: 'allow' | 'deny';
  reason: string;
}

export interface BrokerOptions {
  registry: AppRegistry;
  capabilities: CapabilityStore;
  requestConsent: ConsentCallback;
  onAudit?: (event: AuditEvent) => void;
  now?: () => string;
}

function providerKey(providerApp: AppId, resource: string): string {
  return `${providerApp}:${resource}`;
}

async function resolveConsent(cb: ConsentCallback, req: ConsentRequest): Promise<boolean> {
  const result = await cb(req);
  return typeof result === 'boolean' ? result : !!result?.granted;
}

/**
 * Vermittelt Cross-App-Datenzugriffe nach dem Default-deny-Prinzip. Der Broker
 * ist DOM-frei und vollständig unit-testbar; das Browser-Glue (postMessage)
 * liegt in `host.ts` und reicht den vertrauenswürdigen `event.origin` herein.
 */
export class CapabilityBroker {
  private readonly registry: AppRegistry;
  private readonly capabilities: CapabilityStore;
  private readonly requestConsent: ConsentCallback;
  private readonly onAudit?: (event: AuditEvent) => void;
  private readonly now: () => string;
  private readonly providers = new Map<string, ProviderHandler>();

  constructor(opts: BrokerOptions) {
    this.registry = opts.registry;
    this.capabilities = opts.capabilities;
    this.requestConsent = opts.requestConsent;
    this.onAudit = opts.onAudit;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  /** Registriert einen Daten-Provider für (App, Ressource). */
  registerProvider(providerApp: AppId, resource: string, handler: ProviderHandler): void {
    this.providers.set(providerKey(providerApp, resource), handler);
  }

  async handle(message: unknown, origin: string): Promise<BridgeResponseMessage> {
    const id =
      message && typeof message === 'object' && typeof (message as { id?: unknown }).id === 'string'
        ? (message as { id: string }).id
        : '';

    if (!message || typeof message !== 'object') {
      return this.deny(id, '<unknown>', origin, undefined, 'malformed', 'Keine gültige Nachricht');
    }
    const m = message as Record<string, unknown>;
    if (m.__trackerverse !== true || m.kind !== 'request') {
      return this.deny(id, '<unknown>', origin, undefined, 'malformed', 'Kein Bridge-Request');
    }
    if (m.protocol !== BRIDGE_PROTOCOL_VERSION) {
      return this.deny(id, String(m.appId ?? '<unknown>'), origin, undefined, 'protocol_mismatch', 'Protokollversion passt nicht');
    }
    if (typeof m.appId !== 'string' || typeof m.scope !== 'string' || typeof m.id !== 'string') {
      return this.deny(id, '<unknown>', origin, undefined, 'malformed', 'Pflichtfelder fehlen');
    }

    const appId = m.appId;

    // SECURITY: Origin-Bindung VOR allem anderen prüfen — auch vor Scope und
    // auch wenn eine Berechtigung existiert. Verhindert, dass ein fremder Origin
    // sich als eine berechtigte App ausgibt (Confused Deputy).
    if (!this.registry.verify(appId, origin)) {
      return this.deny(id, appId, origin, undefined, 'origin_mismatch', 'Origin nicht an appId gebunden');
    }

    const parsed = parseScope(m.scope);
    if (!parsed) {
      return this.deny(id, appId, origin, String(m.scope), 'invalid_scope', 'Scope ungültig');
    }
    const scope = scopeKey(parsed);

    const provider = this.providers.get(providerKey(parsed.providerApp, parsed.resource));
    if (!provider) {
      return this.deny(id, appId, origin, scope, 'no_provider', 'Kein Provider registriert');
    }

    if (!this.capabilities.isGranted(appId, scope)) {
      const granted = await resolveConsent(this.requestConsent, { consumerApp: appId, scope: parsed });
      if (!granted) {
        return this.deny(id, appId, origin, scope, 'consent_denied', 'Nutzer hat abgelehnt');
      }
      this.capabilities.grant(appId, scope, this.now());
    }

    try {
      const data = await provider({ consumerApp: appId, resource: parsed.resource, params: m.params });
      this.audit({ at: this.now(), appId, origin, scope, decision: 'allow', reason: 'granted' });
      return { __trackerverse: true, protocol: BRIDGE_PROTOCOL_VERSION, kind: 'response', id, ok: true, data };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Provider-Fehler';
      return this.deny(id, appId, origin, scope, 'provider_error', reason);
    }
  }

  private deny(
    id: string,
    appId: AppId,
    origin: string,
    scope: Scope | undefined,
    code: BridgeErrorCode,
    message: string,
  ): BridgeResponseMessage {
    this.audit({ at: this.now(), appId, origin, scope, decision: 'deny', reason: code });
    return {
      __trackerverse: true,
      protocol: BRIDGE_PROTOCOL_VERSION,
      kind: 'response',
      id,
      ok: false,
      error: { code, message },
    };
  }

  private audit(event: AuditEvent): void {
    this.onAudit?.(event);
  }
}

import {
  BRIDGE_PROTOCOL_VERSION,
  isResponseLike,
  type AppId,
  type BridgeError,
  type BridgeRequestMessage,
  type Scope,
} from './types';

export class BridgeRequestError extends Error {
  readonly code: BridgeError['code'];
  constructor(error: BridgeError) {
    super(error.message);
    this.name = 'BridgeRequestError';
    this.code = error.code;
  }
}

/** Abstrahiert den Transport, damit der Client ohne DOM testbar ist. */
export interface ClientTransport {
  send(message: BridgeRequestMessage, targetOrigin: string): void;
  subscribe(handler: (data: unknown, origin: string) => void): () => void;
}

export interface BridgeClient {
  request<T = unknown>(scope: Scope, params?: unknown): Promise<T>;
  close(): void;
}

export interface BridgeClientOptions {
  appId: AppId;
  vaultOrigin: string;
  transport: ClientTransport;
  genId?: () => string;
  timeoutMs?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createBridgeClient(opts: BridgeClientOptions): BridgeClient {
  const genId = opts.genId ?? (() => Math.random().toString(36).slice(2) + Date.now().toString(36));
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const pending = new Map<string, Pending>();

  const unsubscribe = opts.transport.subscribe((data, origin) => {
    // SECURITY: nur Antworten vom Vault-Origin akzeptieren.
    if (origin !== opts.vaultOrigin) return;
    if (!isResponseLike(data)) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.ok) entry.resolve(data.data);
    else entry.reject(new BridgeRequestError(data.error ?? { code: 'malformed', message: 'Antwort ohne Fehlerobjekt' }));
  });

  return {
    request<T>(scope: Scope, params?: unknown): Promise<T> {
      const id = genId();
      const message: BridgeRequestMessage = {
        __trackerverse: true,
        protocol: BRIDGE_PROTOCOL_VERSION,
        kind: 'request',
        id,
        appId: opts.appId,
        scope,
        params,
      };
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new BridgeRequestError({ code: 'timeout', message: 'Bridge-Anfrage Zeitüberschreitung' }));
        }, timeoutMs);
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
        opts.transport.send(message, opts.vaultOrigin);
      });
    },
    close(): void {
      unsubscribe();
      for (const entry of pending.values()) clearTimeout(entry.timer);
      pending.clear();
    },
  };
}

/** Browser-Glue: Transport über das iframe des Vault-Origins. */
export function createWindowClientTransport(vaultWindow: Window, selfWindow: Window = window): ClientTransport {
  return {
    send(message, targetOrigin) {
      vaultWindow.postMessage(message, targetOrigin);
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => handler(event.data, event.origin);
      selfWindow.addEventListener('message', listener);
      return () => selfWindow.removeEventListener('message', listener);
    },
  };
}

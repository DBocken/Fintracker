import type { CapabilityBroker } from './broker';
import { isRequestLike } from './types';

/** Minimal-Form eines MessageEvents, damit der Host ohne DOM testbar ist. */
export interface BrokerMessageEventLike {
  data: unknown;
  origin: string;
  source: { postMessage: (message: unknown, targetOrigin: string) => void } | null;
}

/**
 * Verarbeitet eine eingehende Nachricht im Vault-Host. Fremde Nachrichten (ohne
 * unseren Envelope) werden ignoriert — wir antworten nicht auf alles, was am
 * Fenster ankommt.
 *
 * SECURITY: Die Antwort wird IMMER an `event.origin` zurückgepostet, niemals an
 * "*". So kann kein lauschender Drittanbieter-Frame die Antwort abgreifen.
 */
export async function handleBrokerMessageEvent(
  broker: CapabilityBroker,
  event: BrokerMessageEventLike,
): Promise<void> {
  if (!isRequestLike(event.data)) return;
  const response = await broker.handle(event.data, event.origin);
  event.source?.postMessage(response, event.origin);
}

/**
 * Browser-Glue: hängt den Broker an das `message`-Event eines Fensters (im
 * Vault-Origin). Gibt eine Aufräumfunktion zurück.
 */
export function attachBrokerHost(broker: CapabilityBroker, win: Window = window): () => void {
  const listener = (event: MessageEvent) => {
    void handleBrokerMessageEvent(broker, {
      data: event.data,
      origin: event.origin,
      source: event.source as BrokerMessageEventLike['source'],
    });
  };
  win.addEventListener('message', listener);
  return () => win.removeEventListener('message', listener);
}

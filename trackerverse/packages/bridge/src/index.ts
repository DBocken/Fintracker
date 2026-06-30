export * from './types';
export { parseScope, scopeKey } from './scope';
export { AppRegistry } from './registry';
export { CapabilityStore, type GrantRecord } from './capabilities';
export {
  CapabilityBroker,
  type BrokerOptions,
  type ProviderHandler,
  type ProviderContext,
  type ConsentCallback,
  type ConsentRequest,
  type AuditEvent,
} from './broker';
export {
  handleBrokerMessageEvent,
  attachBrokerHost,
  type BrokerMessageEventLike,
} from './host';
export {
  createBridgeClient,
  createWindowClientTransport,
  BridgeRequestError,
  type BridgeClient,
  type BridgeClientOptions,
  type ClientTransport,
} from './client';

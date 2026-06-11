import { webcrypto } from "node:crypto";

// jsdom bringt eine eigene crypto-Implementierung mit, deren TypedArrays in einem
// anderen Realm liegen als Nodes WebCrypto (crypto.subtle). Das führt im
// jsdom-Environment zu "salt of Pbkdf2Params is not instance of ArrayBuffer".
// Wir vereinheitlichen beides auf Nodes WebCrypto. Im node-Environment ist das
// ein No-Op (dort ist globalThis.crypto bereits Nodes WebCrypto).
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
  writable: true,
});

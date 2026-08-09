/**
 * Branded IDs (WP 5.2, DOM-3): `TransactionId`/`AccountId`/`CategoryId` sind
 * für den Compiler ohne Brand identisch (`string`) — eine Fremdschlüssel-
 * Verwechslung (z. B. eine `AccountId` an einer `TransactionId`-Stelle)
 * kompiliert widerspruchslos. Der Brand existiert NUR zur Compile-Zeit
 * (dasselbe Muster wie `Cents`/`EuroAmount` in `@/lib/money`, WP 5.1): zur
 * Laufzeit ist ein gebrandeter ID-Wert ein ganz normaler `string`,
 * `JSON.stringify`, IndexedDB-Keys und Objektgleichheit sehen ihn unverändert.
 *
 * Angewendet wird der Brand NICHT auf die bestehenden `id`/`*_id`-Felder in
 * `Transaction`/`Account`/`Category` u. a. — siehe Bericht zu WP 5.2: Die
 * Messung ergab, dass das Branden von `Transaction['id']` allein bereits
 * hunderte Fundstellen bricht (rohe String-Literale in Test-Fixtures,
 * `crypto.randomUUID()`-Zuweisungen, Objekt-Keys). Diese Datei stellt die
 * Brand-Typen und ihre Konstruktoren bereit, ohne sie an bestehende Felder zu
 * zwingen — Umstellung einzelner, klar abgegrenzter Signaturen ist ein
 * eigener Folgeschritt (siehe Bericht).
 */

export type TransactionId = string & { readonly __brand: "TransactionId" };
export type AccountId = string & { readonly __brand: "AccountId" };
export type CategoryId = string & { readonly __brand: "CategoryId" };

export function asTransactionId(id: string): TransactionId {
  return id as TransactionId;
}

export function asAccountId(id: string): AccountId {
  return id as AccountId;
}

export function asCategoryId(id: string): CategoryId {
  return id as CategoryId;
}

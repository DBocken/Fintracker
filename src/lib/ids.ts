/**
 * Branded IDs (WP 5.2, DOM-3): `TransactionId`/`AccountId`/`CategoryId` sind
 * für den Compiler ohne Brand identisch (`string`) — eine Fremdschlüssel-
 * Verwechslung (z. B. eine `AccountId` an einer `TransactionId`-Stelle)
 * kompiliert widerspruchslos. Der Brand existiert NUR zur Compile-Zeit
 * (dasselbe Muster wie `Cents`/`EuroAmount` in `@/lib/money`, WP 5.1): zur
 * Laufzeit ist ein gebrandeter ID-Wert ein ganz normaler `string`,
 * `JSON.stringify`, IndexedDB-Keys und Objektgleichheit sehen ihn unverändert.
 *
 * Angewendet ist der Brand seit WP 5.2b auf `Transaction['id']`. In WP 5.2
 * lagen die Typen hier noch UNBENUTZT bereit — das ist die Fehlerklasse aus
 * `docs/qualitaet-2026-08/nachpruefung.md` 3.b („der Mechanismus war da, nur
 * fragte ihn niemand"), und genau deshalb stand das Anwenden als eigenes
 * Paket im Plan statt als Absichtserklärung in diesem Kommentar.
 *
 * `Account['id']` und `Category['id']` sind NICHT gebrandet: gemessen in
 * WP 5.2 brachen sie zusammen 812 Stellen in 129 Dateien, gegenüber 447 für
 * `Transaction['id']` allein. Wer sie nachzieht, misst zuerst neu.
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

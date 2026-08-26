import { t } from '@/i18n/serviceT';

/**
 * Form einer Buchung, wie die Bank sie über GoCardless (PSD2) liefert.
 *
 * Der Typ liegt hier und nicht im Sync-Service: Er beschreibt eine
 * **Datengrenze**, keinen I/O-Vorgang (AGENTS.md §3, „Wohin ein Typ gehört").
 * Solange er im Service lag, konnte niemand von unten auf ihn zugreifen — und
 * genau deshalb ist die Feldauswertung dort als Einzeiler entstanden, statt
 * als prüfbare Funktion hier.
 *
 * Aufgeführt sind auch Felder, die die App noch nicht auswertet
 * (`merchantCategoryCode`, `endToEndId`, …). Das ist Absicht: Was nicht im Typ
 * steht, fällt beim Import lautlos weg, und niemand sieht je, dass es da war.
 */
export interface BankTransactionSource {
  transactionId?: string;
  entryReference?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  debtorName?: string;
  creditorName?: string;
  ultimateDebtor?: string;
  ultimateCreditor?: string;
  debtorAccount?: { iban?: string };
  creditorAccount?: { iban?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  remittanceInformationStructuredArray?: string[];
  additionalInformation?: string;
  purposeCode?: string;
  bankTransactionCode?: string;
  proprietaryBankTransactionCode?: string;
  /** ISO-18245-Branchenschlüssel des Händlers — bei Kartenzahlungen der beste Hinweis darauf, WORUM es ging. */
  merchantCategoryCode?: string;
  creditorId?: string;
  mandateId?: string;
  endToEndId?: string;
  currencyExchange?: unknown;
  balanceAfterTransaction?: {
    balanceAmount: { amount: string; currency: string };
    balanceType: string;
    creditLimitIncluded?: boolean;
  };
}

/** Die Bankfelder, die nicht bereits eine eigene Spalte der Buchung sind. */
export interface BankFields {
  transactionId?: string;
  entryReference?: string;
  valueDate?: string;
  debtorName?: string;
  creditorName?: string;
  ultimateDebtor?: string;
  ultimateCreditor?: string;
  debtorIban?: string;
  creditorIban?: string;
  remittanceInformationStructured?: string;
  additionalInformation?: string;
  purposeCode?: string;
  bankTransactionCode?: string;
  proprietaryBankTransactionCode?: string;
  merchantCategoryCode?: string;
  creditorId?: string;
  mandateId?: string;
  endToEndId?: string;
}

/**
 * Wer ist das Gegenüber — und zwar **abhängig vom Vorzeichen**.
 *
 * Bei einer Ausgabe (negativer Betrag) ist das Gegenüber der *Creditor*, bei
 * einer Einnahme der *Debtor*. Die Auswertung lautete bis hierher unbesehen
 * `debtorName || creditorName` und `debtorAccount || creditorAccount`, also
 * für JEDE Richtung dieselbe Reihenfolge. Viele Banken tragen bei einer
 * Ausgabe im Debtor den Kontoinhaber selbst oder die abwickelnde Stelle ein —
 * dann steht als „Empfänger" die eigene Bank statt des Händlers.
 *
 * Die IBAN wiegt dabei schwerer als der Name: Sie speist die Erkennung
 * interner Überträge (`reconcileInternalTransfers`). Eine Gegenkonto-IBAN aus
 * der falschen Richtung verknüpft Buchungen, die nichts miteinander zu tun
 * haben — oder übersieht die, die zusammengehören.
 */
export function pickCounterparty(
  source: BankTransactionSource,
  amount: number,
): { name: string | null; iban: string | null } {
  const outgoing = amount < 0;

  const name = outgoing
    ? source.creditorName || source.ultimateCreditor || source.debtorName
    : source.debtorName || source.ultimateDebtor || source.creditorName;

  const iban = outgoing
    ? source.creditorAccount?.iban || source.debtorAccount?.iban
    : source.debtorAccount?.iban || source.creditorAccount?.iban;

  return { name: name || null, iban: iban || null };
}

/**
 * Klartext für einen ISO-18245-Branchenschlüssel (MCC).
 *
 * Bei einer Kartenzahlung ist das die Antwort auf „worum ging es?", noch bevor
 * irgendein Text ausgewertet wird: 7523 heißt Parkhaus, egal wie der
 * Verwendungszweck lautet und in welcher Sprache. Die Liste ist bewusst
 * kurz — sie deckt die im Alltag häufigen Fälle ab und ist der Ort, an dem
 * weitere ergänzt werden. `undefined` heißt „kenne ich nicht", nicht „gibt es
 * nicht": Der Rohwert bleibt in `bank_fields` erhalten.
 */
const MERCHANT_CATEGORY_KEYS: Record<string, string> = {
  '5411': 'supermarket',
  '5412': 'supermarket',
  '5499': 'supermarket',
  '5541': 'fuel',
  '5542': 'fuel',
  '5812': 'restaurant',
  '5814': 'fastFood',
  '5912': 'pharmacy',
  '5921': 'beverages',
  '5651': 'clothing',
  '5691': 'clothing',
  '4111': 'publicTransport',
  '4121': 'taxi',
  '4131': 'publicTransport',
  '4784': 'toll',
  '7523': 'parking',
  '7538': 'carRepair',
  '8011': 'doctor',
  '8021': 'dentist',
  '8062': 'hospital',
};

export function describeMerchantCategory(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const key = MERCHANT_CATEGORY_KEYS[code.trim()];
  if (!key) return undefined;
  return t(`bankFields.merchantCategory.${key}`);
}

/**
 * Klartext für einen ISO-20022-Buchungsschlüssel (`Domain-Family-SubFamily`).
 *
 * Das ist das Gegenstück zum „KARTENZAHLUNG"/„LASTSCHRIFT" der Bankauszüge —
 * eine maschinenlesbare Art der Buchung, die die App bis hierher deklariert
 * und weggeworfen hat. Verglichen wird auf Großschreibung normalisiert;
 * unbekannte Schlüssel liefern `undefined`.
 */
const TRANSACTION_CODE_KEYS: Record<string, string> = {
  'PMNT-CCRD-POSD': 'cardPayment',
  'PMNT-CCRD-POSP': 'cardPayment',
  'PMNT-CCRD-CWDL': 'cashWithdrawal',
  'PMNT-CCRD-CDPT': 'cashDeposit',
  'PMNT-ICDT-ESCT': 'transferOut',
  'PMNT-ICDT-STDO': 'standingOrder',
  'PMNT-RCDT-ESCT': 'transferIn',
  'PMNT-IDDT-ESDD': 'directDebit',
  'PMNT-RDDT-ESDD': 'directDebitIn',
  'PMNT-MCRD-POSD': 'cardPayment',
};

export function describeTransactionCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const key = TRANSACTION_CODE_KEYS[code.trim().toUpperCase()];
  if (!key) return undefined;
  return t(`bankFields.transactionCode.${key}`);
}

/**
 * Sammelt alles ein, was die Bank mitgeliefert hat und was nicht bereits eine
 * eigene Spalte der Buchung ist.
 *
 * Leere Felder werden weggelassen — ein Bündel voller `undefined` bläht jede
 * Buchung auf, und Buchungen sind die mit Abstand größte Collection.
 */
export function collectBankFields(source: BankTransactionSource): BankFields | null {
  const fields: BankFields = {};
  const put = (key: keyof BankFields, value: string | undefined) => {
    const trimmed = (value || '').trim();
    if (trimmed) fields[key] = trimmed;
  };

  put('transactionId', source.transactionId);
  put('entryReference', source.entryReference);
  put('valueDate', source.valueDate);
  put('debtorName', source.debtorName);
  put('creditorName', source.creditorName);
  put('ultimateDebtor', source.ultimateDebtor);
  put('ultimateCreditor', source.ultimateCreditor);
  put('debtorIban', source.debtorAccount?.iban);
  put('creditorIban', source.creditorAccount?.iban);
  put('remittanceInformationStructured', source.remittanceInformationStructured);
  put('additionalInformation', source.additionalInformation);
  put('purposeCode', source.purposeCode);
  put('bankTransactionCode', source.bankTransactionCode);
  put('proprietaryBankTransactionCode', source.proprietaryBankTransactionCode);
  put('merchantCategoryCode', source.merchantCategoryCode);
  put('creditorId', source.creditorId);
  put('mandateId', source.mandateId);
  put('endToEndId', source.endToEndId);

  return Object.keys(fields).length > 0 ? fields : null;
}

/**
 * Die Art der Buchung in Klartext — Branchenschlüssel zuerst, sonst der
 * Buchungsschlüssel. Beides `undefined` heißt: Die Bank hat nichts geliefert,
 * woraus sich etwas ableiten ließe, und es wird nichts erfunden.
 */
export function describeBankTransaction(source: BankTransactionSource): string | undefined {
  return (
    describeMerchantCategory(source.merchantCategoryCode) ??
    describeTransactionCode(source.proprietaryBankTransactionCode) ??
    describeTransactionCode(source.bankTransactionCode)
  );
}

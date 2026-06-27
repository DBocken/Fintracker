import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCAL_ONLY_SERVICES = [
  'contract-decision-service.ts',
  'transaction-allocation-service.ts',
  'transaction-service.ts',
  'category-service.ts',
  'merchant-rules-service.ts',
  'user-settings-service.ts',
  'category-priority-service.ts',
  'milestones-service.ts',
  'analytics-consent-service.ts',
  'analytics-aggregation-service.ts',
  'snapshot-sync-service.ts',
  'backup-service.ts',
] as const;

describe('[PRIVACY] lokale Finanzdaten-Grenze', () => {
  it.each(LOCAL_ONLY_SERVICES)('%s besitzt keinen Supabase-Datenpfad', (fileName) => {
    const source = readFileSync(new URL(fileName, import.meta.url), 'utf8');

    expect(source).not.toMatch(/integrations\/supabase|\bsupabase\b/i);
    expect(source).not.toMatch(/user_contract_decisions|user_transaction_allocations/);
  });
});

// ⚠️ BEWUSSTE AUSNAHME (Proof of Concept, siehe docs/mcp-poc.md):
// `cloud-mcp-sync-service.ts` ist der EINZIGE Service, der – nur nach doppelter
// Nutzer-Bestätigung – Aggregate in die Cloud laden darf. Er ist absichtlich
// NICHT in LOCAL_ONLY_SERVICES. Die folgenden Guards stellen sicher, dass die
// Ausnahme eng bleibt: aggregat-only (keine Roh-PII) und nur mit Consent-Gate.
const CLOUD_EXCEPTION = 'cloud-mcp-sync-service.ts';

describe('[PRIVACY] Cloud-Ausnahme (MCP POC) bleibt aggregat-only', () => {
  const source = readFileSync(new URL(CLOUD_EXCEPTION, import.meta.url), 'utf8');

  it('[REGRESSION] ist nicht als local-only deklariert (bewusste Ausnahme)', () => {
    expect([...LOCAL_ONLY_SERVICES]).not.toContain(CLOUD_EXCEPTION);
  });

  it('lädt keine rohen Transaktionsfelder hoch (payee/IBAN/original_text/description)', () => {
    expect(source).not.toMatch(/\.payee\b/);
    expect(source).not.toMatch(/\.original_text\b/);
    expect(source).not.toMatch(/\.counterparty_iban\b/);
    expect(source).not.toMatch(/\.description\b/);
  });

  it('erzwingt die doppelte Bestätigung (Consent-Gate) vor jedem Upload', () => {
    expect(source).toMatch(/assertSyncConsent\(consent\)/);
  });
});

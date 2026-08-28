import { describe, it, expect } from 'vitest';
import { indexContractDecisions, heutigerFingerprint } from '@/lib/contract-decision-index';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import type { ContractDecision } from '@/lib/contract-types';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

function entscheidung(fingerprint: string, over: Partial<ContractDecision> = {}): ContractDecision {
  return { id: `d-${fingerprint}`, user_id: 'local', fingerprint, status: 'rejected', ...over };
}

function tx(payee: string, amount = -30): Transaction {
  return {
    id: asTransactionId('t1'),
    date: '2026-07-05',
    amount,
    payee,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
  };
}

describe('heutigerFingerprint', () => {
  it('sollte einen alten Händler-Fingerprint auf die heutige Form ziehen', () => {
    expect(heutigerFingerprint('merchant:netflix.com|out')).toBe('merchant:netflix|out');
  });

  it('sollte einen IBAN-Fingerprint unangetastet lassen', () => {
    // Er enthält keinen normalisierten Namen — es gibt nichts nachzuziehen.
    expect(heutigerFingerprint('iban:DE89370400440532013000|out')).toBe(
      'iban:DE89370400440532013000|out',
    );
  });

  it('sollte einen heutigen Fingerprint unverändert lassen', () => {
    expect(heutigerFingerprint('merchant:rewe sagt danke|out')).toBe('merchant:rewe sagt danke|out');
  });
});

describe('indexContractDecisions', () => {
  it('[REGRESSION] sollte eine vor der Normalisierungs-Verschärfung abgelehnte Familie abgelehnt lassen', () => {
    // Der stille Ausfall: Die Entscheidung steht weiter im Speicher, wird aber
    // unter dem heutigen Fingerprint nicht mehr gefunden — und der Vertrag,
    // den der Nutzer ausdrücklich abgelehnt hat, käme zurück.
    const gespeichert = entscheidung('merchant:netflix.com|out');
    const index = indexContractDecisions([gespeichert]);

    const heute = merchantFingerprint(tx('NETFLIX.COM'));
    expect(index.get(heute)?.status).toBe('rejected');
  });

  it('sollte den gespeicherten Fingerprint weiterhin auffindbar halten', () => {
    const index = indexContractDecisions([entscheidung('merchant:netflix.com|out')]);
    expect(index.get('merchant:netflix.com|out')?.status).toBe('rejected');
  });

  it('sollte einen exakt gespeicherten Treffer nicht von einem Alias verdrängen lassen', () => {
    const exakt = entscheidung('merchant:netflix|out', { id: 'exakt', status: 'active' });
    const alias = entscheidung('merchant:netflix.com|out', { id: 'alias', status: 'rejected' });

    const index = indexContractDecisions([alias, exakt]);

    expect(index.get('merchant:netflix|out')?.id).toBe('exakt');
  });

  it('sollte bei zwei Altfamilien, die heute zusammenfallen, die jüngere Entscheidung nehmen', () => {
    const alt = entscheidung('merchant:spotify.com|out', { id: 'alt', updated_at: '2026-01-01' });
    const neu = entscheidung('merchant:spotify.de|out', {
      id: 'neu',
      status: 'active',
      updated_at: '2026-06-01',
    });

    const index = indexContractDecisions([alt, neu]);

    expect(index.get('merchant:spotify|out')?.id).toBe('neu');
  });

  it('sollte Einnahme und Ausgabe getrennt halten', () => {
    const index = indexContractDecisions([entscheidung('merchant:netflix.com|out')]);
    expect(index.get('merchant:netflix|in')).toBeUndefined();
  });
});

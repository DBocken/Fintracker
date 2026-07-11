import { describe, it, expect, beforeEach } from 'vitest';
import { createAccount, updateAccount, getAccountById } from '../account-service';
import { writeLocalFinanceList } from '../local-finance-store';
import { buildDefaultLocalSettings } from '../local-settings-service';
import { saveTransactions, updateTransaction, getTransactions } from '../transaction-service';
import { transactionStorage } from '../transaction-storage-service';
import type { Transaction } from '../../types';

beforeEach(async () => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await writeLocalFinanceList('accounts', []);
  await transactionStorage.clearLocalCache();
});

describe('Geschäftskonto-Flag (Account.is_business)', () => {
  describe('Normal Behavior', () => {
    it('sollte neue Konten standardmäßig als privat anlegen (is_business=false)', async () => {
      const account = await createAccount({ name: 'Girokonto' });
      expect(account.is_business).toBe(false);
      expect((await getAccountById(account.id))?.is_business).toBe(false);
    });

    it('sollte is_business=true bei Anlage persistieren', async () => {
      const account = await createAccount({ name: 'Geschäftskonto', is_business: true });
      expect((await getAccountById(account.id))?.is_business).toBe(true);
    });

    it('sollte das Flag per updateAccount umschalten (Persistenz-Roundtrip)', async () => {
      const account = await createAccount({ name: 'Konto' });

      await updateAccount({ id: account.id, is_business: true });
      expect((await getAccountById(account.id))?.is_business).toBe(true);

      await updateAccount({ id: account.id, is_business: false });
      expect((await getAccountById(account.id))?.is_business).toBe(false);
    });
  });
});

describe('business_mode Setting (Opt-in)', () => {
  it('sollte standardmäßig deaktiviert sein („Ruhe vor Fülle": EÜR-Modus ist Opt-in)', () => {
    expect(buildDefaultLocalSettings().business_mode).toBe(false);
  });
});

describe('Transaction.euer_private an den Persistenz-Grenzen', () => {
  function tx(overrides: Partial<Transaction>): Transaction {
    return {
      id: overrides.id || crypto.randomUUID(),
      date: '2026-03-01',
      amount: -50,
      payee: 'Baumarkt',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: false,
      ...overrides,
    };
  }

  it('[REGRESSION] sollte euer_private einen Save-Roundtrip überleben (strikte Grenze baut Objekte neu)', async () => {
    await saveTransactions([tx({ id: 'tx-priv', euer_private: true })]);
    const all = await getTransactions(10);
    expect(all.find((x) => x.id === 'tx-priv')?.euer_private).toBe(true);
  });

  it('sollte euer_private per updateTransaction patchen, ohne confirmed/auto_mapped zu verändern', async () => {
    await saveTransactions([tx({ id: 'tx-toggle', auto_mapped: true })]);

    await updateTransaction([{ id: 'tx-toggle', euer_private: true }]);

    const after = (await getTransactions(10)).find((x) => x.id === 'tx-toggle');
    expect(after?.euer_private).toBe(true);
    // Wie Steuer-Markierungen: keine Kategorie-Korrektur → Status unberührt.
    expect(after?.auto_mapped).toBe(true);
    expect(after?.confirmed).toBe(false);
  });

  it('sollte euer_private per null/false wieder entfernen', async () => {
    await saveTransactions([tx({ id: 'tx-clear', euer_private: true })]);

    await updateTransaction([{ id: 'tx-clear', euer_private: false }]);

    const after = (await getTransactions(10)).find((x) => x.id === 'tx-clear');
    expect(after?.euer_private).toBe(false);
  });
});

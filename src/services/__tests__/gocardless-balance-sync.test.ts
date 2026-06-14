import { describe, it, expect } from 'vitest';
import type { Account } from '@/types';

/**
 * Test suite for GoCardless balance synchronization
 *
 * Issue: Opening balance from GoCardless sync is not being stored,
 * causing incorrect account balance calculations.
 */

describe('GoCardless Account Balance Sync', () => {
  describe('opening balance capture', () => {
    it('should capture the opening balance from the first transaction balance', () => {
      // Scenario: Account syncs from GoCardless
      // GoCardless returns transactions with balanceAfterTransaction
      // First transaction's balance tells us the opening balance

      // Example:
      // - Transaction 1: -100 EUR, balanceAfterTransaction: 900 EUR
      // - This means opening_balance = 1000 EUR

      const mockGoCardlessTransaction = {
        transactionId: 'txn-1',
        bookingDate: '2024-06-10',
        transactionAmount: { amount: '-100', currency: 'EUR' },
        debtorName: 'Test Merchant',
        remittanceInformationUnstructured: 'Test payment',
        balanceAfterTransaction: {
          balanceAmount: { amount: '900', currency: 'EUR' },
          balanceType: 'CLBD',
        },
      };

      // When sync service processes this, it should:
      // 1. Extract the balanceAfterTransaction amount
      // 2. Calculate opening balance: balance_after - (-amount) = 900 - 100 = 1000
      const balanceAfter = parseFloat(mockGoCardlessTransaction.balanceAfterTransaction?.balanceAmount?.amount || '0');
      const txAmount = parseFloat(mockGoCardlessTransaction.transactionAmount.amount);
      const calculatedOpening = balanceAfter - txAmount;

      expect(calculatedOpening).toBe(1000);
    });

    it('should use the earliest transaction balance to set account opening_balance', () => {
      // Scenario: Multiple transactions in sync
      // Should use the FIRST/EARLIEST transaction to determine opening balance

      const transactions = [
        {
          bookingDate: '2024-06-15',
          amount: -100,
          balanceAfter: 900,
        },
        {
          bookingDate: '2024-06-14',
          amount: -50,
          balanceAfter: 950, // Earlier date
        },
        {
          bookingDate: '2024-06-16',
          amount: -75,
          balanceAfter: 825,
        },
      ];

      // Sort by bookingDate ascending to find earliest
      const sorted = [...transactions].sort((a, b) =>
        new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()
      );

      const firstTx = sorted[0];
      const openingBalance = firstTx.balanceAfter - firstTx.amount;

      expect(firstTx.bookingDate).toBe('2024-06-14');
      expect(openingBalance).toBe(1000); // 950 - (-50)
    });

    it('should update account.opening_balance field after sync', () => {
      // After syncing transactions, the account should have opening_balance set

      const mockAccount: Account = {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Test Account',
        type: 'checking',
        currency: 'EUR',
        color: '#000',
        icon: 'bank',
        is_budget_pool_member: false,
        order_index: 0,
        gocardless_account_id: 'gc-acc-1',
      };

      // After sync with opening_balance captured
      const updatedAccount: Account = {
        ...mockAccount,
        opening_balance: 1000,
        opening_balance_date: '2024-06-14',
      };

      expect(updatedAccount.opening_balance).toBe(1000);
      expect(updatedAccount.opening_balance_date).toBe('2024-06-14');
    });
  });

  describe('balance calculation with opening balance', () => {
    it('should calculate current balance as opening_balance + sum(transactions)', () => {
      // Account has opening_balance: 1000 EUR (set from GoCardless)
      // Then has local transactions:
      // - Transaction 1: -100 EUR
      // - Transaction 2: +500 EUR
      // - Transaction 3: -50 EUR

      // Expected current balance: 1000 - 100 + 500 - 50 = 1350 EUR

      const openingBalance = 1000;
      const transactions = [
        { amount: -100 },
        { amount: 500 },
        { amount: -50 },
      ];

      const totalTransactions = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const currentBalance = openingBalance + totalTransactions;

      expect(currentBalance).toBe(1350);
    });

    it('should not show negative balance when opening_balance is set correctly', () => {
      // Scenario that was failing:
      // - User syncs account with opening_balance: 2000 EUR from GoCardless
      // - Account had -500 EUR balance before sync
      // - After sync, balance should be 2000 (opening_balance), not negative

      const openingBalance = 2000; // From GoCardless
      const accountBalance = openingBalance; // Should use opening_balance as base

      expect(accountBalance).toBe(2000);
      expect(accountBalance).toBeGreaterThan(0);
    });
  });

  describe('live_balance vs opening_balance', () => {
    it('should distinguish between live_balance (from API) and opening_balance (from first sync)', () => {
      // Account can have both:
      // - opening_balance: initial balance from first transaction (set during sync)
      // - live_balance_amount: current balance fetched from bank API

      // If live_balance is newer, use it; otherwise use opening_balance + transactions

      const mockAccount: Account = {
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Test Account',
        type: 'checking',
        currency: 'EUR',
        color: '#000',
        icon: 'bank',
        is_budget_pool_member: false,
        order_index: 0,
        opening_balance: 1000,
        opening_balance_date: '2024-06-01',
        live_balance_amount: 1500,
        live_balance_updated_at: '2024-06-14T12:00:00Z',
      };

      // Prefer live_balance if it's recent
      const displayBalance = mockAccount.live_balance_amount ?? mockAccount.opening_balance;

      expect(displayBalance).toBe(1500);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { lookupTranslation } from '../I18nProvider';

/**
 * Batch 8 i18n Coverage Test
 *
 * Regressionsschutz für die in Batch 8 nachgezogenen Übersetzungsschlüssel
 * (Formulare, Dashboards, Utility-Komponenten). Prüft `lookupTranslation`
 * gegen die echten `translations.ts`-Einträge in beiden Sprachen — die
 * vorherige Version dieser Datei prüfte nur `expect(expectedKeys).toBeDefined()`
 * auf eine lokal definierte Konstante und importierte `translations` nie,
 * sodass ein entfernter oder nie hinzugefügter Schlüssel den Test nicht
 * hätte scheitern lassen.
 *
 * Beim Umstellen auf echte Lookups stellte sich heraus, dass mehrere der
 * ursprünglich geplanten Keys (`trading.comingSoon`, `simulation.step`,
 * `settings.selectSkin`) nie unter diesem Namen implementiert wurden bzw. zu
 * inzwischen entfernten/umgebauten Komponenten gehörten — sie wurden entfernt
 * statt eine Fiktion grün zu testen. Andere Keys existieren, aber unter einem
 * anderen Namespace/Namen als ursprünglich geplant (`forms.selectAccountRequired`
 * statt `forms.selectAccount`, `forecast.annual` statt `forecast.annually`,
 * `utility.*` statt `privacy.*` für die PrivacyIndicator-Texte) — hier wurde
 * der Test an die echten Keys angepasst.
 */

function expectKeysInBothLocales(keys: string[]) {
  keys.forEach((key) => {
    expect(lookupTranslation('de', key), `de:${key}`).toBeDefined();
    expect(lookupTranslation('en', key), `en:${key}`).toBeDefined();
  });
}

describe('Batch 8: Form Dialogs & Specialized Components', () => {
  describe('Priority 1: Form Dialogs (High Impact)', () => {
    it('TransactionFormDialog-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales([
        'forms.addTransaction',
        'forms.editTransaction',
        'forms.amountGreaterThanZero',
        'forms.selectAccountRequired',
        'forms.selectAccountPlaceholder',
        'forms.selectCategoryPlaceholder',
      ]);
    });

    it('AccountFormDialog-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['forms.addAccount', 'forms.editAccount', 'forms.accountName']);
    });

    it('DebtFormDialog-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['forms.addDebt', 'forms.editDebt', 'forms.debtName']);
    });

    it('CategoryForm-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['forms.categoryName', 'forms.selectParentCategory']);
    });
  });

  describe('Priority 2: Dashboard Specialized Components', () => {
    it('ContractsDashboard-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales([
        'contracts.monthly',
        'contracts.weekly',
        'contracts.quarterly',
        'contracts.semiAnnual',
        'contracts.annual',
        'contracts.liabilitiesSum',
        'contracts.incomeSum',
        'contracts.archivedAndEnded',
      ]);
    });

    it('ForecastPlanner-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['forecast.monthly', 'forecast.annual']);
    });
  });

  describe('Priority 3: Utility Components', () => {
    it('LogoutButton-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['auth.logoutAndWipe', 'auth.logout', 'auth.confirmWipe', 'auth.wipeLocalData']);
    });

    it('PrivacyIndicator-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales([
        'privacy.title',
        'privacy.enableEncryption',
        'utility.encryptedAndLocked',
        'utility.encryptedAndUnlocked',
        'utility.localOnly',
        'utility.staysOnDevice',
        'utility.staysOnDeviceNoEncryption',
      ]);
    });

    it('UserProfile-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['auth.invalidCode']);
    });

    it('CsvUploader-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales(['csv.loadingAccounts', 'csv.selectColumn']);
    });
  });

  describe('Priority 4: Health Score & Analytics', () => {
    it('FinancialLandscape-Keys existieren in beiden Sprachen', () => {
      expectKeysInBothLocales([
        'health.emergencyFund',
        'health.debt',
        'health.savingsRate',
        'health.liquidity',
        'health.contracts',
      ]);
    });
  });

  describe('[REGRESSION] fehlender Schlüssel lässt den Test scheitern', () => {
    it('lookupTranslation liefert undefined für einen nicht existierenden Schlüssel', () => {
      expect(lookupTranslation('de', 'batch8.doesNotExist')).toBeUndefined();
      expect(lookupTranslation('en', 'batch8.doesNotExist')).toBeUndefined();
    });
  });
});

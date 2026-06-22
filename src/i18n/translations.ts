/**
 * Lightweight-i18n ohne externe Dependency. Übersetzungen sind ein typsicheres,
 * verschachteltes Objekt; Lookup erfolgt über punktierte Schlüssel (z. B.
 * "privacy.title"). Bewusst klein gehalten und nur auf conversion-/vertrauens-
 * kritische Screens angewandt – keine Komplettmigration.
 *
 * Die Sprachwahl wird rein lokal (localStorage) gehalten, damit sie auch auf den
 * übersetzten Screens VOR dem Entsperren der lokalen Verschlüsselung (Login,
 * Privacy, Unlock) funktioniert.
 */

export type Locale = 'de' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['de', 'en'];
export const DEFAULT_LOCALE: Locale = 'de';

export const translations = {
  de: {
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      back: 'Zurück',
      noResults: 'Keine Ergebnisse gefunden.',
    },
    shell: {
      appName: 'Ausgabentracker',
      copilot: 'Finanz-Copilot',
      search: 'Suchen',
      navigation: 'Navigation',
      openNavigation: 'Navigation öffnen',
      more: 'Mehr',
      openMore: 'Weitere Navigationsziele öffnen',
      premium: 'Premium',
      pro: 'Pro',
    },
    nav: {
      groups: {
        coach: 'Coach',
        analysen: 'Analysen',
        daten: 'Daten & Konten',
        verwaltung: 'Verwaltung',
      },
      items: {
        coach: 'Heute für dich',
        debts: 'Schulden',
        netWorth: 'Nettovermögen',
        liquidity: 'Liquidität',
        milestones: 'Meilensteine',
        dashboard: 'Dashboard',
        transactions: 'Buchungen',
        premium: 'Analyse',
        simulation: 'Simulation',
        trading: 'Trading',
        accounts: 'Konten',
        csv: 'CSV Upload',
        export: 'Daten Export',
        contracts: 'Verträge',
        settings: 'Einstellungen',
      },
      subtitles: {
        liquidity: 'Wann wird dein Geld knapp?',
        premium: 'Sankey, Heatmap & Smart Insights',
        simulation: 'Zukunft durchspielen',
        trading: 'Depot im Blick (Beta)',
      },
      short: {
        coach: 'Heute',
        dashboard: 'Übersicht',
        transactions: 'Buchungen',
      },
    },
    premium: {
      addWidget: 'Widget hinzufügen',
    },
    settings: {
      language: 'Sprache',
      languageDescription: 'Sprache der App. Betrifft zunächst ausgewählte Bereiche.',
      languageGerman: 'Deutsch',
      languageEnglish: 'Englisch',
    },
    dashboard: {
      allTransactions: 'Alle sichtbaren Transaktionen auswählen',
      search: 'Suche...',
      selectAll: 'Alle auswählen',
      categoriesUpdated: 'Kategorien aktualisiert',
      updateError: 'Fehler beim Aktualisieren: ',
      transactionDeleted: 'Transaktion gelöscht',
      deleteError: 'Fehler beim Löschen: ',
      transactionsDeleted: 'Transaktionen gelöscht',
      sort: 'sortieren',
      ascending: 'aufsteigend',
      descending: 'absteigend',
      selectTransaction: 'Transaktion auswählen',
      contract: 'Vertrag',
      actions: 'Aktionen',
      date: 'Datum',
      description: 'Beschreibung',
      payee: 'Empfänger',
      amount: 'Betrag',
      prevYear: 'Vorheriges Jahr',
      nextYear: 'Nächstes Jahr',
      selectMonth: 'Monat wählen…',
      selectCycle: 'Zyklus wählen…',
      placeholder: '0',
      removeTransfer: 'Transfer entfernen',
      removeItem: 'Posten entfernen',
      removeReserve: 'Rücklage entfernen',
      name: 'Name (z. B. Urlaub)',
      selectAccount: 'Konto wählen',
      targetAmount: 'Zielbetrag',
      reserveAccount: 'Reservekonto',
      fromAccount: 'Von Konto',
      toAccount: 'Zu Konto',
    },
    transactions: {
      title: 'Buchungen',
      description: 'Alle Transaktionen – tippe eine Zeile an, um sie zu bearbeiten.',
      search: 'Buchungen durchsuchen…',
    },
    privacy: {
      title: 'Wie wir mit deinen Daten umgehen',
      intro:
        'Kurz gesagt: Deine Finanzdaten bleiben auf deinem Gerät. Wir haben keine Cloud-Datenbank mit deinen Transaktionen — und wollen auch keine.',
      encryptionTitle: 'Lokale Verschlüsselung',
      encryptionActiveUnlocked: 'aktiv (entsperrt)',
      encryptionActiveLocked: 'aktiv (gesperrt)',
      encryptionInactive: 'nicht aktiviert',
      encryptionOnDesc:
        'Deine Daten liegen AES-GCM-verschlüsselt auf diesem Gerät. Ohne dein Passwort sind sie nicht lesbar.',
      encryptionOffDesc:
        'Deine Daten liegen unverschlüsselt auf diesem Gerät. Mit einem Passwort schützt du sie zusätzlich — z. B. auf geteilten Geräten.',
      enableEncryption: 'Verschlüsselung aktivieren',
      serverContactTitle: 'Dein aktueller Server-Kontakt',
      sharedWithServerLabel: 'Das geht zum Server (weil du angemeldet bist):',
      noServerContact:
        'Du nutzt die App ohne Anmeldung. Es gibt keinen Codepfad, der deine Finanzdaten an einen Server sendet.',
      neverLeavesLabel: 'Das verlässt dein Gerät nie:',
      modelTitle: 'So funktioniert das Modell',
      modelLocalFirstLabel: 'Lokal zuerst:',
      modelLocalFirst:
        'Transaktionen, Konten, Schulden und Kategorien werden in der Datenbank deines Browsers (IndexedDB) auf diesem Gerät gespeichert — nicht bei uns.',
      modelEncryptionLabel: 'Verschlüsselung:',
      modelEncryption:
        'Optional verschlüsselst du alles mit einem Passwort (AES-GCM). Das Passwort kennt nur dein Gerät — wir können deine Daten nicht entschlüsseln und auch nicht wiederherstellen, wenn du es vergisst.',
      modelLoginLabel: 'Mit Google-Login:',
      modelLogin:
        'Zum Server gehen nur deine Anmeldung, die Bank-Anbindung (GoCardless-Requisition) und deine Einstellungen. Der Login ist nötig, weil deine Bank uns kennen muss — nicht weil wir dich kennen wollen.',
      modelBackupLabel: 'Backups & Export:',
      modelBackup:
        'Backups sind standardmäßig verschlüsselt und landen als Datei bei dir — nicht auf unseren Servern. Der Export deiner Daten ist immer möglich und immer kostenlos.',
      analyticsTitle: 'Aggregierte Statistik (nur mit Opt-in)',
      analyticsIntro:
        'Nur wenn du angemeldet bist und ausdrücklich zustimmst, senden wir aggregierte Statistik — nie einzelne Buchungen:',
      analyticsPoint1: 'Nur Summen pro Zeitraum und Kategorien-Gruppe, keine Einzeltransaktionen',
      analyticsPoint2: 'Gruppen mit weniger als 5 Buchungen werden komplett unterdrückt (Suppression)',
      analyticsPoint3: 'Das Paket wird vor dem Senden auf deinem Gerät verschlüsselt',
      analyticsPoint4: 'Du kannst die Zustimmung jederzeit in den Einstellungen widerrufen',
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      back: 'Back',
      noResults: 'No results found.',
    },
    shell: {
      appName: 'Ausgabentracker',
      copilot: 'Finance copilot',
      search: 'Search',
      navigation: 'Navigation',
      openNavigation: 'Open navigation',
      more: 'More',
      openMore: 'Open more navigation targets',
      premium: 'Premium',
      pro: 'Pro',
    },
    nav: {
      groups: {
        coach: 'Coach',
        analysen: 'Analytics',
        daten: 'Data & Accounts',
        verwaltung: 'Management',
      },
      items: {
        coach: 'Today for you',
        debts: 'Debts',
        netWorth: 'Net worth',
        liquidity: 'Liquidity',
        milestones: 'Milestones',
        dashboard: 'Dashboard',
        transactions: 'Transactions',
        premium: 'Analysis',
        simulation: 'Simulation',
        trading: 'Trading',
        accounts: 'Accounts',
        csv: 'CSV upload',
        export: 'Data export',
        contracts: 'Contracts',
        settings: 'Settings',
      },
      subtitles: {
        liquidity: 'When will your money get tight?',
        premium: 'Sankey, heatmap & smart insights',
        simulation: 'Play through the future',
        trading: 'Portfolio at a glance (Beta)',
      },
      short: {
        coach: 'Today',
        dashboard: 'Overview',
        transactions: 'Transactions',
      },
    },
    premium: {
      addWidget: 'Add widget',
    },
    settings: {
      language: 'Language',
      languageDescription: 'App language. Currently applies to selected areas.',
      languageGerman: 'German',
      languageEnglish: 'English',
    },
    dashboard: {
      allTransactions: 'Select all visible transactions',
      search: 'Search...',
      selectAll: 'Select all',
      categoriesUpdated: 'Categories updated',
      updateError: 'Error updating: ',
      transactionDeleted: 'Transaction deleted',
      deleteError: 'Error deleting: ',
      transactionsDeleted: 'Transactions deleted',
      sort: 'sort',
      ascending: 'ascending',
      descending: 'descending',
      selectTransaction: 'Select transaction',
      contract: 'Contract',
      actions: 'Actions',
      date: 'Date',
      description: 'Description',
      payee: 'Payee',
      amount: 'Amount',
      prevYear: 'Previous year',
      nextYear: 'Next year',
      selectMonth: 'Select month…',
      selectCycle: 'Select cycle…',
      placeholder: '0',
      removeTransfer: 'Remove transfer',
      removeItem: 'Remove item',
      removeReserve: 'Remove reserve',
      name: 'Name (e.g. Vacation)',
      selectAccount: 'Select account',
      targetAmount: 'Target amount',
      reserveAccount: 'Reserve account',
      fromAccount: 'From account',
      toAccount: 'To account',
    },
    transactions: {
      title: 'Transactions',
      description: 'All transactions – tap a row to edit.',
      search: 'Search transactions…',
    },
    privacy: {
      title: 'How we handle your data',
      intro:
        'In short: your financial data stays on your device. We have no cloud database with your transactions — and we don’t want one.',
      encryptionTitle: 'Local encryption',
      encryptionActiveUnlocked: 'active (unlocked)',
      encryptionActiveLocked: 'active (locked)',
      encryptionInactive: 'not enabled',
      encryptionOnDesc:
        'Your data is stored AES-GCM encrypted on this device. Without your password it cannot be read.',
      encryptionOffDesc:
        'Your data is stored unencrypted on this device. A password adds extra protection — e.g. on shared devices.',
      enableEncryption: 'Enable encryption',
      serverContactTitle: 'Your current server contact',
      sharedWithServerLabel: 'This goes to the server (because you are signed in):',
      noServerContact:
        'You are using the app without signing in. There is no code path that sends your financial data to a server.',
      neverLeavesLabel: 'This never leaves your device:',
      modelTitle: 'How the model works',
      modelLocalFirstLabel: 'Local first:',
      modelLocalFirst:
        'Transactions, accounts, debts and categories are stored in your browser’s database (IndexedDB) on this device — not with us.',
      modelEncryptionLabel: 'Encryption:',
      modelEncryption:
        'Optionally you encrypt everything with a password (AES-GCM). Only your device knows the password — we cannot decrypt your data, nor recover it if you forget it.',
      modelLoginLabel: 'With Google login:',
      modelLogin:
        'Only your sign-in, the bank connection (GoCardless requisition) and your settings go to the server. The login is needed because your bank must know you — not because we want to.',
      modelBackupLabel: 'Backups & export:',
      modelBackup:
        'Backups are encrypted by default and saved as a file with you — not on our servers. Exporting your data is always possible and always free.',
      analyticsTitle: 'Aggregated statistics (opt-in only)',
      analyticsIntro:
        'Only if you are signed in and explicitly agree do we send aggregated statistics — never individual transactions:',
      analyticsPoint1: 'Only totals per period and category group, no individual transactions',
      analyticsPoint2: 'Groups with fewer than 5 transactions are fully suppressed',
      analyticsPoint3: 'The package is encrypted on your device before sending',
      analyticsPoint4: 'You can withdraw consent at any time in settings',
    },
  },
} as const;

export type TranslationTree = (typeof translations)['de'];

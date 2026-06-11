/**
 * Application constants and configuration
 */

// ============================================
// Storage
// ============================================
export const STORAGE_KEYS = {
  TRANSACTIONS: 'ausgabentracker_transactions_v3',
  ERROR_LOG: 'error_log',
  LAST_IMPORT_ACCOUNT: 'ausgabentracker_last_import_account',
  SETTINGS: 'ausgabentracker_settings',
} as const;

export const LOCAL_STORAGE_QUOTE_BYTES = 5 * 1024 * 1024; // ~5MB
export const MAX_TRANSACTIONS_LOCAL = 10000;

// ============================================
// API / Pagination
// ============================================
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_QUERY_LIMIT = 1000;
export const MAX_QUERY_LIMIT = 10000;

// ============================================
// Dates
// ============================================
export const DATE_RANGES = [
  { label: '7 Tage', days: 7, granularity: 'daily' as const },
  { label: '30 Tage', days: 30, granularity: 'daily' as const },
  { label: '90 Tage', days: 90, granularity: 'weekly' as const },
  { label: '6 Monate', days: 180, granularity: 'weekly' as const },
  { label: '1 Jahr', days: 365, granularity: 'monthly' as const },
  { label: 'Gesamt', days: 0, granularity: 'monthly' as const },
] as const;

export const TIME_ZONES = {
  EUROPE_BERLIN: 'Europe/Berlin',
  UTC: 'UTC',
} as const;

// ============================================
// Currency
// ============================================
export const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
} as const;

export const DEFAULT_CURRENCY = 'EUR';

// ============================================
// Categories
// ============================================
export const CATEGORY_LEVELS = {
  MAIN: 0,
  SUB: 1,
  SUB_SUB: 2,
} as const;

/* Ruhige Palette (#54): Petrol-Abstufungen + gedämpfte Komplementärtöne
   statt Regenbogen. Unterscheidung primär über Helligkeit + Label. */
export const CATEGORY_COLORS = [
  '#1d5c54', // Petrol dunkel (Brand)
  '#2e7d72', // Petrol
  '#4a9a8d', // Petrol hell
  '#7bb8ac', // Petrol blass
  '#5c7a99', // Schieferblau gedämpft
  '#8a7d5a', // Olive warm
  '#a8845c', // Sand warm
  '#7d6b8a', // Pflaume gedämpft
] as const;

export const CATEGORY_ICONS = [
  '🛒', '🍔', '🏠', '🚗', '💊', '🎬', '✈️', '💳', '💰', '📱',
  '👕', '🎮', '📚', '🏋️', '🎓', '💻', '🎨', '🎵', '⚽', '🍺',
] as const;

// ============================================
// Accounts
// ============================================
export const ACCOUNT_TYPES = {
  CHECKING: 'checking',
  CREDIT_CARD: 'credit_card',
  SAVINGS: 'savings',
  WALLET: 'wallet',
  OTHER: 'other',
} as const;

export const ACCOUNT_TYPE_LABELS = {
  checking: 'Girokonto',
  credit_card: 'Kreditkarte',
  savings: 'Tagesgeld/Sparkonto',
  wallet: 'Wallet (PayPal, Revolut, etc.)',
  other: 'Sonstiges',
} as const;

export const ACCOUNT_TYPE_ICONS = {
  checking: '🏦',
  credit_card: '💳',
  savings: '🐷',
  wallet: '📱',
  other: '💰',
} as const;

/* Ruhige Petrol-Abstufungen statt Regenbogen (#54) */
export const ACCOUNT_TYPE_COLORS = {
  checking: '#1d5c54',
  credit_card: '#5c7a99',
  savings: '#4a9a8d',
  wallet: '#a8845c',
  other: '#7d8a87',
} as const;

export const FREE_ACCOUNT_LIMIT = 3;

// ============================================
// Transactions
// ============================================
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
} as const;

export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
} as const;

// ============================================
// Simulation
// ============================================
export const SCENARIO_TYPES = {
  OPTIMISTIC: 'optimistic',
  REALISTIC: 'realistic',
  PESSIMISTIC: 'pessimistic',
} as const;

export const SIMULATION_MONTHS = 12;
export const DEFAULT_RISK_FACTOR = 1.0;
export const MIN_RISK_FACTOR = 0.5;
export const MAX_RISK_FACTOR = 2.5;

// ============================================
// Contracts
// ============================================
export const CONTRACT_CYCLES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  HALF_YEARLY: 'half-yearly',
  YEARLY: 'yearly',
} as const;

export const CONTRACT_CYCLE_LABELS = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  'half-yearly': 'Halbjährlich',
  yearly: 'Jährlich',
} as const;

// ============================================
// Analytics
// ============================================
/* Token-basiert (#54): Grün nur für Einnahmen-Akzent, Ausgaben in Brand */
export const CHART_COLORS = {
  INCOME: 'hsl(var(--positive))',
  EXPENSES: 'hsl(var(--brand))',
  BALANCE: 'hsl(var(--foreground))',
  CONTRACTS: 'hsl(var(--premium))',
  VARIABLES: 'hsl(var(--muted-foreground))',
} as const;

export const CHART_GRADIENTS = {
  GREEN: ['hsl(152, 45%, 45%)', 'hsl(var(--positive))'],
  BLUE: ['hsl(174, 45%, 40%)', 'hsl(var(--brand))'],
  RED: ['hsl(4, 60%, 60%)', 'hsl(var(--warning))'],
  PURPLE: ['hsl(262, 55%, 65%)', 'hsl(var(--premium))'],
} as const;

// ============================================
// Performance
// ============================================
export const VIRTUAL_SCROLL_ITEM_HEIGHT = 60; // pixels
export const VIRTUAL_SCROLL_OVERSCAN = 5; // items to render outside viewport

export const DEBOUNCE_MS = 300;
export const THROTTLE_MS = 100;

export const CACHE_STALE_TIME = 5 * 60 * 1000; // 5 minutes
export const CACHE_GC_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================
// Backup
// ============================================
export const BACKUP_VERSION = '1.0.0';
export const BACKUP_FILENAME_PREFIX = 'ausgabentracker_backup';
export const BACKUP_MAX_SIZE = 50 * 1024 * 1024; // 50MB

// ============================================
// Export
// ============================================
export const EXPORT_FORMATS = {
  CSV: 'csv',
  PDF: 'pdf',
  JSON: 'json',
} as const;

export const CSV_DELIMITER = ';';
export const CSV_ENCODING = 'utf-8';

// ============================================
// Validation
// ============================================
export const VALIDATION = {
  MIN_CATEGORY_NAME_LENGTH: 2,
  MAX_CATEGORY_NAME_LENGTH: 50,
  MAX_FILTERS_PER_CATEGORY: 10,
  MAX_FILTER_LENGTH: 50,
  
  MIN_ACCOUNT_NAME_LENGTH: 2,
  MAX_ACCOUNT_NAME_LENGTH: 50,
  
  MIN_TRANSACTION_AMOUNT: 0.01,
  MAX_TRANSACTION_AMOUNT: 1000000,
  
  MAX_TRANSACTIONS_PER_EXPORT: 50000,
} as const;

// ============================================
// Error Codes
// ============================================
export const ERROR_CODES = {
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_BACKUP: 'INVALID_BACKUP',
  BACKUP_VERSION_MISMATCH: 'BACKUP_VERSION_MISMATCH',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
} as const;

// ============================================
// Feature Flags
// ============================================
export const FEATURES = {
  CLOUD_STORAGE: true,
  OFFLINE_MODE: true,
  AUTO_SYNC: true,
  BACKUP: true,
  EXPORT: true,
  IMPORT: true,
  SIMULATION: true,
  CONTRACTS: true,
  PREMIUM_ANALYTICS: true,
} as const;

// ============================================
// App Info
// ============================================
export const APP_NAME = 'Ausgabentracker';
export const APP_VERSION = '2.0.0';
export const APP_DESCRIPTION = 'Intelligente Ausgabenverfolgung mit hierarchischen Kategorien';

export const SUPPORT_EMAIL = 'support@ausgabentracker.de';
export const DOCS_URL = 'https://docs.ausgabentracker.de';
export const PRIVACY_URL = 'https://ausgabentracker.de/privacy';
export const TERMS_URL = 'https://ausgabentracker.de/terms';

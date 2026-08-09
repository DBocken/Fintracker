/**
 * Persistierte Formen rund um Kategorien und Sonderkategorien („Anlässe").
 *
 * Kategorien sind Domäne, nicht Darstellung und nicht Speicherung — der
 * `local-finance-store`/`category-service` speichert sie, besitzt die Form
 * aber nicht (AGENTS.md §3). Diese Datei ist Teil der Aufteilung von
 * `src/types.ts` (WP 5.2, DOM-3).
 */
import type { Rhythmus, TransactionAllocation } from '@/lib/transaction-types';

export type Prioritaet = 'essential' | 'normal' | 'nice';
export type Zahlungsweg = 'giro' | 'credit' | 'paypal' | 'cash';

/**
 * Vorgelagerte Ausgabenklasse über den Hauptkategorien. Dient als oberste
 * Aggregationsebene (Sunburst-Innenring) und entkoppelt die Essenziell-Sicht
 * von der Kategorie-Hierarchie, weil `essenziell` je Unterkategorie variiert.
 */
export type Ausgabenklasse = 'essenziell' | 'diskretionaer' | 'sparen' | 'einkommen';

export interface CategoryAttributes {
  ist_vertrag?: boolean;
  rhythmus?: Rhythmus | null;
  faelligkeitstag?: number | null;
  next_due_date?: string | null;
  kuendigungsfrist_tage?: number | null;
  vertragsende?: string | null;
  fixkosten?: boolean;
  essenziell?: boolean;
  /** Vorgelagerte Klasse; `essenziell` bleibt als abgeleitetes Bool erhalten. */
  ausgabenklasse?: Ausgabenklasse;
  prioritaet?: Prioritaet | null;
  budget_monat?: number | null;
  warnschwelle_prozent?: number | null;
  zahlungsweg?: Zahlungsweg | null;
  merchant_alias?: string | null;
  steuerrelevant?: boolean;
  /** Default-Steuer-Rubrik: Buchungen dieser Kategorie werden mit dieser Rubrik VORGESCHLAGEN (nie automatisch markiert). */
  default_tax_category_id?: string | null;
  tags?: string[];
  sichtbar?: boolean;
  archiviert?: boolean;
  sort_index?: number | null;
  priority_level?: number | null;
  min_budget_monat?: number | null;
  flexible?: boolean;
  protected?: boolean;
}

export interface Category {
  id: string;
  user_id?: string | null;
  /**
   * Anzeigename. Bei Standard-Kategorien der deutsche Ausgangstext, der als
   * Fallback zu {@link name_key} dient; bei selbst angelegten oder umbenannten
   * Kategorien der Text der Nutzerin.
   */
  name: string;
  /**
   * i18n-Key des Anzeigenamens — nur bei NICHT umbenannten Standard-Kategorien
   * gesetzt. `getLocalCategories()` loest ihn beim Lesen auf, deshalb folgt die
   * Beschriftung der Sprache, ohne dass eine Renderstelle das wissen muss.
   *
   * Sobald die Nutzerin umbenennt, wird das Feld auf `null` gesetzt: ab dann
   * gewinnt ihr Text und ein Sprachwechsel fasst ihn nicht mehr an.
   * `filters` (die Such-Stichwoerter) bleiben davon immer unberuehrt — sie
   * matchen deutschen Kontoauszugstext und werden nie uebersetzt.
   */
  name_key?: string | null;
  color?: string;
  icon?: string;
  filters: string[];
  is_default?: boolean;
  parent_id?: string | null;
  level?: number;
  attributes?: CategoryAttributes;
}

export interface HierarchicalCategory extends Category {
  children?: HierarchicalCategory[];
  parent?: HierarchicalCategory;
}

/**
 * Sonderkategorie („Anlass") – eine quer zur Kategorie-Hierarchie liegende
 * Dimension, die Buchungen aus beliebigen Kategorien, Konten und Zahlungswegen
 * zu einem Ereignis bündelt (z. B. „Flitterwochen"). Eine Buchung behält immer
 * ihre echte {@link Transaction.category_id}; die Anlass-Zuordnung ist rein
 * additiv und kontoneutral.
 *
 * Anlässe haben eine eigene Parent-Hierarchie (`parent_id`), damit „Hochzeit"
 * die Summen ihrer Kind-Anlässe (Polterabend, Feier, Flitterwochen) mit-
 * aggregiert. Zyklen sind verboten (siehe `hierarchy.ts`). Premium-Feature.
 */
export interface SpecialCategory {
  id: string;
  user_id?: string | null;
  name: string;
  /** Übergeordneter Anlass (z. B. Flitterwochen → Hochzeit). null = oberste Ebene. */
  parent_id?: string | null;
  color?: string;
  icon?: string;
  /** Optionaler Ereignis-Zeitraum (ISO `YYYY-MM-DD`) – Grundlage für Vorschläge, kein harter Filter. */
  start_date?: string | null;
  end_date?: string | null;
  /** Vorlauf-Tage vor `start_date`, in denen Buchungen noch vorgeschlagen werden (Default 14). */
  lead_days?: number | null;
  /** Optionales Kostenziel in Integer-Cent (Anlass-Budget). null = kein Ziel. */
  target_minor?: number | null;
  note?: string | null;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Herkunft einer Anlass-Zuordnung. */
export type SpecialCategoryAssignmentSource = 'manual' | 'suggestion';

/**
 * n:m-Zuordnung einer Buchung (oder eines Teilbetrags davon) zu einem
 * {@link SpecialCategory}. Kontoneutral: erzeugt keine Buchung und verändert
 * keine Salden – reine Auswertungs-Schicht (wie {@link TransactionAllocation}).
 *
 * `amount_minor` erlaubt die cent-genaue Teil-Zuordnung (z. B. 20 € Trinkgeld
 * aus einer 100-€-Barabhebung). Fehlt es, zählt die ganze Buchung. Die Summe
 * aller Teil-Zuordnungen einer Buchung darf `|amount|` nicht überschreiten.
 */
export interface SpecialCategoryAssignment {
  id: string;
  special_category_id: string;
  transaction_id: string;
  /** Teilbetrag in Integer-Cent (positiv). null/undefined = ganze Buchung. */
  amount_minor?: number | null;
  /** Optional an einen konkreten Split ({@link TransactionAllocation}) gebunden. */
  allocation_id?: string | null;
  source: SpecialCategoryAssignmentSource;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

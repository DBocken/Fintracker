/**
 * Reiner Kern der Einstellungs-Slice (WP 6.5b).
 *
 * Die drei Funktionen standen bis WP 6.5b als Ausdrücke in
 * `EnhancedSettings.tsx` (`settings?.retention_months || 36`) bzw. gar nicht
 * (die Kategorie wurde als Objekt festgehalten statt über ihre ID gesucht).
 * Hier sind sie einzeln prüfbar — inklusive der Eigenheit, dass `0` Monate
 * bewusst auf die Voreinstellung fällt.
 */
import { describe, it, expect } from 'vitest';
import type { HierarchicalCategory, UserSettings } from '@/types';
import {
  DEFAULT_RETENTION_MONTHS,
  findCategoryById,
  resolveAutoConfirmMapping,
  resolveRetentionMonths,
} from '../settings-overview';

function settings(partial: Partial<UserSettings>): UserSettings {
  return {
    user_id: 'u1',
    auto_confirm_mapping: false,
    retention_months: 36,
    enable_subcategories: true,
    ...partial,
  };
}

function kategorie(id: string, name: string, children?: HierarchicalCategory[]): HierarchicalCategory {
  return {
    id,
    user_id: 'u1',
    name,
    color: '#2e7d72',
    icon: '🛒',
    filters: [],
    parent_id: null,
    children,
  };
}

describe('settings-overview (Domäne der Einstellungen)', () => {
  describe('resolveRetentionMonths', () => {
    it('sollte den gespeicherten Wert liefern', () => {
      expect(resolveRetentionMonths(settings({ retention_months: 12 }))).toBe(12);
    });

    it('sollte ohne Einstellungen die Voreinstellung liefern', () => {
      expect(resolveRetentionMonths(undefined)).toBe(DEFAULT_RETENTION_MONTHS);
      expect(resolveRetentionMonths(null)).toBe(DEFAULT_RETENTION_MONTHS);
    });

    it('sollte 0 Monate wie „nicht gesetzt" behandeln — Bestandsverhalten', () => {
      // `settings?.retention_months || 36` in EnhancedSettings.tsx: Die 0 war nie
      // eine wählbare Dauer, sondern der Zustand vor der ersten Speicherung.
      expect(resolveRetentionMonths(settings({ retention_months: 0 }))).toBe(DEFAULT_RETENTION_MONTHS);
    });
  });

  describe('resolveAutoConfirmMapping', () => {
    it('sollte den gespeicherten Wert liefern', () => {
      expect(resolveAutoConfirmMapping(settings({ auto_confirm_mapping: true }))).toBe(true);
    });

    it('sollte ohne Einstellungen aus sein', () => {
      expect(resolveAutoConfirmMapping(undefined)).toBe(false);
    });
  });

  describe('findCategoryById', () => {
    const baum = [
      kategorie('food', 'Lebensmittel', [kategorie('food-bio', 'Bioladen')]),
      kategorie('rent', 'Miete'),
    ];

    it('sollte eine Hauptkategorie über ihre ID finden', () => {
      expect(findCategoryById(baum, 'rent')?.name).toBe('Miete');
    });

    it('sollte eine Unterkategorie über ihre ID finden', () => {
      // Der Baum aus `getHierarchicalCategories` trägt Kinder; die Auswahl in
      // der Kategorieverwaltung kann jede Ebene treffen.
      expect(findCategoryById(baum, 'food-bio')?.name).toBe('Bioladen');
    });

    it('sollte ohne Auswahl null liefern', () => {
      expect(findCategoryById(baum, null)).toBeNull();
    });

    it('sollte für eine gelöschte Kategorie null liefern statt eines veralteten Standes', () => {
      expect(findCategoryById(baum, 'weg')).toBeNull();
    });
  });
});

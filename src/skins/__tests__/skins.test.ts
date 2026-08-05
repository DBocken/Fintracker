import { describe, it, expect } from 'vitest';
import {
  SKINS,
  getSkin,
  normalizeSkinId,
  ACTIVE_SKINS,
  INACTIVE_SKIN_IDS,
  getActiveSkinId,
} from '../skins';

describe('Skins Registry', () => {
  describe('Normal Behavior', () => {
    it('sollte für jede Skin eine eindeutige id und className haben', () => {
      const ids = SKINS.map((s) => s.id);
      const classNames = SKINS.map((s) => s.className);
      expect(new Set(ids).size).toBe(SKINS.length);
      expect(new Set(classNames).size).toBe(SKINS.length);
    });

    it('sollte className nach dem Schema theme-<id> benennen', () => {
      for (const skin of SKINS) {
        expect(skin.className).toBe(`theme-${skin.id}`);
      }
    });

    it('sollte für jede Skin name, description und swatch setzen', () => {
      for (const skin of SKINS) {
        expect(skin.name.length).toBeGreaterThan(0);
        expect(skin.description.length).toBeGreaterThan(0);
        expect(skin.swatch.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Iron Man Theme', () => {
    it('sollte das Iron-Man-Theme registriert haben', () => {
      const ironMan = SKINS.find((s) => s.id === 'iron-man');
      expect(ironMan).toBeDefined();
      expect(ironMan?.name).toBe('Iron Man');
      expect(ironMan?.className).toBe('theme-iron-man');
      expect(ironMan?.font).toBe('Orbitron');
    });

    it('sollte über getSkin auflösbar sein', () => {
      expect(getSkin('iron-man').id).toBe('iron-man');
    });

    it('sollte über normalizeSkinId als gültig erkannt werden', () => {
      expect(normalizeSkinId('iron-man')).toBe('iron-man');
    });
  });

  describe('Cyberpunk & Liquid Holo Themes', () => {
    it('sollte das Cyberpunk-Theme registriert und auflösbar haben', () => {
      const cyber = SKINS.find((s) => s.id === 'cyberpunk');
      expect(cyber?.name).toBe('Cyberpunk');
      expect(cyber?.className).toBe('theme-cyberpunk');
      expect(getSkin('cyberpunk').id).toBe('cyberpunk');
      expect(normalizeSkinId('cyberpunk')).toBe('cyberpunk');
    });

    it('sollte das Liquid-Holo-Theme registriert und auflösbar haben', () => {
      const holo = SKINS.find((s) => s.id === 'liquid-holo');
      expect(holo?.name).toBe('Liquid Holo');
      expect(holo?.className).toBe('theme-liquid-holo');
      expect(getSkin('liquid-holo').id).toBe('liquid-holo');
      expect(normalizeSkinId('liquid-holo')).toBe('liquid-holo');
    });
  });

  describe('Neon (Stranger Things) Theme', () => {
    it('[REGRESSION] sollte das Neon-Theme nach dem Redesign erhalten bleiben', () => {
      const neon = SKINS.find((s) => s.id === 'neon');
      expect(neon?.className).toBe('theme-neon');
      expect(getSkin('neon').id).toBe('neon');
      expect(normalizeSkinId('neon')).toBe('neon');
    });
  });

  describe('Edge Cases', () => {
    it('sollte unbekannte Werte auf den Standard "ruhe" normalisieren', () => {
      expect(normalizeSkinId('does-not-exist')).toBe('ruhe');
      expect(normalizeSkinId(null)).toBe('ruhe');
      expect(normalizeSkinId(undefined)).toBe('ruhe');
    });

    it('[REGRESSION] sollte veraltete clean-* ids auf "clean" mappen', () => {
      expect(normalizeSkinId('clean-blue')).toBe('clean');
    });

    it('sollte bei unbekannter id in getSkin auf die erste Skin zurückfallen', () => {
      // @ts-expect-error absichtlich ungültige id für Robustheits-Test
      expect(getSkin('nope').id).toBe(SKINS[0].id);
    });
  });

  describe('Skin-Konsolidierung (WP-2.2)', () => {
    it('sollte ACTIVE_SKINS mit genau 3 aktiven Skins definieren', () => {
      expect(ACTIVE_SKINS).toHaveLength(3);
      const ids = ACTIVE_SKINS.map((s) => s.id);
      expect(ids).toContain('ruhe');
      expect(ids).toContain('legacy');
    });

    it('sollte INACTIVE_SKIN_IDS 6 inaktive Skins enthalten', () => {
      expect(INACTIVE_SKIN_IDS).toHaveLength(6);
      // Die aktiven Skins dürfen nicht in INACTIVE_SKIN_IDS sein
      for (const active of ACTIVE_SKINS) {
        expect(INACTIVE_SKIN_IDS).not.toContain(active.id);
      }
    });

    it('sollte ACTIVE_SKINS + INACTIVE_SKINS = SKINS ergeben', () => {
      const activeIds = new Set(ACTIVE_SKINS.map((s) => s.id));
      const inactiveIds = new Set(INACTIVE_SKIN_IDS);
      const allIds = new Set([...activeIds, ...inactiveIds]);
      expect(allIds.size).toBe(SKINS.length);
    });

    it('sollte getActiveSkinId für aktive Skins unverändert liefern', () => {
      expect(getActiveSkinId('ruhe')).toBe('ruhe');
      expect(getActiveSkinId('legacy')).toBe('legacy');
    });

    it('sollte getActiveSkinId für inaktive Skins auf ruhe normalisieren', () => {
      expect(getActiveSkinId('cyberpunk')).toBe('ruhe');
      expect(getActiveSkinId('neon')).toBe('ruhe');
      expect(getActiveSkinId('imperium')).toBe('ruhe');
      expect(getActiveSkinId('sakura')).toBe('ruhe');
      expect(getActiveSkinId('iron-man')).toBe('ruhe');
      expect(getActiveSkinId('liquid-holo')).toBe('ruhe');
    });

    it('sollte getActiveSkinId für unbekannte/null auf ruhe liefern', () => {
      expect(getActiveSkinId('does-not-exist')).toBe('ruhe');
      expect(getActiveSkinId(null)).toBe('ruhe');
      expect(getActiveSkinId(undefined)).toBe('ruhe');
    });

    it('[VB-1] sollte getSkin für inaktive Skins weiterhin die Definition liefern', () => {
      const cyber = getSkin('cyberpunk');
      expect(cyber).toBeDefined();
      expect(cyber.id).toBe('cyberpunk');
      expect(cyber.className).toBe('theme-cyberpunk');
    });

    it('[VB-1] sollte normalizeSkinId für inaktive Skins unverändert bleiben', () => {
      expect(normalizeSkinId('cyberpunk')).toBe('cyberpunk');
      expect(normalizeSkinId('sakura')).toBe('sakura');
    });
  });
});

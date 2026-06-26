import { describe, it, expect } from 'vitest';
import { SKINS, getSkin, normalizeSkinId } from '../skins';

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
});

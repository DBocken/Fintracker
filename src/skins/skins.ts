export type SkinId = 'ruhe' | 'legacy' | 'clean' | 'neon';

export type SkinDef = {
  id: SkinId;
  name: string;
  className: string; // CSS class added to <html>
};

export const SKINS: SkinDef[] = [
  { id: 'ruhe', name: 'Ruhe', className: 'theme-ruhe' },
  { id: 'legacy', name: 'Legacy', className: 'theme-legacy' },
  { id: 'clean', name: 'Clean', className: 'theme-clean' },
  { id: 'neon', name: 'Neon (Stranger-Style)', className: 'theme-neon' },
];

const THEME_CLASS_PREFIX = 'theme-';

export function applySkinClass(skinId: SkinId) {
  const root = document.documentElement;
  // remove any previous theme-* class
  const toRemove: string[] = [];
  root.classList.forEach(cls => {
    if (cls.startsWith(THEME_CLASS_PREFIX)) toRemove.push(cls);
  });
  toRemove.forEach(cls => root.classList.remove(cls));

  const def = SKINS.find(s => s.id === skinId) || SKINS[0];
  root.classList.add(def.className);
}
import { describe, expect, it } from 'vitest';
import { resolveSwipeTarget } from './DashboardMobileStory';

describe('[MOBILE] finance story swipe guardrails', () => {
  it('ignoriert vertikales und diagonales Scrollen', () => {
    expect(resolveSwipeTarget(2, 55, 100)).toBe(2);
    expect(resolveSwipeTarget(2, -60, 70)).toBe(2);
  });

  it('wechselt nur bei einer klar horizontalen Geste', () => {
    expect(resolveSwipeTarget(2, -80, 10)).toBe(3);
    expect(resolveSwipeTarget(2, 80, 10)).toBe(1);
  });

  it('läuft an den Rändern nicht aus dem gültigen Bereich', () => {
    expect(resolveSwipeTarget(0, 100, 0)).toBe(0);
    expect(resolveSwipeTarget(5, -100, 0)).toBe(5);
  });
});

/**
 * Wisch-Regeln als reine Funktion — ohne DOM, ohne Fläche.
 *
 * Die Fälle stammen aus dem Bestand: Vorher lagen dieselben Regeln nur in der
 * Dashboard-Story, und ihr Test kannte sie ausschliesslich mit deren sechs
 * Ansichten. Die Coach-Fläche hat vier — deshalb prüft dieser Test die
 * Randregel ausdrücklich mit einer anderen Ansichtszahl.
 */

import { describe, expect, it } from 'vitest';
import { resolveSwipeTarget, SWIPE_MIN_DISTANCE_PX } from '../swipe-navigation';

describe('[MOBILE] Wisch-Navigation zwischen mobilen Ansichten', () => {
  it('sollte vertikales und diagonales Scrollen ignorieren', () => {
    expect(resolveSwipeTarget(2, 55, 100, 6)).toBe(2);
    expect(resolveSwipeTarget(2, -60, 70, 6)).toBe(2);
  });

  it('sollte nur bei einer klar horizontalen Geste wechseln', () => {
    expect(resolveSwipeTarget(2, -80, 10, 6)).toBe(3);
    expect(resolveSwipeTarget(2, 80, 10, 6)).toBe(1);
  });

  it('sollte an den Rändern im gültigen Bereich bleiben', () => {
    expect(resolveSwipeTarget(0, 100, 0, 6)).toBe(0);
    expect(resolveSwipeTarget(5, -100, 0, 6)).toBe(5);
  });

  it('sollte den Rand an der übergebenen Ansichtszahl festmachen, nicht an einer festen Sechs', () => {
    // Coach-Fläche: vier Ansichten. Mit der alten, fest verdrahteten Sechs
    // wäre hier ein Index 4 herausgekommen — eine Ansicht, die es nicht gibt.
    expect(resolveSwipeTarget(3, -100, 0, 4)).toBe(3);
    expect(resolveSwipeTarget(3, 100, 0, 4)).toBe(2);
  });

  it('sollte eine Bewegung knapp unter der Mindestweite als Antippen werten', () => {
    expect(resolveSwipeTarget(1, SWIPE_MIN_DISTANCE_PX - 1, 0, 4)).toBe(1);
    expect(resolveSwipeTarget(1, -SWIPE_MIN_DISTANCE_PX, 0, 4)).toBe(2);
  });
});

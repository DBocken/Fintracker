/**
 * WP 6.4 (ARCH-5/DOM-5): Die Rangfolge „laden vor Fehler vor leer" existierte
 * bis hierher NUR als if/else-Reihenfolge im JSX von `CityPage.tsx:790-801`.
 * Drei unabhaengige Booleans koennen gleichzeitig wahr sein — welcher Zustand
 * dann gewinnt, stand nirgends geschrieben und war durch nichts gesichert.
 */
import { describe, it, expect } from 'vitest';
import { deriveCityRequestState } from '../city-request-state';

describe('deriveCityRequestState', () => {
  it('sollte den Ladezustand melden, solange geladen wird', () => {
    expect(deriveCityRequestState({ isLoading: true, isError: false, isEmpty: false })).toBe('loading');
  });

  it('sollte den Ladezustand ueber den Fehler stellen (ein Refetch laeuft noch)', () => {
    expect(deriveCityRequestState({ isLoading: true, isError: true, isEmpty: true })).toBe('loading');
  });

  it('sollte den Fehler ueber den Leerzustand stellen — eine leere Stadt hiesse „du hast noch nichts erfasst"', () => {
    expect(deriveCityRequestState({ isLoading: false, isError: true, isEmpty: true })).toBe('error');
  });

  it('sollte den Fehler auch bei vorhandenen Altdaten melden', () => {
    expect(deriveCityRequestState({ isLoading: false, isError: true, isEmpty: false })).toBe('error');
  });

  it('sollte den Leerzustand nur ohne Fehler melden', () => {
    expect(deriveCityRequestState({ isLoading: false, isError: false, isEmpty: true })).toBe('empty');
  });

  it('sollte fertig melden, wenn Daten da sind', () => {
    expect(deriveCityRequestState({ isLoading: false, isError: false, isEmpty: false })).toBe('ready');
  });
});

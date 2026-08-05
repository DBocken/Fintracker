import { describe, it, expect, vi, afterEach } from 'vitest';
import { isFirstVisit, markVisited } from '../first-visit';

const localStorageMock: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMock[key] ?? null,
  setItem: (key: string, value: string) => { localStorageMock[key] = value; },
  removeItem: (key: string) => { delete localStorageMock[key]; },
  clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]); },
});

afterEach(() => {
  Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
});

describe('First-Visit Signature Moment (WP-5.5)', () => {
  it('sollte bei erstem Besuch true liefern', () => {
    expect(isFirstVisit()).toBe(true);
  });

  it('sollte nach markVisited() false liefern', () => {
    markVisited();
    expect(isFirstVisit()).toBe(false);
  });

  it('sollte nach markVisited() persistent bleiben', () => {
    markVisited();
    // Simulate new session (fresh localStorage reference)
    expect(isFirstVisit()).toBe(false);
  });

  it('sollte bei gesetztem localStorage-Flag false liefern', () => {
    localStorageMock['fintracker.city.first-visit-done'] = '1';
    expect(isFirstVisit()).toBe(false);
  });

  it('sollte bei fehlgeschlagenem localStorage gracefully true liefern', () => {
    // Simulate localStorage being unavailable (private browsing)
    const original = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Blocked'); },
      setItem: () => { throw new Error('Blocked'); },
    });
    expect(isFirstVisit()).toBe(true);
    vi.stubGlobal('localStorage', original);
  });
});

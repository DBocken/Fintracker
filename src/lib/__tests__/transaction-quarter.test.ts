import { describe, expect, it } from 'vitest'
import { quarterKeyForDate, UNKNOWN_QUARTER_KEY } from '../transaction-quarter'

describe('quarterKeyForDate (WP 4.1b, PERF-1)', () => {
  it('sollte den 15.01.2026 dem Quartal 2026-Q1 zuordnen', () => {
    expect(quarterKeyForDate('2026-01-15')).toBe('2026-Q1')
  })

  it('sollte den letzten Tag eines Quartals noch demselben Quartal zuordnen (31.03.2026 -> Q1)', () => {
    expect(quarterKeyForDate('2026-03-31')).toBe('2026-Q1')
  })

  it('sollte den ersten Tag des Folgequartals dem neuen Quartal zuordnen (01.04.2026 -> Q2)', () => {
    expect(quarterKeyForDate('2026-04-01')).toBe('2026-Q2')
  })

  it('sollte den 31.12.2026 dem Quartal 2026-Q4 zuordnen', () => {
    expect(quarterKeyForDate('2026-12-31')).toBe('2026-Q4')
  })

  it('sollte ein leeres Datum dem festen Chunk "unknown" zuordnen', () => {
    expect(quarterKeyForDate('')).toBe(UNKNOWN_QUARTER_KEY)
  })

  it('sollte ein fehlendes Datum (undefined/null) dem festen Chunk "unknown" zuordnen', () => {
    expect(quarterKeyForDate(undefined)).toBe(UNKNOWN_QUARTER_KEY)
    expect(quarterKeyForDate(null)).toBe(UNKNOWN_QUARTER_KEY)
  })

  it('sollte ein syntaktisch kaputtes Datum dem festen Chunk "unknown" zuordnen', () => {
    expect(quarterKeyForDate('nicht-ein-datum')).toBe(UNKNOWN_QUARTER_KEY)
    expect(quarterKeyForDate('2026/01/15')).toBe(UNKNOWN_QUARTER_KEY)
  })

  it('[REGRESSION] sollte einen Monat außerhalb 01-12 als "unknown" behandeln statt eine falsche Quartalszahl zu bilden', () => {
    expect(quarterKeyForDate('2026-13-01')).toBe(UNKNOWN_QUARTER_KEY)
    expect(quarterKeyForDate('2026-00-01')).toBe(UNKNOWN_QUARTER_KEY)
  })
})

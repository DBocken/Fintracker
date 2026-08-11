import { describe, expect, it } from 'vitest';
import { findeUnmaskierteBetraege, istRenderschicht } from '../money-format-core.mjs';

/**
 * Wächter gegen unmaskierte Geldbeträge (Issue #296).
 *
 * Beide Richtungen sind festgehalten. Die zweite ist die wichtigere: Ein
 * Wächter, der `TransactionTable` anmeckert — die ihren rohen Formatierer
 * korrekt durch `money.mask()` schickt — hätte am ersten Tag Fehlalarm und
 * würde abgeschaltet statt befolgt.
 */

describe('istRenderschicht', () => {
  it('sollte Komponenten, Seiten und Slice-Präsentation prüfen', () => {
    expect(istRenderschicht('src/components/debts/DebtCard.tsx')).toBe(true);
    expect(istRenderschicht('src/pages/DebtsPage.tsx')).toBe(true);
    expect(istRenderschicht('src/features/trading/presentation/PositionTable.tsx')).toBe(true);
  });

  it('sollte Tests, Domänen- und Datenschicht nicht prüfen', () => {
    expect(istRenderschicht('src/components/__tests__/DebtCard.test.tsx')).toBe(false);
    expect(istRenderschicht('src/lib/kpi-definitions.ts')).toBe(false);
    expect(istRenderschicht('src/services/debt-service.ts')).toBe(false);
  });
});

describe('findeUnmaskierteBetraege', () => {
  it('sollte einen direkt gerenderten Betrag melden', () => {
    const quelle = `
      const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
      export function DebtCard({ debt }) {
        return <span>{eur.format(debt.balance)}</span>;
      }
    `;
    const funde = findeUnmaskierteBetraege(quelle, 'src/components/DebtCard.tsx');
    expect(funde).toHaveLength(1);
    expect(funde[0].formatierer).toBe('eur');
  });

  it('sollte schweigen, wenn das Ergebnis durch money.mask läuft', () => {
    const quelle = `
      const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
      export function Table({ tx }) {
        const money = useMoneyFormat();
        const label = money.mask(eur.format(tx.amount));
        return <span>{label}</span>;
      }
    `;
    expect(findeUnmaskierteBetraege(quelle, 'src/components/Table.tsx')).toEqual([]);
  });

  it('sollte auch die Klassen-Variante von mask akzeptieren', () => {
    const quelle = `
      const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
      export function Card({ d }) {
        const money = useMoneyFormat();
        return <span>{money.mask(eur.format(d.paid), 'progress')}</span>;
      }
    `;
    expect(findeUnmaskierteBetraege(quelle, 'src/components/Card.tsx')).toEqual([]);
  });

  it('sollte Prozent- und Dezimalformatierer nicht anfassen', () => {
    // Eine Sparquote ist kein Betrag — der Sanfte Modus verdeckt Geld.
    const quelle = `
      const pct = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });
      export function Kpi({ v }) { return <span>{pct.format(v)}</span>; }
    `;
    expect(findeUnmaskierteBetraege(quelle, 'src/components/Kpi.tsx')).toEqual([]);
  });

  it('sollte eine halb maskierte Datei trotzdem melden', () => {
    // Der eigentliche blinde Fleck: irgendwo in der Datei wird richtig
    // gearbeitet, und der Rest steht ungeschützt daneben.
    const quelle = `
      const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
      export function Panel({ a, b }) {
        const money = useMoneyFormat();
        return <><span>{money.mask(eur.format(a))}</span><span>{eur.format(b)}</span></>;
      }
    `;
    const funde = findeUnmaskierteBetraege(quelle, 'src/components/Panel.tsx');
    expect(funde).toHaveLength(1);
  });

  it('sollte eine Datei ohne eigenen Währungsformatierer nicht prüfen', () => {
    const quelle = `
      export function Card({ d }) {
        const money = useMoneyFormat();
        return <span>{money.format(d.balance)}</span>;
      }
    `;
    expect(findeUnmaskierteBetraege(quelle, 'src/components/Card.tsx')).toEqual([]);
  });

  it('sollte mehrere Aufrufe desselben Formatierers einzeln melden', () => {
    const quelle = `
      const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
      export function P({ a, b }) {
        return <><span>{eur.format(a)}</span><span>{eur.format(b)}</span></>;
      }
    `;
    expect(findeUnmaskierteBetraege(quelle, 'src/components/P.tsx')).toHaveLength(2);
  });
});

/**
 * Budgets hängen an der HAUPTKATEGORIE — die Frage darf an einer
 * Unterkategorie nicht scheitern.
 *
 * Nutzerfund (28.08., Produktion): „Welches budget für wohnung?" wurde
 * richtig verstanden — die Fläche zeigte die erkannte Kategorie als Chip —
 * und antwortete trotzdem „Dafür ist noch kein Budget angelegt", obwohl auf
 * der Budget-Seite ein gefüllter Tank stand.
 *
 * Ursache ist eine Asymmetrie, die niemand hergestellt hat, sondern die aus
 * zwei richtigen Einzelentscheidungen entstand:
 *
 * - `suggestBudgets` ordnet jede Ausgabe ihrer Hauptkategorie zu
 *   (`cat.parent_id ?? cat.id`) — ein Budget hängt deshalb IMMER an einer
 *   Hauptkategorie.
 * - Die Kategorie-Auflösung der Frage liefert eine ROHE ID, und ihre
 *   Stichwort-Kaskade arbeitet laut eigener Dokumentation ausschliesslich
 *   auf der Unterkategorie-Ebene („Die Keywords liegen ausschliesslich auf
 *   der Unterkategorie-Ebene").
 *
 * Beides für sich ist richtig. Zusammen heisst es: Wird die Frage über ein
 * Stichwort aufgelöst, kann sie ein Budget strukturell nie finden — und die
 * Antwort behauptet, es gäbe keines. Das ist keine fehlende Zahl, sondern
 * eine FALSCHE Auskunft über den eigenen Bestand.
 */
import { describe, expect, it } from 'vitest';
import { questions } from '../questions';
import type { QuestionData, QuestionSlots } from '@/lib/question-registry';
import type { Budget } from '@/lib/budget-types';
import type { Category, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

const HAUPT = 'cat-wohnen';
const UNTER = 'cat-wohnen-miete';

const KATEGORIEN: Category[] = [
  { id: HAUPT, name: 'Wohnen', filters: [] },
  // Die Unterkategorie trägt die Stichwörter — genau die Ebene, auf der die
  // Kaskade auflöst.
  { id: UNTER, name: 'Miete', parent_id: HAUPT, filters: ['wohnung', 'miete'] },
] as unknown as Category[];

const BUDGETS: Budget[] = [
  { id: 'b1', name: 'Wohnen', category_id: HAUPT, limit: 900 } as Budget,
];

let seq = 0;
function tx(o: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    date: '2026-08-05',
    amount: -300,
    payee: 'Vermieter',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...o,
    id: asTransactionId(`bk-${seq}`),
  } as Transaction;
}

const DATEN: QuestionData = {
  budgets: BUDGETS,
  categories: KATEGORIEN,
  transactions: [tx({ category_id: HAUPT, subcategory_id: UNTER })],
  allocationsByTransaction: new Map(),
  accounts: [],
  jetzt: new Date('2026-08-20T12:00:00Z'),
} as unknown as QuestionData;

const status = questions.find((e) => e.id === 'budget.status')!;
const rest = questions.find((e) => e.id === 'budget.rest')!;

const frage = (eintrag: typeof status, ids: string[]) =>
  eintrag.antwort({ kategorieIds: ids } as unknown as QuestionSlots, DATEN);

describe('Budget-Zuordnung über die Kategorien-Ebene', () => {
  it('sollte ein Budget der HAUPTKATEGORIE finden', () => {
    // Der Fall, der schon immer ging — als Anker, damit der Fix ihn nicht bricht.
    expect(frage(status, [HAUPT]).art).not.toBe('keine');
  });

  it('[REGRESSION] sollte ein Budget auch über die UNTERKATEGORIE finden', () => {
    // Der Nutzerfund: „wohnung" löst über das Stichwort der Unterkategorie
    // auf, das Budget hängt an der Hauptkategorie — vorher „kein Budget".
    const antwort = frage(status, [UNTER]);
    expect(
      antwort.art,
      'Budget der Hauptkategorie wurde über die Unterkategorie nicht gefunden',
    ).not.toBe('keine');
    expect(antwort.anzahl).toBe(1);
  });

  it('[REGRESSION] sollte auch den REST über die Unterkategorie rechnen', () => {
    const antwort = frage(rest, [UNTER]);
    expect(antwort.art).not.toBe('keine');
    // 900 Limit, 300 verbraucht.
    expect(antwort.wert).toBeCloseTo(600, 2);
  });

  it('sollte eine Kategorie OHNE Budget weiterhin ehrlich absagen', () => {
    // Der Fix darf nicht dazu führen, dass irgendein Budget passt: Eine
    // Kategorie ohne Budget muss weiterhin „keines" melden, sonst wäre aus
    // der falschen Absage eine falsche Zahl geworden.
    expect(frage(status, ['cat-urlaub']).art).toBe('keine');
  });
});

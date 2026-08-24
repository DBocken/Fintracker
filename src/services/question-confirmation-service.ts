/**
 * Ablage der bestätigten Frage-Zuordnungen (WP-F.5).
 *
 * Schreibpfad ausschliesslich über `mutateLocalFinanceList` — zwischen Lesen
 * und Schreiben liegt ein echtes `await`, und ohne Lock verlöre der zweite
 * von zwei schnellen Klicks seine Bestätigung (Issue #293,
 * `check:store-serialization`).
 */
import {
  MAX_QUESTION_CONFIRMATIONS,
  type QuestionConfirmation,
} from '@/lib/question-confirmation-types';
import {
  mutateLocalFinanceList,
  readLocalFinanceList,
  writeLocalFinanceList,
} from './local-finance-store';

export async function getQuestionConfirmations(): Promise<QuestionConfirmation[]> {
  return readLocalFinanceList<QuestionConfirmation>('questionConfirmations');
}

export async function addQuestionConfirmation(
  text: string,
  entryId: string,
): Promise<void> {
  const bereinigt = text.trim();
  if (!bereinigt) return;

  await mutateLocalFinanceList<QuestionConfirmation>('questionConfirmations', (items) => {
    // Dieselbe Frage erneut bestätigt: Die alte Zeile weicht der neuen —
    // auch dann, wenn der Nutzer diesmal eine ANDERE Familie gewählt hat.
    // Zwei widersprüchliche Labels für denselben Wortlaut wären Trainings-
    // rauschen; es gilt die jüngste Entscheidung.
    const ohneDuplikat = items.filter((i) => i.text !== bereinigt);
    const next = [
      ...ohneDuplikat,
      {
        id: crypto.randomUUID(),
        text: bereinigt,
        entry_id: entryId,
        created_at: new Date().toISOString(),
      },
    ];
    // FIFO-Kappung: die ältesten fallen zuerst.
    return next.slice(Math.max(0, next.length - MAX_QUESTION_CONFIRMATIONS));
  });
}

/** Löscht ALLE Bestätigungen — der Löschpfad der Einstellungen. */
export async function clearQuestionConfirmations(): Promise<void> {
  await writeLocalFinanceList('questionConfirmations', []);
}

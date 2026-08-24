import { beforeEach, describe, expect, it } from 'vitest';
import {
  addQuestionConfirmation,
  clearQuestionConfirmations,
  getQuestionConfirmations,
} from '../question-confirmation-service';
import { MAX_QUESTION_CONFIRMATIONS } from '@/lib/question-confirmation-types';
import { ENCRYPTED_STORAGE_KEYS, LOCAL_FINANCE_KEYS } from '../local-storage-keys';

describe('question-confirmation-service', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearQuestionConfirmations();
  });

  it('sollte eine Bestätigung ablegen und wieder lesen', async () => {
    await addQuestionConfirmation('was ging für essen drauf', 'ausgaben.kategorie');
    const alle = await getQuestionConfirmations();
    expect(alle).toHaveLength(1);
    expect(alle[0]).toMatchObject({ text: 'was ging für essen drauf', entry_id: 'ausgaben.kategorie' });
  });

  it('sollte bei erneuter Bestätigung derselben Frage die JÜNGSTE Entscheidung behalten', () => {
    // Zwei widersprüchliche Labels für denselben Wortlaut wären
    // Trainingsrauschen — es gilt, was der Nutzer zuletzt gewählt hat.
    return addQuestionConfirmation('meine frage', 'a')
      .then(() => addQuestionConfirmation('meine frage', 'b'))
      .then(getQuestionConfirmations)
      .then((alle) => {
        expect(alle).toHaveLength(1);
        expect(alle[0].entry_id).toBe('b');
      });
  });

  it('sollte bei der Obergrenze die ältesten Bestätigungen abwerfen (FIFO)', async () => {
    for (let i = 0; i < MAX_QUESTION_CONFIRMATIONS + 3; i += 1) {
      await addQuestionConfirmation(`frage nummer ${i}`, 'ausgaben.gesamt');
    }
    const alle = await getQuestionConfirmations();
    expect(alle).toHaveLength(MAX_QUESTION_CONFIRMATIONS);
    expect(alle[0].text).toBe('frage nummer 3');
  });

  it('sollte leere Eingaben still übergehen', async () => {
    await addQuestionConfirmation('   ', 'a');
    expect(await getQuestionConfirmations()).toHaveLength(0);
  });

  it('[PRIVACY] sollte in der Verschlüsselungs-Migrationsmenge liegen', () => {
    // Die Texte SIND getippte Fragen mit Händlernamen. Der Schutz hängt daran,
    // dass der Key in ENCRYPTED_STORAGE_KEYS steht — sonst läge ausgerechnet
    // die freieste Texteingabe der App als Klartext neben dem Vault.
    expect(ENCRYPTED_STORAGE_KEYS).toContain(LOCAL_FINANCE_KEYS.questionConfirmations);
  });
});

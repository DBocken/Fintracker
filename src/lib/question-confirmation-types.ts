/**
 * Persistierte Form einer bestätigten Frage-Zuordnung (WP-F.5) — der Nutzer
 * hat auf eine Auswahl-Rückfrage einen Kandidaten angeklickt und damit das
 * Paar (Frage → Familie) gelabelt. Fliesst als hochgewichtetes Beispiel in
 * die Router-Stufe 2 (`question-intent-model.ts`); dieselbe Bauform wie die
 * Händlerregeln im Kategorienmodell: Lernen aus den EIGENEN Bestätigungen.
 *
 * Form persistierter Daten ⇒ `src/lib/` (AGENTS.md §3) — der Service
 * speichert sie, besitzt sie aber nicht.
 */
export interface QuestionConfirmation {
  id: string;
  /** Die getippte Frage im Wortlaut — kann Händlernamen enthalten, liegt deshalb verschlüsselt. */
  text: string;
  /** Eintrags-ID der gewählten Familie. */
  entry_id: string;
  created_at: string;
}

/**
 * Obergrenze der Ablage. FIFO: Die älteste Bestätigung fällt heraus — nach
 * 500 Fragen trägt sie ohnehin kaum noch Gewicht gegenüber den neueren.
 */
export const MAX_QUESTION_CONFIRMATIONS = 500;

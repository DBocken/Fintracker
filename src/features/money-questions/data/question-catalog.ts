/**
 * Kompositionswurzel des Abfrage-Registers (WP-C).
 *
 * Enthält **keine einzige Fachfrage** — nur das Einsammeln. Die Einträge
 * liegen neben ihrem Feature in `features/<slice>/domain/questions.ts`.
 *
 * `import.meta.glob` statt einer Handliste, weil eine Handliste genau die
 * Sache ist, die beim Hinzufügen eines Eintrags vergessen wird — und das
 * Vergessen wäre stumm: Die Frage würde schlicht nie beantwortet, ohne dass
 * irgendetwas rot wird. Dieselbe Klasse von Fehler wie der doppelte
 * i18n-Namespace (AGENTS.md §6).
 *
 * Diese Datei liegt in der `data`-Schicht der Chat-Slice und darf deshalb
 * quer auf die `domain` anderer Slices zugreifen; die Einträge selbst zeigen
 * nur nach unten (`src/lib/`, `features/shared/domain/`).
 */
import type { QuestionEntry } from '@/features/shared/domain/question-registry';
import { createQuestionRegistry } from '@/features/shared/domain/question-registry';

interface QuestionModule {
  questions?: readonly QuestionEntry[];
}

const module = import.meta.glob<QuestionModule>('/src/features/*/domain/questions.ts', {
  eager: true,
});

/**
 * Reihenfolge stabil halten: `import.meta.glob` liefert die Schlüssel zwar
 * sortiert, aber darauf verlässt sich hier niemand — `createQuestionRegistry`
 * sortiert selbst nach ID. Ein Register, dessen Reihenfolge vom Bundler
 * abhinge, wäre in Tests nicht reproduzierbar.
 */
export const questionCatalog = createQuestionRegistry(
  Object.values(module).flatMap((m) => [...(m.questions ?? [])]),
);

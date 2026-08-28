import { useMoneyQuestions } from '@/features/money-questions/application/use-money-questions';
import { MoneyQuestionsPane } from '@/features/money-questions/presentation/MoneyQuestionsPane';

/**
 * Dünner Routen-Einstieg für `/fragen` (AGENTS.md §3).
 *
 * Eigene Route und nicht Teil von `/coach`: Die Zustandsmatrix wird je Fläche
 * geführt (`check:state-coverage`), und ein Chat innerhalb des Coaches machte
 * die Frage „welcher Leerzustand ist gemeint" unbeantwortbar.
 *
 * Bewusst NICHT „Frag dein Geld" — den Namen trägt bereits
 * `AskYourMoney.tsx` (Monte-Carlo-Leistbarkeit). Zwei Flächen mit einem Namen
 * sind genau die Mehrdeutigkeit, die AGENTS.md beseitigen will.
 */
export default function MoneyQuestionsPage() {
  const model = useMoneyQuestions();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <MoneyQuestionsPane model={model} />
    </div>
  );
}

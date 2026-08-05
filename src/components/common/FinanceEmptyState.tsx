import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FlaskConical, Target, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/useI18n";
import EmptyState from "@/components/common/EmptyState";
import { loadDemoData } from "@/services/demo-data-service";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type FinanceEmptyStateVariant = 'no-data' | 'no-budgets' | 'no-goals' | 'no-transactions';

type FinanceEmptyStateProps = {
  variant?: FinanceEmptyStateVariant;
  animated?: boolean;
};

/**
 * Leerer Zustand der Hauptseiten (Issue #39, WP-3.3): nie eine leere Seite —
 * immer eine konkrete nächste Aktion. Variants passen Text und Aktion an
 * den Kontext an. Hintergrund-Layer verleiht dem leeren Raum visuelle Präsenz.
 */
export default function FinanceEmptyState({ variant = 'no-data', animated = false }: FinanceEmptyStateProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  const handleLoadDemo = async () => {
    setLoading(true);
    try {
      await loadDemoData();
      await queryClient.invalidateQueries();
    } finally {
      setLoading(false);
    }
  };

  const variantConfig = {
    'no-data': {
      emoji: '📊',
      title: t("financeEmptyState.title"),
      description: t("financeEmptyState.description"),
      action: (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/csv">
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("financeEmptyState.csvImportButton")}
            </Link>
          </Button>
          <Button variant="outline" onClick={handleLoadDemo} disabled={loading}>
            <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
            {loading ? t("financeEmptyState.loadingLabel") : t("financeEmptyState.sampleDataButton")}
          </Button>
        </div>
      ),
    },
    'no-budgets': {
      emoji: '💰',
      title: t("financeEmptyState.noBudgetsTitle"),
      description: t("financeEmptyState.noBudgetsDescription"),
      action: (
        <Button asChild>
          <Link to="/budgets">
            <Target className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("financeEmptyState.createBudgetButton")}
          </Link>
        </Button>
      ),
    },
    'no-goals': {
      emoji: '🎯',
      title: t("financeEmptyState.noGoalsTitle"),
      description: t("financeEmptyState.noGoalsDescription"),
      action: (
        <Button asChild>
          <Link to="/milestones">
            <Target className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("financeEmptyState.createGoalButton")}
          </Link>
        </Button>
      ),
    },
    'no-transactions': {
      emoji: '🧾',
      title: t("financeEmptyState.noTransactionsTitle"),
      description: t("financeEmptyState.noTransactionsDescription"),
      action: (
        <Button asChild>
          <Link to="/csv">
            <Receipt className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("financeEmptyState.csvImportButton")}
          </Link>
        </Button>
      ),
    },
  };

  const config = variantConfig[variant];
  const bgAnimated = animated && !reduce;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* WP-3.3: Hintergrund-Layer für visuelle Präsenz im leeren Zustand. */}
      <div
        data-testid="empty-state-bg"
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-brand/5 via-premium/5 to-transparent"
        style={bgAnimated ? { animation: 'float-breathe 6s ease-in-out infinite' } : undefined}
      />
      <div className="relative">
        <EmptyState
          emoji={config.emoji}
          title={config.title}
          description={config.description}
          action={config.action}
          animated={animated}
        />
      </div>
    </div>
  );
}

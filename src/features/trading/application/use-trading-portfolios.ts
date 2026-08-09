/**
 * ViewModel der Depotverwaltung (Tab „Portfolios verwalten").
 *
 * Herausgelöst aus `components/trading/PortfolioManager.tsx` (WP 6.3). Der
 * Baustein war die letzte Trading-Fläche mit einer eigenen LESENDEN Abfrage;
 * solange die dort stand, liess er sich nicht in die Slice ziehen, ohne vier
 * Datenzugriffe an `pnpm check:view-data` vorbeizutragen — die Zahl wäre
 * gesunken, ohne dass sich etwas verbessert hätte.
 *
 * Die Liste und die drei Schreibvorgänge (anlegen, aktivieren, löschen) liegen
 * jetzt hier; die Darstellung bekommt sie als Modell. Der Query-Key
 * `['portfolios']` bleibt byte-identisch — `use-trading-portfolio.ts`
 * invalidiert ihn nach einem eToro-Anschluss (Kochrezept Schritt 4).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useI18n } from '@/i18n/useI18n';
import type { Portfolio } from '@/types';
import {
  createPortfolio,
  deletePortfolio,
  getPortfolios,
  setActivePortfolio,
} from '@/services/portfolio-service';

export interface NewPortfolioInput {
  name: string;
  currency: string;
}

export interface TradingPortfoliosModel {
  portfolios: Portfolio[] | undefined;
  isLoading: boolean;
  /** Lesefehler der Depotliste — die Fläche benennt ihn, statt „keine Depots" zu behaupten. */
  hasLoadError: boolean;
  retry: () => void;
  createPortfolio: (input: NewPortfolioInput) => void;
  activatePortfolio: (portfolio: Portfolio) => void;
  deletePortfolio: (id: string) => void;
  isActivating: boolean;
}

export interface TradingPortfoliosOptions {
  /** Ein Depot wurde aktiviert oder neu angelegt — die Fläche darüber zieht nach. */
  onPortfolioChange?: (portfolio: Portfolio) => void;
  /**
   * Anlegen war erfolgreich. Getrennt von `onPortfolioChange`, weil daran der
   * DIALOG-Zustand hängt: Er lebt laut Kochrezept in der Darstellung, nicht im
   * ViewModel — das ViewModel meldet nur, dass es etwas zu schliessen gibt.
   */
  onCreated?: () => void;
}

export function useTradingPortfolios({
  onPortfolioChange,
  onCreated,
}: TradingPortfoliosOptions = {}): TradingPortfoliosModel {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const {
    data: portfolios,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['portfolios'],
    queryFn: getPortfolios,
  });

  const invalidatePortfolios = () => {
    queryClient.invalidateQueries({ queryKey: ['portfolios'] });
  };

  const deleteMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => {
      invalidatePortfolios();
      toast.success(t('trading.portfolioManager.messages.deleteSuccess'));
    },
    onError: (error: Error) => {
      toast.error(t('trading.portfolioManager.messages.errorDelete').replace('{error}', error.message));
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: setActivePortfolio,
    onSuccess: () => {
      invalidatePortfolios();
      toast.success(t('trading.portfolioManager.messages.activateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(t('trading.portfolioManager.messages.errorActivate').replace('{error}', error.message));
    },
  });

  const createMutation = useMutation({
    mutationFn: createPortfolio,
    onSuccess: (portfolio) => {
      invalidatePortfolios();
      onCreated?.();
      toast.success(t('trading.portfolioManager.messages.success'));
      onPortfolioChange?.(portfolio);
    },
    onError: (error: Error) => {
      toast.error(t('trading.portfolioManager.messages.errorCreate').replace('{error}', error.message));
    },
  });

  return {
    portfolios,
    isLoading,
    hasLoadError: isError,
    retry: () => {
      void refetch();
    },
    createPortfolio: ({ name, currency }) =>
      createMutation.mutate({ name, type: 'manual', currency, is_active: false }),
    activatePortfolio: (portfolio) => {
      setActiveMutation.mutate(portfolio.id);
      onPortfolioChange?.(portfolio);
    },
    deletePortfolio: (id) => deleteMutation.mutate(id),
    isActivating: setActiveMutation.isPending,
  };
}

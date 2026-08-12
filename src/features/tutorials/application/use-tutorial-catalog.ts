import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getUserSettings } from '@/services/user-settings-service';
import { collectDataReadiness } from '@/services/data-readiness-service';
import { useTier } from '@/hooks/useTier';
import {
  buildTutorialCatalog,
  nextChapterOfSection,
  type TutorialCatalog,
  type TutorialCatalogSection,
} from '@/lib/tutorial-catalog';
import type { TutorialChapterId } from '@/lib/tutorial-sequence';

/**
 * Das ViewModel der Tutorial-Übersicht: Einstellungen + Datenreife → Katalog.
 *
 * Dieselben Query-Schlüssel wie `useTutorialRun` (`userSettings`,
 * `dataReadiness`) — bewusst, nicht zufällig: Der Lauf macht beim Abschluss
 * eines Kapitels `invalidateQueries(['userSettings'])`, und genau dadurch
 * bekommt die Übersicht ihren grünen Haken, ohne dass irgendjemand die beiden
 * Flächen miteinander verdrahten müsste. Eigene Schlüssel wären eine zweite
 * Kopie desselben Zustands, die auseinanderläuft.
 *
 * Liegt in `application/`, nicht in der Darstellung: Eine zweite Präsentation
 * (mobil, Android) soll dieselbe Datenbeschaffung benutzen, statt sie ein
 * zweites Mal zu schreiben (AGENTS.md §3/§4).
 */
export interface TutorialCatalogView {
  catalog: TutorialCatalog | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  /** Das Kapitel, mit dem die gerade geöffnete Fläche weitergeht. */
  chapterForRoute: (pathname: string) => TutorialChapterId | null;
  sectionForRoute: (pathname: string) => TutorialCatalogSection | null;
}

export function useTutorialCatalog(): TutorialCatalogView {
  const tier = useTier();

  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const {
    data: readiness,
    isLoading: readinessLoading,
    isError: readinessError,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ['dataReadiness', tier],
    queryFn: () => collectDataReadiness(tier === 'premium'),
  });

  const catalog = useMemo(() => {
    if (!readiness) return null;
    return buildTutorialCatalog({
      enabledFeatures: settings?.enabled_nav_features ?? null,
      lifeSituation: settings?.onboarding_life_situation ?? null,
      readiness,
      completed: settings?.tutorial_completed_chapters ?? [],
      subcategoriesEnabled: settings?.enable_subcategories ?? true,
    });
  }, [readiness, settings]);

  const sectionForRoute = (pathname: string): TutorialCatalogSection | null =>
    catalog?.sections.find((s) => s.route === pathname || pathname.startsWith(`${s.route}/`)) ?? null;

  return {
    catalog,
    isLoading: settingsLoading || readinessLoading,
    isError: settingsError || readinessError,
    retry: () => {
      void refetchSettings();
      void refetchReadiness();
    },
    sectionForRoute,
    chapterForRoute: (pathname) => {
      const section = sectionForRoute(pathname);
      return section ? nextChapterOfSection(section) : null;
    },
  };
}

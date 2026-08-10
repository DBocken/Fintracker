/**
 * Bankenliste und Freigabe-Anfrage der GoCardless-Anbindung (WP 6.5a).
 *
 * `components/GoCardlessConnect.tsx` rief den Dienst bis hierher selbst auf —
 * Laden im `useEffect`, Fehlerbehandlung im Formular, Rangfolge in einem
 * zweiten `useEffect`. Der Netzzugriff liegt jetzt hier, die Rangfolge als
 * reine Funktion in `domain/institution-search.ts`. Die Flaeche behaelt, was
 * ihr gehoert: Suchtext, Auswahl, Dropdown.
 *
 * Bewusst KEIN `useQuery`: Der Ablauf ist unveraendert uebernommen (Laden beim
 * Montieren, ausdruecklicher Neuversuch), damit dieser Umzug das Verhalten
 * nicht nebenbei aendert. Eine Umstellung auf React Query waere eine eigene,
 * begruendete Entscheidung — sie aendert Cache-Dauer und Neuladeverhalten.
 */

import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/i18n/useI18n';
import { gocardlessService } from '@/services/gocardless-service';

import { sortInstitutionsByName, type Institution } from '../domain/institution-search';

/** Sonderwert statt einer Meldung: Die Flaeche zeigt dafuer eine Einrichtungs-Anleitung. */
export const API_SETUP_REQUIRED = 'API_SETUP_REQUIRED';

/** Antwort auf eine Freigabe-Anfrage, soweit die Flaeche sie braucht. */
export interface BankRequisition {
  id: string;
  link?: string;
  redirect?: string;
}

export interface BankInstitutionsModel {
  /** Alle Institute, alphabetisch. */
  institutions: Institution[];
  isLoading: boolean;
  /** `API_SETUP_REQUIRED` oder eine bereits uebersetzte Meldung. */
  loadError: string | null;
  reload: () => void;
  createRequisition: (institutionId: string, redirectUrl: string) => Promise<BankRequisition>;
}

export function useBankInstitutions(): BankInstitutionsModel {
  const { t } = useI18n();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // `useCallback` mit `t` in den Abhaengigkeiten: Seit die Fehlermeldung
  // uebersetzt wird, haengt diese Funktion an der Sprache. Ohne das wuerde der
  // Effekt unten eine veraltete Fassung festhalten.
  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const data = await gocardlessService.getInstitutions('DE');
      setInstitutions(sortInstitutionsByName(data));
    } catch (err: unknown) {
      const error = err as { message?: string; setup_required?: boolean; details?: string };
      console.error('[gocardless-connect] Failed to load institutions:', { message: error.message });

      if (error.setup_required || error.details?.includes('nicht konfiguriert')) {
        setLoadError(API_SETUP_REQUIRED);
      } else {
        setLoadError(t('common.errorWithMessage').replace('{message}', error.message ?? ''));
      }
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    setInstitutions([]);
    void load();
  }, [load]);

  const createRequisition = useCallback(
    (institutionId: string, redirectUrl: string) =>
      gocardlessService.createRequisition(institutionId, redirectUrl),
    [],
  );

  return { institutions, isLoading, loadError, reload, createRequisition };
}

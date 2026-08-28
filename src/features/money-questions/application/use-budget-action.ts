/**
 * Ausführung einer Budget-Aktion aus dem Chat (WP-I) — die EINZIGE
 * schreibende Stelle des Chats, und sie schreibt nur auf ausdrücklichen
 * Klick.
 *
 * Die Trennung ist das Versprechen des Pakets: Grammatik
 * (`budget-action-intent.ts`) und Vorschau (Registereintrag `budget.aktion`)
 * sind rein; erst `bestaetigen()` ruft `saveBudget`/`deleteBudget`. Vorher
 * wird der Ist-Zustand als Schnappschuss festgehalten, damit `rueckgaengig()`
 * ihn Stück für Stück zurückholen kann — angelegt ⇒ löschen, geändert ⇒
 * altes Limit zurückschreiben, gelöscht ⇒ Budget wiederherstellen.
 *
 * Bewusst KEIN allgemeines Undo-System: Es gilt für die zuletzt bestätigte
 * Chat-Aktion dieser Sitzung. Klein und nachvollziehbar schlägt allgemein
 * und ungeprüft.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBudget, saveBudget } from '@/services/budget-service';
import type { Budget } from '@/lib/budget-types';
import type { BudgetAktionsVorschlag } from '@/lib/question-registry';

export type BudgetAktionsStand =
  | { art: 'offen' }
  | { art: 'erledigt'; vorschlag: BudgetAktionsVorschlag }
  | { art: 'zurueckgenommen' };

export interface BudgetActionModel {
  stand: BudgetAktionsStand;
  bestaetigen: (vorschlag: BudgetAktionsVorschlag) => void;
  rueckgaengig: () => void;
  istAmSchreiben: boolean;
  istFehler: boolean;
}

/** Was vor der Aktion galt — die Grundlage des Rückgängig-Machens. */
type Schnappschuss =
  | { art: 'angelegt'; budgetId: string }
  | { art: 'ersetzt'; vorher: Budget }
  | { art: 'geloescht'; vorher: Budget };

export function useBudgetAction(budgets: readonly Budget[]): BudgetActionModel {
  const queryClient = useQueryClient();
  const [stand, setStand] = useState<BudgetAktionsStand>({ art: 'offen' });
  const [schnappschuss, setSchnappschuss] = useState<Schnappschuss | null>(null);

  // Beide Schlüssel: Die Budget-Fläche liest die Übersicht, andere Flächen
  // die rohe Liste — nach einer Chat-Aktion muss beides frisch sein.
  const invalidieren = () => {
    void queryClient.invalidateQueries({ queryKey: ['budget-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  const ausfuehren = useMutation({
    mutationFn: async (vorschlag: BudgetAktionsVorschlag) => {
      const bestehend = vorschlag.budgetId
        ? budgets.find((b) => b.id === vorschlag.budgetId)
        : undefined;

      if (vorschlag.art === 'loeschen') {
        if (!bestehend) throw new Error('budget-action: missing budget for delete');
        await deleteBudget(bestehend.id);
        return { art: 'geloescht', vorher: bestehend } as Schnappschuss;
      }

      if (vorschlag.art === 'aendern') {
        if (!bestehend) throw new Error('budget-action: missing budget for update');
        await saveBudget({ ...bestehend, limit: vorschlag.nachher });
        return { art: 'ersetzt', vorher: bestehend } as Schnappschuss;
      }

      const angelegt = await saveBudget({
        name: vorschlag.name,
        category_id: vorschlag.kategorieId,
        limit: vorschlag.nachher,
      });
      return { art: 'angelegt', budgetId: angelegt.id } as Schnappschuss;
    },
    onSuccess: (neuerSchnappschuss, vorschlag) => {
      setSchnappschuss(neuerSchnappschuss);
      setStand({ art: 'erledigt', vorschlag });
      invalidieren();
    },
  });

  const zuruecknehmen = useMutation({
    mutationFn: async () => {
      if (!schnappschuss) return;
      if (schnappschuss.art === 'angelegt') {
        await deleteBudget(schnappschuss.budgetId);
        return;
      }
      // Geändert wie gelöscht: Der alte Stand wird ZURÜCKGESCHRIEBEN —
      // `saveBudget` ist ein Upsert, legt also auch das gelöschte Budget mit
      // seiner alten ID wieder an.
      await saveBudget(schnappschuss.vorher);
    },
    onSuccess: () => {
      setSchnappschuss(null);
      setStand({ art: 'zurueckgenommen' });
      invalidieren();
    },
  });

  return {
    stand,
    bestaetigen: (vorschlag) => ausfuehren.mutate(vorschlag),
    rueckgaengig: () => zuruecknehmen.mutate(),
    istAmSchreiben: ausfuehren.isPending || zuruecknehmen.isPending,
    istFehler: ausfuehren.isError || zuruecknehmen.isError,
  };
}

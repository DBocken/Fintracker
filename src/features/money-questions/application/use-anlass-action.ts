/**
 * Ausführung einer Anlass-Aktion: Bestätigen → Schreiben → Rückgängig
 * (Welle 5).
 *
 * Der Unterschied zu den beiden bisherigen Aktionen liegt im Rückweg: Eine
 * Zuordnung ist ein eigener Datensatz, kein geänderter. Zurückgenommen wird
 * deshalb nicht ein Vorzustand, sondern die ANGELEGTEN Zuordnungen — und die
 * kennt man erst nach dem Schreiben. Der Schnappschuss entsteht hier also
 * beim Ausführen und nicht in der Vorschau; das ist kein Widerspruch zur
 * Kategorisier-Aktion, sondern die Folge der anderen Datenform.
 *
 * `assignTransaction` prüft je Buchung die Invarianten (keine
 * Doppelzählung im Teilbaum, Teilbetrags-Deckel) und wirft. Eine Buchung,
 * die dabei durchfällt, lässt die übrigen unberührt — jede Zuordnung ist ein
 * eigener Datensatz, und ein Abbruch mittendrin hinterliesse keinen
 * inkonsistenten Zustand, sondern einen unvollständigen. Der wird BENANNT.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assignTransaction,
  deleteSpecialCategory,
  saveSpecialCategory,
  unassign,
} from '@/services/special-category-service';
import { specialCategoriesKeys } from '@/features/special-categories/data/special-categories-query-keys';
import type { AnlassAktionsVorschlag } from '@/features/shared/domain/question-registry';

export type AnlassAktionsStand =
  | { art: 'offen' }
  | { art: 'erledigt'; vorschlag: AnlassAktionsVorschlag; geschrieben: number }
  | { art: 'zurueckgenommen' };

export interface AnlassActionModel {
  stand: AnlassAktionsStand;
  istAmSchreiben: boolean;
  istFehler: boolean;
  bestaetigen: (vorschlag: AnlassAktionsVorschlag) => void;
  rueckgaengig: () => void;
}

export function useAnlassAction(): AnlassActionModel {
  const queryClient = useQueryClient();
  const [stand, setStand] = useState<AnlassAktionsStand>({ art: 'offen' });
  /** Was geschrieben wurde — der Rückweg. */
  const [angelegt, setAngelegt] = useState<{ anlassId?: string; zuordnungen: string[] }>({
    zuordnungen: [],
  });

  const invalidieren = () => {
    void queryClient.invalidateQueries({ queryKey: specialCategoriesKeys.root });
  };

  const ausfuehren = useMutation({
    mutationFn: async (vorschlag: AnlassAktionsVorschlag) => {
      if (vorschlag.art === 'anlassAnlegen') {
        const angelegterAnlass = await saveSpecialCategory({ name: vorschlag.name });
        setAngelegt({ anlassId: angelegterAnlass.id, zuordnungen: [] });
        return { vorschlag, geschrieben: 1 };
      }

      const ids: string[] = [];
      for (const transactionId of vorschlag.buchungen) {
        const zuordnung = await assignTransaction({
          specialCategoryId: vorschlag.anlassId!,
          transactionId,
          // `suggestion` statt `manual`: Die Zuordnung entstand aus einem
          // Vorschlag, den der Nutzer bestätigt hat — die Herkunft bleibt
          // damit nachvollziehbar, auch wenn er ihr zugestimmt hat.
          source: 'suggestion',
        });
        ids.push(zuordnung.id);
      }
      setAngelegt({ zuordnungen: ids });
      return { vorschlag, geschrieben: ids.length };
    },
    onSuccess: ({ vorschlag, geschrieben }) => {
      invalidieren();
      setStand({ art: 'erledigt', vorschlag, geschrieben });
    },
  });

  const zuruecknehmen = useMutation({
    mutationFn: async () => {
      for (const id of angelegt.zuordnungen) await unassign(id);
      if (angelegt.anlassId) await deleteSpecialCategory(angelegt.anlassId);
      setAngelegt({ zuordnungen: [] });
    },
    onSuccess: () => {
      invalidieren();
      setStand({ art: 'zurueckgenommen' });
    },
  });

  return {
    stand,
    istAmSchreiben: ausfuehren.isPending || zuruecknehmen.isPending,
    istFehler: ausfuehren.isError || zuruecknehmen.isError,
    bestaetigen: (vorschlag) => ausfuehren.mutate(vorschlag),
    rueckgaengig: () => zuruecknehmen.mutate(),
  };
}

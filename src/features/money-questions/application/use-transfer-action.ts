/**
 * Ausführung einer Übertrags-Markierung: Bestätigen → Schreiben →
 * Rückgängig (Welle 5).
 *
 * Die folgenreichste der drei Aktionen — und die einzige, deren Rückgängig
 * VOLLSTÄNDIG sein muss: Ein halb aufgehobener Übertrag hinterliesse eine
 * Buchung, die als Übertrag zählt, und eine, die es nicht tut. Beide Summen
 * wären dann falsch, und zwar in verschiedene Richtungen.
 *
 * `markTransferPair` schreibt beide Seiten; `unmarkTransfer` hebt eine Seite
 * samt Gegenbuchung auf. Der Rückweg braucht deshalb nur eine Seite je Paar.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllTransactions, markTransferPair, unmarkTransfer } from '@/services/transaction-service';
import type { TransferAktionsVorschlag } from '@/features/shared/domain/question-registry';

export type TransferAktionsStand =
  | { art: 'offen' }
  | { art: 'erledigt'; vorschlag: TransferAktionsVorschlag }
  | { art: 'zurueckgenommen' };

export interface TransferActionModel {
  stand: TransferAktionsStand;
  istAmSchreiben: boolean;
  istFehler: boolean;
  bestaetigen: (vorschlag: TransferAktionsVorschlag) => void;
  rueckgaengig: () => void;
}

export function useTransferAction(): TransferActionModel {
  const queryClient = useQueryClient();
  const [stand, setStand] = useState<TransferAktionsStand>({ art: 'offen' });

  const invalidieren = () => {
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const ausfuehren = useMutation({
    mutationFn: async (vorschlag: TransferAktionsVorschlag) => {
      for (const paar of vorschlag.paare) {
        await markTransferPair(paar.ausId, paar.einId);
      }
      return vorschlag;
    },
    onSuccess: (vorschlag) => {
      invalidieren();
      setStand({ art: 'erledigt', vorschlag });
    },
  });

  const zuruecknehmen = useMutation({
    mutationFn: async (vorschlag: TransferAktionsVorschlag) => {
      // `unmarkTransfer` braucht die BUCHUNG, nicht ihre ID — und sie muss
      // frisch gelesen sein: Zwischen Markieren und Zurücknehmen hat sich
      // `transfer_pair_id` geändert, und genau daran hängt die Gegenbuchung.
      const alle = await getAllTransactions();
      for (const paar of vorschlag.paare) {
        const buchung = alle.find((t) => String(t.id) === paar.ausId);
        if (buchung) await unmarkTransfer(buchung);
      }
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
    rueckgaengig: () => {
      if (stand.art === 'erledigt') zuruecknehmen.mutate(stand.vorschlag);
    },
  };
}

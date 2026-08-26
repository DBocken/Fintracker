/**
 * Ausführung einer Kategorisier-Aktion: Bestätigen → Schreiben → Rückgängig
 * (Welle 5).
 *
 * Dieselbe Zusage wie bei den Budgets (WP-I) — vor dem Klick ist NICHTS
 * geschrieben, und danach steht der Rückweg bereit. Zwei Unterschiede, die
 * aus der Sache kommen:
 *
 * 1. **Es sind viele Buchungen statt einer.** Der Schnappschuss kommt
 *    deshalb aus der VORSCHAU (`vorschlag.vorher`) und nicht aus einem
 *    zweiten Lesen: Zwischen Vorschau und Klick könnte sich der Bestand
 *    geändert haben, und dann widerspräche das Rückgängig dem, was der
 *    Nutzer bestätigt hat.
 * 2. **`merken` schaltet zusätzlich eine Automatik ein.** Das Rückgängig
 *    nimmt sie mit zurück — eine halb zurückgenommene Aktion wäre schlimmer
 *    als keine.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTransaction } from '@/services/transaction-service';
import {
  deleteMerchantRule,
  getMerchantRules,
  upsertMerchantRule,
} from '@/services/merchant-rules-service';
import type { KategorieAktionsVorschlag } from '@/lib/question-registry';

export type KategorieAktionsStand =
  | { art: 'offen' }
  | { art: 'erledigt'; vorschlag: KategorieAktionsVorschlag }
  | { art: 'zurueckgenommen' };

export interface KategorieActionModel {
  stand: KategorieAktionsStand;
  istAmSchreiben: boolean;
  istFehler: boolean;
  bestaetigen: (vorschlag: KategorieAktionsVorschlag) => void;
  rueckgaengig: () => void;
}

export function useKategorieAction(): KategorieActionModel {
  const queryClient = useQueryClient();
  const [stand, setStand] = useState<KategorieAktionsStand>({ art: 'offen' });
  const [regelId, setRegelId] = useState<string | null>(null);

  const invalidieren = () => {
    // Präfix-Invalidierung: Die Buchungsliste hängt am Limit, und die Fläche
    // kennt es hier nicht — `['transactions']` trifft jede Variante.
    void queryClient.invalidateQueries({ queryKey: ['transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['merchant-rules'] });
  };

  const ausfuehren = useMutation({
    mutationFn: async (vorschlag: KategorieAktionsVorschlag) => {
      // EIN Aufruf für alle Buchungen, nicht einer je Buchung: `updateTransaction`
      // nimmt eine Liste, und zwischen Lesen und Schreiben der lokalen
      // Collection liegt ein echtes `await` (AGENTS.md §2,
      // `check:store-serialization`). N Einzelaufrufe wären N Lese-Schreib-
      // Zyklen auf derselben Liste — genau die Sequenz, an der schon einmal
      // lautlos eine Buchung verloren ging.
      await updateTransaction(
        vorschlag.vorher.map((buchung) => ({
          id: buchung.id,
          category_id: vorschlag.kategorieId,
        })),
      );
      if (vorschlag.art === 'merken') {
        await upsertMerchantRule(vorschlag.haendler, vorschlag.kategorieId);
        // Die ID der eben angelegten Regel merken, nicht das Muster:
        // `deleteMerchantRule` adressiert über die stabile ID (§6), und ein
        // Muster kann sich mit der Normalisierung ändern.
        const regeln = await getMerchantRules();
        setRegelId(regeln.find((r) => r.merchant_pattern === vorschlag.haendler)?.id ?? null);
      }
      return vorschlag;
    },
    onSuccess: (vorschlag) => {
      invalidieren();
      setStand({ art: 'erledigt', vorschlag });
    },
  });

  const zuruecknehmen = useMutation({
    mutationFn: async (vorschlag: KategorieAktionsVorschlag) => {
      await updateTransaction(
        vorschlag.vorher.map((buchung) => ({
          id: buchung.id,
          category_id: buchung.kategorieId,
        })),
      );
      if (regelId) {
        await deleteMerchantRule(regelId);
        setRegelId(null);
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

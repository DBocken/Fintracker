/**
 * Eine Auswahl, bei der das Nichtgewählte zerfällt.
 *
 * Die wiederkehrende Bauform des Einstiegs: mehrere gleichrangige Kacheln, von
 * denen genau eine bleibt. Der Klick löst die übrigen auf (Wind nach links,
 * dann aufsteigend — `DissolveTransition`), und erst wenn die Asche verweht
 * ist, meldet die Komponente die Wahl nach oben. Dadurch sieht der Nutzer
 * seine Entscheidung, bevor die Seite wechselt.
 *
 * Die Kacheln sind ganzflächig klickbare Schaltflächen — „Karten sind
 * Aktionen" (AGENTS.md §9); ein toter Rahmen um einen inneren Knopf wäre hier
 * besonders daneben, weil die ganze Fläche die Wahl IST.
 */

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import DissolveTransition from '@/features/shared/presentation/DissolveTransition';

export interface DissolveChoiceItem {
  id: string;
  /** Zugänglicher Name der Kachel, falls der Inhalt keinen hergibt. */
  ariaLabel?: string;
  content: ReactNode;
}

export interface DissolveChoiceGridProps {
  items: readonly DissolveChoiceItem[];
  onSelect: (id: string) => void;
  className?: string;
  /** Rolle der Gruppe (z. B. `radiogroup`) samt Beschriftung. */
  ariaLabelledBy?: string;
  disabled?: boolean;
}

export default function DissolveChoiceGrid({
  items,
  onSelect,
  className,
  ariaLabelledBy,
  disabled = false,
}: DissolveChoiceGridProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  // Eine Referenz je Kachel, stabil über Re-Render: Die Auflösung muss die
  // Elemente noch messen können, nachdem die Wahl gefallen ist.
  const refs = useRef(new Map<string, { current: HTMLButtonElement | null }>());
  const refFor = (id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = { current: null };
      refs.current.set(id, ref);
    }
    return ref;
  };

  const dissolving = chosen
    ? items.filter((item) => item.id !== chosen).map((item) => refFor(item.id))
    : [];

  return (
    <>
      <div className={cn('grid gap-3', className)} aria-labelledby={ariaLabelledBy}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            // React typisiert `ref` strenger als `RefObject<T | null>`; die
            // Referenzen hier sind bewusst nullbar, weil `DissolveTransition`
            // sie messen soll, auch wenn ein Element schon fort ist.
            ref={(element) => {
              refFor(item.id).current = element;
            }}
            aria-label={item.ariaLabel}
            disabled={disabled || chosen !== null}
            onClick={() => setChosen(item.id)}
            className={cn(
              'ds-section flex min-h-[44px] w-full cursor-pointer flex-col items-start gap-1 p-4 text-left',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'hover:border-primary/40 hover:bg-accent/40',
              chosen === item.id && 'border-primary bg-primary/5 ring-1 ring-primary',
            )}
          >
            {item.content}
          </button>
        ))}
      </div>
      <DissolveTransition
        active={chosen !== null}
        targets={dissolving}
        onComplete={() => {
          if (chosen) onSelect(chosen);
        }}
      />
    </>
  );
}

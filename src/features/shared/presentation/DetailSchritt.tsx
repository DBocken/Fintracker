import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDetailParam } from "./useDetailParam";

interface DetailSchrittProps {
  /** Wert des Adressparameters, etwa `"lage"` → `?detail=lage`. */
  wert: string;
  /** Überschrift des Schritts. Pflicht — ein Sheet ohne Namen ist ein Popup. */
  titel: string;
  children: ReactNode;
}

/**
 * Der Detailschritt einer Fläche: alles Übrige, einen Schritt tiefer.
 *
 * ADR Regel 9 begrenzt, was beim Öffnen auf dem Bildschirm steht — sie
 * verlangt nicht, dass Funktion verschwindet. Regel 2 verbietet das
 * ausdrücklich. Der Schritt ist die Stelle, an der beides zusammengeht.
 *
 * **Hier DARF gescrollt werden.** „Ein Bildschirm" richtet sich an die Fläche,
 * die man beim Öffnen sieht, nicht an einen bewusst geöffneten Detail.
 *
 * **Die vier Masse sind nicht Geschmack.** `max-h-[90dvh]` statt `vh`, weil
 * die Adressleiste mobiler Browser die Sichthöhe verändert und `vh` sie
 * ignoriert. `overflow-y-auto`, weil der Inhalt sonst unerreichbar unter dem
 * Rand endet. Die untere Polsterung rechnet gegen die Gestennavigation:
 * Ohne sie liegt die letzte Zeile unter dem Wischbalken. Und `side="bottom"`,
 * weil der Daumen unten ist.
 *
 * Elf Flächen-Entwürfe haben diesen Baustein einzeln nachgebaut. Er steht
 * jetzt einmal hier.
 */
export default function DetailSchritt({ wert, titel, children }: DetailSchrittProps) {
  const { offen, setOffen } = useDetailParam(wert);

  return (
    <Sheet open={offen} onOpenChange={setOffen}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        aria-describedby={undefined}
      >
        <SheetHeader className="text-left">
          <SheetTitle>{titel}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

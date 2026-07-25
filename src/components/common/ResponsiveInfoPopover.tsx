"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ResponsiveInfoPopoverProps {
  /** Der auslösende Baustein (Icon-Button, unterstrichenes Wort, …). */
  trigger: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Zusätzliche Klassen für den Inhalts-Container. */
  contentClassName?: string;
}

/**
 * Erklär-Overlay in der jeweils plattformgerechten Form: Bottom-Sheet auf
 * schmalen Viewports, am Auslöser verankertes Popover darüber.
 *
 * Der INHALT ist auf beiden Plattformen identisch (Plattform-Prinzip §4:
 * gleiche Daten, gleiches ViewModel, progressive Verzweigung) — verzweigt wird
 * nur die Darreichungsform. Ein Bottom-Sheet auf 2560 px reißt den Blick vom
 * Wort weg, das gerade erklärt werden soll.
 */
export function ResponsiveInfoPopover({
  trigger,
  title,
  description,
  children,
  contentClassName,
}: ResponsiveInfoPopoverProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className={contentClassName ?? "mt-4 space-y-3 text-sm text-muted-foreground"}>
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <div className={contentClassName ?? "space-y-3 text-sm text-muted-foreground"}>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ResponsiveInfoPopover;

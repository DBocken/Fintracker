"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface InfoButtonProps {
  /** Titel im Sheet/Header. */
  title: string;
  /** Erklärinhalt (Text/JSX), der aus dem Hauptfluss ausgelagert wird. */
  children: ReactNode;
  /** Optionaler Kurz-Untertitel direkt unter dem Titel. */
  description?: string;
  /** Barrierefreies Label des Buttons. */
  label?: string;
  className?: string;
}

/**
 * Auslagern langer Erklärtexte (Audit C-P0/C-P3): ein dezenter Info-Button,
 * der Details in ein Bottom-Sheet (mobil) / Panel verschiebt, statt den
 * Hauptscreen mit Dauer-Erklärungen zu füllen.
 */
export default function InfoButton({
  title,
  children,
  description,
  label = "Mehr erfahren",
  className,
}: InfoButtonProps) {
  return (
    <Sheet>
      <SheetTrigger
        aria-label={label}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Info className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Trefferbereich mindestens 44 px, SOBALD mit dem Finger bedient wird
      // (AGENTS.md §4, `pnpm check:touch-targets`).
      //
      // Das ist die EINE Entscheidung, die `touch-target-budget.json` seit
      // seiner Einführung anmahnt: 186 der 217 Fundstellen sind schlicht
      // `size="sm"` oder `size="icon"` an einer Aufrufstelle — sie einzeln
      // anzufassen hiesse, 186-mal dieselbe Entscheidung zu wiederholen.
      //
      // `pointer-coarse:` und nicht pauschal: Das Mass kommt von der
      // Fingerkuppe, nicht vom Bildschirm. Mit einer Maus ist ein 36-px-Knopf
      // präzise treffbar, und die Dichte einer Werkzeugleiste ist auf dem
      // Desktop ein Vorteil — `@media (pointer: coarse)` fragt genau das ab
      // (primäres Zeigegerät ist grob). Ein Breakpoint (`sm:`) wäre die
      // falsche Frage: Er misst Breite, nicht Eingabeart, und ein schmales
      // Fenster auf dem Desktop wird nicht mit dem Daumen bedient.
      //
      // `min-h-11` = 44 px setzt einen BODEN, die optische Höhe (`h-9`/`h-10`)
      // bleibt als Ausgangswert stehen — dieselbe Bauform wie die Regel
      // „der Trefferbereich darf grösser sein als das Bild" (§9). Bei `icon`
      // gehört die Breite dazu, sonst bleibt das Ziel ein schmaler Streifen.
      size: {
        default: "h-10 px-4 py-2 pointer-coarse:min-h-11",
        sm: "h-9 rounded-md px-3 pointer-coarse:min-h-11",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 pointer-coarse:min-h-11 pointer-coarse:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
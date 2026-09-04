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
      // `fokussiert:` und nicht pauschal: In der kompakten Dichte ist ein
      // 36-px-Knopf mit der Maus präzise treffbar, und die Dichte einer
      // Werkzeugleiste ist dort ein Vorteil. Die Variante hängt am
      // `data-density`-Attribut (`src/index.css`), also an derselben EINEN
      // Entscheidung, die auch über die Präsentation entscheidet.
      //
      // Der erste Entwurf benutzte die Tailwind-Variante für grobe
      // Zeigegeräte — verworfen, und zwar nicht aus Geschmack (ihr Name steht
      // hier bewusst nicht ausgeschrieben: Tailwind liest auch Kommentare und
      // erzeugte sonst eine Regel, die niemand benutzt).
      // `docs/architecture/darstellungsdichte.md` lehnt
      // ein zweites Kriterium ausdrücklich ab, weil zwei Kriterien sich in
      // Randfällen widersprechen (Telefon mit Maus, Laptop mit Touchscreen)
      // und dann niemand mehr nachvollziehbar entscheidet. Ein Breakpoint
      // (`sm:`) wäre ebenfalls falsch: Er misst Breite, nicht Dichte.
      //
      // `min-h-11` = 44 px setzt einen BODEN, die optische Höhe (`h-9`/`h-10`)
      // bleibt als Ausgangswert stehen — dieselbe Bauform wie die Regel
      // „der Trefferbereich darf grösser sein als das Bild" (§9). Bei `icon`
      // gehört die Breite dazu, sonst bleibt das Ziel ein schmaler Streifen.
      size: {
        default: "h-10 px-4 py-2 fokussiert:min-h-11",
        sm: "h-9 rounded-md px-3 fokussiert:min-h-11",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 fokussiert:min-h-11 fokussiert:min-w-11",
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
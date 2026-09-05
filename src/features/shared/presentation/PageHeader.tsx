import type { ReactNode } from "react";
import { useSeitennameVerdeckung } from "./SeitennameContext";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Kopf einer Fläche: Name, Beschreibung, Bedienelemente.
 *
 * Der NAME steht nicht mehr zwangsläufig hier. In der fokussierten Dichte
 * rendert die Shell ihn einmal zentral im Inhalt (siehe
 * `SeitennameContext`), weil er sonst doppelt stünde — einmal abgeschnitten
 * in der App-Leiste, einmal hier. Beschreibung und Bedienelemente bleiben
 * unberührt: Sie gehören der Fläche, nicht dem Rahmen.
 *
 * Trägt die Shell den Namen nicht (Route ohne Navigationseintrag, etwa die
 * Abrechnung), bleibt diese Überschrift stehen — sonst hätte die Fläche gar
 * keinen Namen.
 */
export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  const seitennameVerdeckung = useSeitennameVerdeckung();

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {/* Die Überschrift bleibt im Baum, solange die Shell keine rendert.
            In kompakt trägt sie die Leiste ohnehin nicht als Überschrift,
            sondern als Beschriftung — dort ist dieses h1 die einzige. */}
        <h1 className={`text-xl font-semibold tracking-tight sm:text-2xl ${seitennameVerdeckung}`}>
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

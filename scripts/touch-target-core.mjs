/**
 * Kern der Tippziel-Ratsche: „Was da ist, muss man auch treffen können."
 *
 * **Warum das zu §4 gehört.** §4 verlangt Feature-Parität zwischen Desktop und
 * Mobile, und `check:platform-parity` prüft davon genau eine Form: eine Fläche,
 * die auf schmalen Breiten ganz fehlt. Der Fall daneben stand nirgends — ein
 * Bedienelement kann vorhanden UND unbedienbar sein, weil sein Trefferbereich
 * kleiner ist als eine Fingerkuppe. Eine Funktion, die man mit dem Daumen
 * nicht trifft, ist auf dem Telefon nicht vorhanden; Parität, die man nicht
 * treffen kann, ist keine.
 *
 * **Warum 44 px.** Das ist das Mindestmass, das Apple (HIG) und Google
 * (Material, dort 48 dp) seit Jahren übereinstimmend nennen; die App benutzt
 * es an 15 Stellen bereits selbst (`min-h-[44px]`). Es ist also keine neue
 * Setzung, sondern die, die hier schon gilt — nur bisher unerzwungen.
 *
 * **Warum eine Ratsche und kein Verbot.** Der Bestand ist zu gross für einen
 * Commit, und ein Wächter, der ab morgen jeden Commit blockiert, wird
 * abgeschaltet statt befolgt — dieselbe Begründung wie bei `check:view-data`.
 *
 * **Was gezählt wird: die AUSDRÜCKLICHE Verkleinerung.** Ein Bedienelement,
 * das seine Höhe selbst unter 44 px setzt (`h-8`, `size-8`, `h-[36px]`) oder
 * eine kleinere Button-Variante wählt (`size="icon"` = 40 px, `size="sm"` =
 * 36 px, beide aus `src/components/ui/button.tsx`). Dort hat jemand für diese
 * eine Stelle entschieden.
 *
 * **Zwei Spalten, weil es zwei Befunde mit zwei Antworten sind.** Nachgemessen
 * sind 170 der 217 Fundstellen schlicht `size="sm"` — die kleinere
 * shadcn-Variante an einer Schaltfläche mit Text. Sie in EINE Zahl mit den
 * vierzehn Elementen zu werfen, die jemand per Klasse auf 20–32 px gedrückt
 * hat, hätte die akuten Fälle unter dem Rauschen begraben (dieselbe Lehre wie
 * bei `slice-presentation-budget.json`, WP 6.3):
 *
 *   `max`          = per KLASSE verkleinert (`h-8`, `size-8`, `h-[36px]`).
 *                    Behebung je Stelle: `min-h-[44px] min-w-[44px]` neben die
 *                    optische Grösse setzen — das Icon bleibt klein, die
 *                    Fläche darum nicht.
 *   `maxVarianten` = die kleinere Button-VARIANTE gewählt (`sm`, `icon`).
 *                    Behebung: EINE Entscheidung in `ui/button.tsx` über die
 *                    Höhen der Varianten, danach erreicht die Zahl 0.
 *
 * Beide Zahlen dürfen nur SINKEN.
 *
 * **Was bewusst NICHT gezählt wird: der Standard.** `<Button>` ohne
 * Grössenangabe ist `h-10` und damit ebenfalls 40 px — aber das ist EINE
 * Entscheidung in `ui/button.tsx`, nicht dreihundert an den Aufrufstellen.
 * Sie hier mitzuzählen hiesse, jeden Knopf der App als Einzelbefund zu führen
 * und damit die Stellen zu verdecken, an denen wirklich jemand verkleinert
 * hat. Die offene Frage nach der Standardhöhe ist als solche in
 * `touch-target-budget.json` festgehalten — benannte Grenze, keine Lücke.
 */

/** Mindestmass eines Trefferbereichs (Apple HIG; Material nennt 48 dp). */
export const MIN_TIPPZIEL_PX = 44;

/** Tailwind-Spacing: eine Einheit sind 4 px. */
const SPACING_PX = 4;

/** Höhen der Button-Varianten aus `src/components/ui/button.tsx`. */
const VARIANTEN_PX = { default: 40, sm: 36, lg: 44, icon: 40 };

/** Elemente, die ein Finger treffen soll. */
const INTERAKTIV = ['button', 'a', 'Button', 'SelectTrigger', 'TabsTrigger', 'ToggleGroupItem'];

function ohneKommentare(quelle) {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (t) => t.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (t, vor) => vor + ' '.repeat(t.length - vor.length));
}

function zeileVon(quelle, index) {
  return quelle.slice(0, index).split('\n').length;
}

/** Grösster gesetzter Boden: `min-h-11` oder `min-h-[44px]`. */
function bodenAus(attrs) {
  let boden = 0;
  for (const t of attrs.matchAll(/\bmin-h-(?:\[(\d+)px\]|(\d+(?:\.\d+)?))/g)) {
    boden = Math.max(boden, t[1] ? Number(t[1]) : Number(t[2]) * SPACING_PX);
  }
  return boden;
}

/** Gesetzte Höhe: `h-8`, `size-8`, `h-[36px]`. `h-full`/`h-auto` sagen nichts. */
function hoeheAus(attrs) {
  const treffer = attrs.match(/\b(?:h|size)-(?:\[(\d+)px\]|(\d+(?:\.\d+)?))(?![\w.[-])/);
  if (!treffer) return null;
  return treffer[1] ? Number(treffer[1]) : Number(treffer[2]) * SPACING_PX;
}

/**
 * Findet Bedienelemente mit ausdrücklich zu kleinem Trefferbereich.
 * @returns {{ zeile: number, px: number, element: string, herkunft: 'klasse'|'variante' }[]}
 */
export function findeKleineTippziele(quelle, pfad) {
  if (!pfad.endsWith('.tsx')) return [];
  if (pfad.includes('__tests__') || pfad.includes('/test-utils/')) return [];

  const text = ohneKommentare(quelle);
  const funde = [];

  for (const element of INTERAKTIV) {
    const opener = new RegExp(`<${element}(?=[\\s/>])`, 'g');
    for (const treffer of text.matchAll(opener)) {
      const ende = text.indexOf('>', treffer.index);
      if (ende === -1) continue;
      const attrs = text.slice(treffer.index, ende);

      if (bodenAus(attrs) >= MIN_TIPPZIEL_PX) continue;

      // Eine Klasse überschreibt die Variante — deshalb zuerst die Klasse.
      let px = hoeheAus(attrs);
      let herkunft = 'klasse';
      if (px === null) {
        herkunft = 'variante';
        const variante = attrs.match(/\bsize\s*=\s*["']([a-z]+)["']/);
        if (!variante || element !== 'Button') continue;
        px = VARIANTEN_PX[variante[1]] ?? null;
      }
      if (px === null || px >= MIN_TIPPZIEL_PX) continue;

      funde.push({ zeile: zeileVon(text, treffer.index), px, element, herkunft });
    }
  }

  return funde.sort((a, b) => a.zeile - b.zeile);
}

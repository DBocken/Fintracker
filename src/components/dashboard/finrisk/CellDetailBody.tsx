import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CellDetail, CompositionLine } from '@/lib/finrisk/cell-details';
import { useI18n } from '@/i18n/useI18n';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { cn } from '@/lib/utils';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/**
 * Klartext-Erklärung, warum dieser Pfad in dieser Zelle landet: der größte
 * Treiber (Kategorie mit der stärksten Abweichung vom Median) wird benannt.
 */
function driverSentence(detail: CellDetail, t: (key: string) => string): string {
  const rep = detail.representative;
  const driver = rep?.topDriver;
  const lowBalance = detail.percentile < 50;
  if (driver && Math.abs(driver.deltaPct) >= 0.05) {
    const direction = driver.amount > driver.median ? t('finrisk.driverSentenceMore') : t('finrisk.driverSenteneceLess');
    const pct = Math.round(Math.abs(driver.deltaPct) * 100);
    const outcome = lowBalance ? t('finrisk.driverSentenceOutcomeLow') : t('finrisk.driverSentenceOutcomeHigh');
    return `${t('finrisk.driverSentence').replace('{category}', driver.category).replace('{pct}', String(pct)).replace('{direction}', direction).replace('{outcome}', outcome)}`;
  }
  return t('finrisk.driverSentenceNoDriver');
}

function getGroupLabel(t: (key: string) => string): Record<CompositionLine['group'], string> {
  return {
    income: t('finrisk.income'),
    fixed: t('finrisk.fixedCosts'),
    variable: t('finrisk.variableExpenses'),
    event: t('finrisk.plannedItems'),
  };
}

/** Balkenfarbe je Gruppe: streuende (variabel/Einnahmen) farbig, fixe neutral. */
const GROUP_FILL: Record<CompositionLine['group'], string> = {
  income: 'bg-emerald-500',
  fixed: 'bg-slate-400',
  variable: 'bg-amber-500',
  event: 'bg-slate-400',
};

const GROUP_SEQUENCE: CompositionLine['group'][] = ['income', 'fixed', 'variable', 'event'];

/**
 * Signierte €-Anzeige: Zuflüsse mit „+", Abflüsse über das Intl-Minus.
 *
 * `mask` kommt als Parameter herein und nicht aus `useMoneyFormat()`: Diese
 * Funktion liegt im Modulraum, dort ist kein Hook erlaubt (WP-9.5).
 */
function fmtSigned(amount: number, mask: (formatted: string) => string): string {
  return `${amount > 0 ? '+' : ''}${mask(eur.format(amount))}`;
}

const PAGER_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors ' +
  'hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

/**
 * Eine Posten-Zeile der Zusammensetzung: Betrag zählt hoch, Balken baut sich von
 * 0 → Ziel auf (datengetriebene Baseline). Streuende Posten (variable Ausgaben,
 * perturbierte Einnahmen) zeigen zusätzlich die ±-Abweichung vom Median aller
 * Pfade sowie – wenn die Zelle mehrere Pfade bündelt – die Zell-Spanne als Band
 * mit Ø-Markierung; fixe Posten sind neutral, weil sie in jedem Pfad gleich sind.
 */
function CompositionRow({
  line,
  scale,
  animate,
  t,
}: {
  line: CompositionLine;
  scale: number;
  animate: boolean;
  t: (key: string) => string;
}) {
  const money = useMoneyFormat();
  const magnitude = Math.abs(line.amount);
  // Mindestbreite, damit kleine Posten neben großen sichtbar bleiben.
  const targetPct = magnitude > 0 ? Math.max(3, Math.min(100, (magnitude / scale) * 100)) : 0;
  const [width, setWidth] = useState(animate ? 0 : targetPct);
  const shown = useAnimatedNumber(line.amount, { enabled: animate });

  useEffect(() => {
    if (!animate) {
      setWidth(targetPct);
      return;
    }
    const raf = requestAnimationFrame(() => setWidth(targetPct));
    return () => cancelAnimationFrame(raf);
  }, [targetPct, animate]);

  const pct = line.deltaPct != null ? Math.round(line.deltaPct * 100) : 0;
  const showBadge = line.varies && Math.abs(pct) >= 1;
  // Ungünstig: weniger Einnahmen bzw. mehr Ausgaben als der typische Pfad.
  const adverse = line.group === 'income' ? pct < 0 : pct > 0;

  // Zell-Spanne als Band in Magnituden (Balkenlänge = Magnitude des Betrags).
  const range = line.cellRange;
  const bandLoPct = range
    ? Math.min(100, (Math.min(Math.abs(range.min), Math.abs(range.max)) / scale) * 100)
    : null;
  const bandHiPct = range
    ? Math.min(100, (Math.max(Math.abs(range.min), Math.abs(range.max)) / scale) * 100)
    : null;
  const avgPct = range ? Math.min(100, (Math.abs(range.avg) / scale) * 100) : null;

  // Ohne Zell-Spanne (nur ein Pfad bekannt): Median aller Pfade als Marke.
  const medianMag = !range && line.median != null ? Math.abs(line.median) : null;
  const medianPct = medianMag != null ? Math.min(100, (medianMag / scale) * 100) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{line.name}</span>
        <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
          <span className="font-semibold">{fmtSigned(shown, money.mask)}</span>
          {showBadge && (
            <span
              className={cn(
                'rounded px-1 text-[10px] font-medium',
                adverse
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
              )}
            >
              {pct > 0 ? '+' : ''}
              {pct} %
            </span>
          )}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted">
        {bandLoPct != null && bandHiPct != null && (
          <div
            className="absolute top-0 h-full rounded-full bg-foreground/10"
            style={{ left: `${bandLoPct}%`, width: `${Math.max(0.75, bandHiPct - bandLoPct)}%` }}
          />
        )}
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full',
            GROUP_FILL[line.group],
            animate && 'transition-[width] duration-700 ease-out',
          )}
          style={{ width: `${width}%` }}
        />
        {avgPct != null && range != null && (
          <span
            className="absolute -top-0.5 h-3 w-px bg-foreground/60"
            style={{ left: `${avgPct}%` }}
            title={`Ø ${fmtSigned(range.avg, money.mask)} in dieser Zelle`}
          />
        )}
        {medianPct != null && (
          <span
            className="absolute -top-0.5 h-3 w-px bg-foreground/60"
            style={{ left: `${medianPct}%` }}
            title={line.median != null ? `Median ${fmtSigned(line.median, money.mask)}` : undefined}
          />
        )}
      </div>
      {range && (
        <div className="flex items-baseline justify-between gap-2 text-[10px] tabular-nums text-muted-foreground">
          <span>
            {t('finrisk.cellDetailComposition.rangeLabel')} {fmtSigned(range.min, money.mask)} … {fmtSigned(range.max, money.mask)}
          </span>
          <span>Ø {fmtSigned(range.avg, money.mask)}</span>
        </div>
      )}
    </div>
  );
}

interface CellDetailBodyProps {
  detail: CellDetail;
  /** Blättert zum Zell-Pfad mit diesem Index (0 = Repräsentant). */
  onSelectPath?: (index: number) => void;
}

/**
 * Inhalt des Zell-Detail-Dialogs. Eine Zelle bündelt oft mehrere Monte-Carlo-
 * Pfade („Lösungen"): der Pager blättert durch die konkreten Pfade, die
 * Treiber-Verteilung und die Spannen/Ø je Posten fassen alle Pfade der Zelle
 * zusammen. Darunter die vollständige, nach Gruppen sortierte Zusammensetzung
 * des Saldos (Einnahmen, Fixkosten, variable Ausgaben, geplante Posten).
 */
export function CellDetailBody({ detail, onSelectPath }: CellDetailBodyProps) {
  const { t } = useI18n();
  const animate = !useReducedMotion();
  const rep = detail.representative;
  if (!rep) {
    return (
      <p className="text-sm text-muted-foreground">
        {detail.pathsInCell === 0
          ? t('finrisk.noPathInCell')
          : t('finrisk.noDetailsInCell')}
      </p>
    );
  }
  if (rep.composition.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('finrisk.noLineItems')}</p>;
  }

  const GROUP_LABEL = getGroupLabel(t);

  // Skala inkl. Zell-Spannen, damit das Band nie über den Balkenbereich hinausläuft.
  const scale = Math.max(
    1,
    ...rep.composition.flatMap((c) => [
      Math.abs(c.amount),
      Math.abs(c.cellRange?.min ?? 0),
      Math.abs(c.cellRange?.max ?? 0),
    ]),
  );
  const PER_GROUP = 6;
  const shares = detail.driverShares.filter((s) => s.share >= 0.05).slice(0, 3);
  const hasRanges = rep.composition.some((c) => c.cellRange != null);

  return (
    <div className="space-y-4">
      {detail.pathCount > 1 && onSelectPath && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-1 py-0.5">
          <button
            type="button"
            aria-label={t('finrisk.cellDetailPaging.previousPath')}
            className={PAGER_BUTTON}
            disabled={detail.pathIndex === 0}
            onClick={() => onSelectPath(detail.pathIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('finrisk.cellDetailPaging.pathOfTotal')
              .replace('{current}', String(detail.pathIndex + 1))
              .replace('{total}', String(detail.pathCount))}{' '}
            {t('finrisk.inThisCell')}
            {detail.pathIndex === 0 ? ' · ' + t('finrisk.cellDetailPaging.representative') : ''}
          </span>
          <button
            type="button"
            aria-label={t('finrisk.cellDetailPaging.nextPath')}
            className={PAGER_BUTTON}
            disabled={detail.pathIndex >= detail.pathCount - 1}
            onClick={() => onSelectPath(detail.pathIndex + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm">{driverSentence(detail, t)}</p>
        {detail.pathsInCell > 1 && shares.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {t('finrisk.mainCauses')}{' '}
            {shares.map((s) => `${s.category} (${Math.round(s.share * 100)} %)`).join(', ')}
          </p>
        )}
      </div>

      {GROUP_SEQUENCE.map((group) => {
        const lines = rep.composition.filter((c) => c.group === group);
        if (lines.length === 0) return null;
        const shown = lines.slice(0, PER_GROUP);
        const rest = lines.length - shown.length;
        return (
          <section key={group} className="space-y-2.5">
            <h4 className="text-xs font-medium text-muted-foreground">{GROUP_LABEL[group]}</h4>
            {shown.map((line) => (
              <CompositionRow key={`${group}-${line.name}`} line={line} scale={scale} animate={animate} t={t} />
            ))}
            {rest > 0 && <p className="text-[11px] text-muted-foreground">+ {rest} weitere</p>}
          </section>
        );
      })}

      <p className="text-[11px] text-muted-foreground">
        {t('finrisk.cumulatedUntilDay')}{' '}
        {hasRanges
          ? t('finrisk.rangeAndAverage') + ' '
          : ''}
        {t('finrisk.fixedAndPlanned')}
      </p>
    </div>
  );
}

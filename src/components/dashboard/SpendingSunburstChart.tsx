import { useEffect, useMemo, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { CHART_BRAND } from '@/lib/chart-colors';
import { cn } from '@/lib/utils';
import type { SunburstNode, SunburstTree } from '@/lib/analysis-data';

interface Props {
  tree: SunburstTree;
  /** Klassen-ID -> Basisfarbe (gleiche Zuordnung wie die Desktop-Legende). */
  colorMap: Map<string, string>;
  showPercent: boolean;
  onNavigateCategory: (categoryId: string) => void;
  onNavigateKlasse: (superId: string) => void;
}

// SVG-Geometrie: 0° oben, im Uhrzeigersinn. viewBox ist quadratisch.
const SIZE = 200;
const CENTER = SIZE / 2;
// Radien so gewählt, dass drei Ringe + Lochmitte innerhalb der viewBox (R≤100)
// liegen: äußerster Ring endet bei R=95,5 (kleiner Rand für den Stroke).
const HOLE_RADIUS = 34;
const RING_WIDTH = 19;
const RING_GAP = 1.5;
const MAX_RINGS = 3; // sichtbare Ringe unterhalb des Fokus
const TAU = Math.PI * 2;

const formatCurrencyInt = (v: number) =>
  v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function polar(r: number, angle: number): [number, number] {
  return [CENTER + r * Math.sin(angle), CENTER - r * Math.cos(angle)];
}

/** Pfad eines Ringsegments (annulus sector); Vollkreise werden in zwei Hälften gezeichnet. */
function arcPath(r0: number, r1: number, a0: number, a1: number): string {
  const delta = a1 - a0;
  if (delta >= TAU - 1e-3) {
    const mid = a0 + Math.PI;
    return `${arcPath(r0, r1, a0, mid)} ${arcPath(r0, r1, mid, a0 + TAU)}`;
  }
  const large = delta > Math.PI ? 1 : 0;
  const [x0o, y0o] = polar(r1, a0);
  const [x1o, y1o] = polar(r1, a1);
  const [x1i, y1i] = polar(r0, a1);
  const [x0i, y0i] = polar(r0, a0);
  return [
    `M ${x0o} ${y0o}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ');
}

interface Segment {
  node: SunburstNode;
  depth: number; // 0 = direktes Kind des Fokus
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

/** Legt die sichtbaren Ringe ab dem Fokus-Knoten an (rekursiv, bis MAX_RINGS tief). */
function layout(focus: SunburstNode): Segment[] {
  const segments: Segment[] = [];
  const walk = (node: SunburstNode, depth: number, a0: number, a1: number) => {
    if (depth >= MAX_RINGS) return;
    const span = a1 - a0;
    const total = node.children.reduce((s, c) => s + c.value, 0);
    if (total <= 0) return;
    let cursor = a0;
    for (const child of node.children) {
      const childSpan = (child.value / total) * span;
      const ca0 = cursor;
      const ca1 = cursor + childSpan;
      const r0 = HOLE_RADIUS + depth * (RING_WIDTH + RING_GAP) + RING_GAP;
      segments.push({ node: child, depth, a0: ca0, a1: ca1, r0, r1: r0 + RING_WIDTH });
      walk(child, depth + 1, ca0, ca1);
      cursor = ca1;
    }
  };
  walk(focus, 0, 0, TAU);
  return segments;
}

/** Klassenfarbe, nach außen leicht aufgehellt (Tiefen-Staffelung wie beim Donut). */
function segmentFill(colorMap: Map<string, string>, klasseId: string): string {
  return colorMap.get(klasseId) || CHART_BRAND;
}
function segmentOpacity(depth: number): number {
  return [1, 0.82, 0.66][depth] ?? 0.66;
}

/**
 * Grafisches, mehrstufiges Sunburst (Klasse -> Hauptkategorie -> Unterkategorie).
 * Antippen eines Segments mit Kindern zoomt hinein; ein Blatt navigiert zu den
 * gefilterten Buchungen. Die Mitte zeigt den Fokuswert und zoomt wieder heraus.
 *
 * Animations-Baseline: die Ringe werden im Uhrzeigersinn *aufgebaut* (Sweep),
 * der Mittelwert zählt hoch. `prefers-reduced-motion` -> direkt der Zielzustand.
 */
export function SpendingSunburstChart({
  tree,
  colorMap,
  showPercent,
  onNavigateCategory,
  onNavigateKlasse,
}: Props) {
  const reduce = useReducedMotion();

  // Virtuelle Wurzel: ihre Kinder sind die Klassen (Innenring).
  const root = useMemo<SunburstNode>(
    () => ({ id: '__root', name: 'Gesamt', value: tree.total, klasseId: 'unkategorisiert', categoryId: null, children: tree.children }),
    [tree],
  );

  // Index für Zoom-zurück (Kind-ID -> Eltern-Knoten).
  const { byId, parentOf } = useMemo(() => {
    const idMap = new Map<string, SunburstNode>();
    const parents = new Map<string, SunburstNode>();
    const walk = (n: SunburstNode) => {
      idMap.set(n.id, n);
      for (const c of n.children) {
        parents.set(c.id, n);
        walk(c);
      }
    };
    walk(root);
    return { byId: idMap, parentOf: parents };
  }, [root]);

  const [focusId, setFocusId] = useState('__root');
  // Wenn sich die Daten ändern und der Fokus verschwindet -> zurück zur Wurzel.
  const focus = byId.get(focusId) ?? root;
  useEffect(() => {
    if (!byId.has(focusId)) setFocusId('__root');
  }, [byId, focusId]);

  const segments = useMemo(() => layout(focus), [focus]);

  // Sweep-Fortschritt 0..1; neu angestoßen bei Fokus-/Datenwechsel.
  const [sweep, setSweep] = useState(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      setSweep(1);
      return;
    }
    setSweep(0);
    let raf = 0;
    const start = performance.now();
    const DURATION = 650;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      // easeOutCubic
      setSweep(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focus, reduce]);

  const animatedCenter = useAnimatedNumber(focus.value, { enabled: !reduce });

  const denom = tree.total > 0 ? tree.total : focus.value;
  const centerValueLabel =
    showPercent && denom > 0
      ? `${Math.round((animatedCenter / denom) * 100)}%`
      : formatCurrencyInt(Math.round(animatedCenter));

  const isRoot = focus.id === '__root';

  const handleSegmentClick = (node: SunburstNode) => {
    if (node.children.length > 0) {
      setFocusId(node.id);
      return;
    }
    if (node.categoryId) onNavigateCategory(node.categoryId);
    else onNavigateKlasse(node.klasseId);
  };

  const zoomOut = () => {
    if (isRoot) return;
    const parent = parentOf.get(focus.id);
    setFocusId(parent ? parent.id : '__root');
  };

  const valueFor = (node: SunburstNode) =>
    showPercent && denom > 0 ? `${Math.round((node.value / denom) * 100)}%` : formatCurrencyInt(node.value);

  if (tree.total <= 0 || tree.children.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Noch keine Ausgaben erfasst.</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full max-w-[320px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label="Ausgaben-Sunburst nach Kategorie">
          {segments.map((seg) => {
            const a1 = seg.a0 + (seg.a1 - seg.a0) * sweep;
            if (a1 - seg.a0 < 1e-4) return null;
            const interactive = seg.node.children.length > 0 || Boolean(seg.node.categoryId) || seg.node.klasseId;
            return (
              <path
                key={seg.node.id}
                d={arcPath(seg.r0, seg.r1, seg.a0, a1)}
                fill={segmentFill(colorMap, seg.node.klasseId)}
                fillOpacity={segmentOpacity(seg.depth)}
                stroke="hsl(var(--background))"
                strokeWidth={0.75}
                className={cn(interactive && 'cursor-pointer outline-none focus-visible:opacity-100')}
                role="button"
                tabIndex={0}
                aria-label={`${seg.node.name}: ${valueFor(seg.node)}${seg.node.children.length > 0 ? ' — zum Reinzoomen tippen' : ''}`}
                onClick={() => handleSegmentClick(seg.node)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSegmentClick(seg.node);
                  }
                }}
              />
            );
          })}
        </svg>

        {/* Mitte: Fokus-Wert; antippbar zum Herauszoomen. */}
        <button
          type="button"
          onClick={zoomOut}
          disabled={isRoot}
          aria-label={isRoot ? 'Gesamtausgaben' : `Zurück zu ${parentOf.get(focus.id)?.name ?? 'Gesamt'}`}
          className={cn(
            'absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !isRoot && 'cursor-pointer',
          )}
          style={{ width: `${(HOLE_RADIUS * 2) / SIZE * 100}%`, height: `${(HOLE_RADIUS * 2) / SIZE * 100}%` }}
        >
          {!isRoot && <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          <span className="px-1 text-[11px] font-semibold leading-tight tabular-nums">{centerValueLabel}</span>
          <span className="max-w-full truncate px-1 text-[9px] leading-tight text-muted-foreground">
            {isRoot ? 'Gesamt' : focus.name}
          </span>
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {isRoot ? 'Tippe ein Segment zum Reinzoomen' : 'Tippe die Mitte für zurück'}
      </p>
    </div>
  );
}

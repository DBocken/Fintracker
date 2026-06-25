import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { columnModes } from '@/lib/finrisk/density';
import { densityColor, regionForValue, regionAccent } from '@/lib/finrisk/density-color';
import type { ScenarioResult } from '@/lib/finrisk/scenario-payload-types';

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

/** Kompakte €-Achsenbeschriftung (z. B. „1,2 Tsd"). */
function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k`;
  return Math.round(v).toLocaleString('de-DE');
}

/** „Schöne" Achsenwerte zwischen lo und hi (inkl. 0/Puffer-Nähe egal). */
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + 1e-6; v += step) out.push(Math.round(v));
  return out;
}

// Dunkle „Bühne" – macht die Gradienten theme-unabhängig sichtbar (wie bei Heatmaps üblich).
const STAGE_BG = '#0b1220';
const AXIS = 'rgba(226,232,240,0.65)';
const GRID = 'rgba(148,163,184,0.16)';

const PAD = { top: 10, right: 12, bottom: 22, left: 58 };

interface Props {
  result: ScenarioResult;
  safetyBuffer: number;
}

interface HoverState {
  day: number;
  x: number;
  y: number;
}

/**
 * EINE Grafik für alles: Wahrscheinlichkeits-Heatmap der Liquidität über die
 * Zeit. Zwei orthogonale Kodierungen – Wertregion (Defizit/Risiko/gesund) als
 * Farbton, Dichte als Intensität – bilden auch MULTIMODALE Verteilungen ab
 * (z. B. Basis- vs. Szenario-Cluster als zwei Rücken). Overlays: Median (P50),
 * Null-Linie, Sicherheitspuffer, kritischer Tag des gewählten Sicherheitsniveaus.
 *
 * Interaktion: Hover (Desktop) bzw. Tippen/Ziehen (Mobile) öffnet ein Popover
 * mit Tagesdetails inkl. der Verteilungs-Moden.
 */
export default function RiskDensityChart({ result, safetyBuffer }: Props) {
  const { density, daily, breachProbabilities, stressCapacity } = result;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<HoverState | null>(null);

  const confidenceLevels = stressCapacity.map((s) => s.confidenceLevel);
  const [confidence, setConfidence] = useState(
    () => confidenceLevels.find((c) => Math.abs(c - 0.9) < 1e-9) ?? confidenceLevels[0] ?? 0.9,
  );
  const selectedStress = stressCapacity.find((s) => Math.abs(s.confidenceLevel - confidence) < 1e-9) ?? null;
  const criticalDay = selectedStress?.criticalDay ?? -1;

  // Responsive: volle Breite nutzen, Höhe aus der Breite ableiten (Mobile flacher).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = Math.round(Math.max(260, Math.min(460, w * 0.46)));
      setSize({ w, h });
    };
    measure();
    // ResizeObserver fehlt in jsdom/SSR – dann bleibt es bei der Initialmessung.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nDays = density.dates.length;
  const { valueMin, valueMax } = density;

  // Pixel-Geometrie als Memo – auch von der Interaktion genutzt.
  const geom = useMemo(() => {
    const plotW = Math.max(1, size.w - PAD.left - PAD.right);
    const plotH = Math.max(1, size.h - PAD.top - PAD.bottom);
    const xAt = (day: number) => PAD.left + (nDays > 0 ? (day / nDays) * plotW : 0);
    const yAt = (value: number) =>
      PAD.top + (valueMax > valueMin ? (1 - (value - valueMin) / (valueMax - valueMin)) * plotH : 0);
    const dayAtPx = (px: number) =>
      Math.max(0, Math.min(nDays - 1, Math.floor(((px - PAD.left) / plotW) * nDays)));
    return { plotW, plotH, xAt, yAt, dayAtPx };
  }, [size.w, size.h, nDays, valueMin, valueMax]);

  // Zeichnen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom/SSR: kein 2D-Context -> No-Op.

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const { plotW, plotH, xAt, yAt } = geom;

    // Bühne.
    ctx.fillStyle = STAGE_BG;
    ctx.fillRect(PAD.left, PAD.top, plotW, plotH);

    // Heatmap-Zellen.
    const cellW = plotW / Math.max(1, nDays);
    const binPx = plotH / density.bins;
    for (let d = 0; d < nDays; d++) {
      const col = density.counts[d];
      const colMax = density.columnMax[d];
      if (!colMax) continue;
      const x = xAt(d);
      for (let b = 0; b < density.bins; b++) {
        const c = col[b];
        if (c === 0) continue;
        const center = valueMin + (b + 0.5) * density.binSize;
        const region = regionForValue(center, safetyBuffer);
        ctx.fillStyle = densityColor(region, c / colMax);
        const yTop = PAD.top + (density.bins - 1 - b) * binPx;
        ctx.fillRect(x, yTop, Math.ceil(cellW) + 0.5, Math.ceil(binPx) + 0.5);
      }
    }

    // Y-Gitter + Beschriftung.
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const tick of niceTicks(valueMin, valueMax)) {
      const y = yAt(tick);
      if (y < PAD.top - 1 || y > PAD.top + plotH + 1) continue;
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
      ctx.fillStyle = AXIS;
      ctx.fillText(fmtAxis(tick), PAD.left - 6, y);
    }

    // Null- und Pufferlinie.
    const hline = (value: number, color: string, dash: number[]) => {
      if (value < valueMin || value > valueMax) return;
      const y = yAt(value);
      ctx.save();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
      ctx.restore();
    };
    hline(0, 'rgba(248,250,252,0.55)', [2, 3]);
    if (safetyBuffer > 0) hline(safetyBuffer, 'rgba(251,191,36,0.9)', [5, 4]);

    // Kritischer Tag (gewähltes Sicherheitsniveau).
    if (criticalDay >= 0 && criticalDay < nDays) {
      const x = xAt(criticalDay) + cellW / 2;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(244,114,182,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + plotH);
      ctx.stroke();
      ctx.restore();
    }

    // P50-Medianlinie.
    if (daily.length === nDays && nDays > 1) {
      ctx.beginPath();
      for (let d = 0; d < nDays; d++) {
        const x = xAt(d) + cellW / 2;
        const y = yAt(daily[d].p50);
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // X-Achse: Monatswechsel markieren.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = AXIS;
    let lastMonth = '';
    for (let d = 0; d < nDays; d++) {
      const iso = density.dates[d];
      const month = iso.slice(0, 7);
      if (month !== lastMonth) {
        lastMonth = month;
        const x = xAt(d) + cellW / 2;
        let label = iso;
        try {
          label = format(parseISO(iso), 'MMM', { locale: de });
        } catch {
          /* roher ISO-Fallback */
        }
        ctx.fillText(label, x, PAD.top + plotH + 15);
      }
    }

    // Hover-Cursor.
    if (hover && hover.day >= 0 && hover.day < nDays) {
      const x = xAt(hover.day) + cellW / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + plotH);
      ctx.stroke();
      ctx.restore();
    }
  }, [size, geom, density, daily, safetyBuffer, criticalDay, hover, nDays, valueMin, valueMax]);

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px < PAD.left || px > size.w - PAD.right) {
        setHover(null);
        return;
      }
      setHover({ day: geom.dayAtPx(px), x: px, y: py });
    },
    [geom, size.w],
  );

  if (nDays === 0 || density.total === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        Noch keine Pfade – Szenario wählen oder Daten ergänzen.
      </div>
    );
  }

  const hoveredDaily = hover ? daily[hover.day] : null;
  const breachBuffer = hover ? breachProbabilities[String(safetyBuffer)]?.[hover.day] : undefined;
  const breachZero = hover ? breachProbabilities['0']?.[hover.day] : undefined;
  const modes = hover ? columnModes(density, hover.day) : [];

  // Popover-Position: dem Finger/Cursor folgen, aber im Container halten.
  const popLeft = hover ? Math.min(Math.max(hover.x - 80, 4), Math.max(4, size.w - 172)) : 0;
  const popTop = hover && hover.y > size.h / 2 ? 8 : undefined;
  const popBottom = hover && hover.y <= size.h / 2 ? 8 : undefined;

  return (
    <div className="space-y-2">
      {/* Kopfzeile: Sicherheitsniveau-Auswahl + Stress-Readout (Auswahl an sinnvoller Stelle). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Liquiditäts-Wahrscheinlichkeit über die Zeit</div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Sicherheitsniveau"
            className="inline-flex overflow-hidden rounded-lg border text-xs"
          >
            {confidenceLevels.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setConfidence(c)}
                aria-pressed={Math.abs(c - confidence) < 1e-9}
                className={`px-2.5 py-1 tabular-nums transition-colors ${
                  Math.abs(c - confidence) < 1e-9
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {Math.round(c * 100)} %
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedStress && (
        <p className="text-xs text-muted-foreground">
          Bei <span className="font-medium text-foreground">{Math.round(confidence * 100)} %</span>{' '}
          Sicherheit trägt deine Liquidität einen zusätzlichen Schock bis{' '}
          <span className="font-medium text-foreground">{eur.format(selectedStress.maxAffordableShock)}</span>
          {criticalDay >= 0 && criticalDay < nDays && (
            <> – am knappsten am <span className="font-medium text-foreground">{fmtDay(density.dates[criticalDay])}</span></>
          )}
          .
        </p>
      )}

      {/* DIE Grafik. */}
      <div
        ref={wrapRef}
        className="relative w-full touch-none select-none"
        style={{ height: size.h || 300 }}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Liquiditäts-Heatmap über ${nDays} Tage. Median-Endsaldo ${eur.format(
          result.scenarioEndP50,
        )}.`}
      >
        <canvas ref={canvasRef} className="rounded-xl" />

        {hover && hoveredDaily && (
          <div
            className="pointer-events-none absolute z-10 w-[168px] rounded-lg border bg-popover/95 p-2 text-[11px] shadow-lg backdrop-blur"
            style={{ left: popLeft, top: popTop, bottom: popBottom }}
          >
            <div className="mb-1 font-medium">{fmtDay(density.dates[hover.day])}</div>
            <Row label="Median (P50)" value={eur.format(hoveredDaily.p50)} />
            <Row label="P10 – P90" value={`${eur.format(hoveredDaily.p10)} … ${eur.format(hoveredDaily.p90)}`} />
            {breachZero != null && <Row label="Risiko < 0 €" value={`${Math.round(breachZero * 100)} %`} />}
            {safetyBuffer > 0 && breachBuffer != null && (
              <Row label={`< ${eur.format(safetyBuffer)}`} value={`${Math.round(breachBuffer * 100)} %`} />
            )}
            {modes.length > 1 && (
              <div className="mt-1 border-t pt-1">
                <div className="mb-0.5 text-muted-foreground">Verteilungs-Moden</div>
                {modes.slice(0, 3).map((m, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: regionAccent(regionForValue(m.value, safetyBuffer)) }}
                    />
                    <span className="tabular-nums">{eur.format(m.value)}</span>
                    <span className="text-muted-foreground">({Math.round(m.share * 100)} %)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legende: Farbtrennung + Intensität. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <LegendSwatch region="deficit" label="Defizit (< 0 €)" />
        {safetyBuffer > 0 && <LegendSwatch region="caution" label="unter Puffer" />}
        <LegendSwatch region="healthy" label="gesund" />
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-10 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(148,163,184,0.15), rgb(148,163,184))' }} />
          heller = wahrscheinlicher
        </span>
        <span className="ml-auto">Median (weiße Linie) · Multimodalität sichtbar als mehrere Rücken</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function LegendSwatch({ region, label }: { region: 'deficit' | 'caution' | 'healthy'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: regionAccent(region) }} />
      {label}
    </span>
  );
}

function fmtDay(iso: string): string {
  try {
    return format(parseISO(iso), 'd. MMM yyyy', { locale: de });
  } catch {
    return iso;
  }
}

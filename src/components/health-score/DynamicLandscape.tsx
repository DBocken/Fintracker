import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { LandscapeScene } from "./landscape-scene";

/**
 * Lebende Finanzlandschaft: Canvas-2D-Renderer mit dauerhafter
 * requestAnimationFrame-Ambient-Animation (eigene Implementierung,
 * Animations-Baseline). Kein Bild-Asset, kein statisches Markup — die
 * gesamte Szene wird pro Frame aus dem Score-Modell (`LandscapeScene`)
 * gezeichnet:
 *
 *   Aufbau (einmalig):  Berg erhebt sich, Baum wächst, Wasser füllt sich,
 *                       Haus & Sonne erscheinen gestaffelt.
 *   Ambient (dauerhaft): Wolken ziehen, Sonnenstrahlen rotieren, Wasser
 *                       fließt & glitzert, Baum wiegt sich im Wind,
 *                       Fensterlicht flackert, Rauch steigt, Regen fällt,
 *                       Vögel kreisen bei gutem Gesamtstatus.
 *
 * `prefers-reduced-motion`: ein einziger statischer Frame im Zielzustand
 * (kein Loop). Bei verstecktem Tab pausiert der Loop (Akku).
 */

const VIEW_W = 360;
const VIEW_H = 640;
const HORIZON = 330;

/** Fester Zeitpunkt für den statischen Frame bei reduzierter Bewegung. */
const STATIC_TIME = 10;

/** Schwellwertbewusste Naturfarben je Status-Stufe (1..5). */
const CROWN_BY_STAGE = ["#a8a29e", "#bef264", "#86efac", "#4ade80", "#16a34a"];
const WATER_BY_STAGE = ["#94a3b8", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7"];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
/** Aufbau-Fortschritt 0..1 ab `delay`, Dauer `dur` Sekunden. */
const buildUp = (t: number, delay: number, dur = 0.9) => easeOut((t - delay) / dur);

const RIVERBED =
  "M 175 480 C 150 520 230 540 200 570 C 175 600 240 615 220 640 L 130 640 C 120 610 175 595 150 565 C 128 538 195 515 160 480 Z";

const CLOUD_SPOTS: Array<[number, number, number, number]> = [
  // [x, y, Skalierung, Driftgeschwindigkeit px/s]
  [90, 70, 1, 7],
  [200, 130, 0.8, 10],
  [140, 45, 0.7, 5],
  [290, 170, 0.9, 12],
];

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dark: boolean, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = dark ? "#64748b" : "#ffffff";
  ctx.globalAlpha *= dark ? 0.95 : 0.9;
  for (const [cx, cy, rx, ry] of [
    [0, 0, 26, 12],
    [-16, 4, 16, 9],
    [17, 4, 17, 9],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dark) {
    // Dauerregen unter Gewitterwolken: fallende Tropfen, endlos versetzt.
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const drop = ((t * 40 + i * 13) % 26) + 10;
      const dx = -14 + i * 14;
      ctx.globalAlpha = 0.7 * (1 - (drop - 10) / 26);
      ctx.beginPath();
      ctx.moveTo(dx, drop);
      ctx.lineTo(dx - 3, drop + 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: LandscapeScene, t: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  // Cover-Fit auf das logische 360×640-Koordinatensystem (wie SVG "slice").
  const scale = Math.max(w / VIEW_W, h / VIEW_H);
  ctx.translate((w - VIEW_W * scale) / 2, (h - VIEW_H * scale) / 2);
  ctx.scale(scale, scale);

  const { sun, mountain, tree, water, house } = scene;

  // Himmel: Verlauf folgt dem Gesamt-Bucket (kritisch = Gewittergrau).
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 20);
  sky.addColorStop(0, scene.sky[0]);
  sky.addColorStop(1, scene.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(-VIEW_W, -VIEW_H, VIEW_W * 3, HORIZON + 20 + VIEW_H);

  // Notgroschen → Sonne mit langsam rotierenden Strahlen + ziehende Wolken.
  if (sun) {
    const p = buildUp(t, 0.1);
    const sunR = (18 + 20 * sun.size) * p;
    ctx.save();
    ctx.globalAlpha = p;
    if (!sun.stormy && sunR > 0) {
      ctx.save();
      ctx.translate(278, 92);
      ctx.rotate(t * 0.08);
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.globalAlpha = p * (0.7 + 0.15 * Math.sin(t * 1.6));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (sunR + 6), Math.sin(a) * (sunR + 6));
        ctx.lineTo(Math.cos(a) * (sunR + 14), Math.sin(a) * (sunR + 14));
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = sun.stormy ? "#cbd5e1" : "#facc15";
    ctx.beginPath();
    ctx.arc(278, 92, Math.max(0, sunR), 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < sun.cloudCount; i++) {
      const [x0, y0, s, speed] = CLOUD_SPOTS[i];
      // Endloser Drift: Wolke wandert nach rechts und kommt links wieder.
      const x = ((x0 + t * speed + 60) % (VIEW_W + 120)) - 60;
      drawCloud(ctx, x, y0 + Math.sin(t * 0.4 + i) * 2, s, sun.stormy, t);
    }
    ctx.restore();
  }

  // Schulden → Berg (invers): erhebt sich beim Aufbau aus dem Horizont.
  if (mountain) {
    const p = buildUp(t, 0.25);
    const hgt = 210 * mountain.height * p;
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(-20, HORIZON);
    ctx.lineTo(95, HORIZON - hgt);
    ctx.lineTo(230, HORIZON);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(120, HORIZON);
    ctx.lineTo(200, HORIZON - hgt * 0.55);
    ctx.lineTo(300, HORIZON);
    ctx.closePath();
    ctx.fill();
  }

  // Boden: sanfte Hügel unterhalb des Horizonts.
  ctx.fillStyle = "#a7f3d0";
  ctx.beginPath();
  ctx.moveTo(-VIEW_W, HORIZON);
  ctx.quadraticCurveTo(120, HORIZON - 26, 240, HORIZON);
  ctx.quadraticCurveTo(320, HORIZON + 6, VIEW_W * 2, HORIZON - 8);
  ctx.lineTo(VIEW_W * 2, VIEW_H * 2);
  ctx.lineTo(-VIEW_W, VIEW_H * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6ee7b7";
  ctx.beginPath();
  ctx.moveTo(-VIEW_W, HORIZON + 90);
  ctx.quadraticCurveTo(160, HORIZON + 40, VIEW_W * 2, HORIZON + 100);
  ctx.lineTo(VIEW_W * 2, VIEW_H * 2);
  ctx.lineTo(-VIEW_W, VIEW_H * 2);
  ctx.closePath();
  ctx.fill();

  // Liquidität → Fluss: füllt sich beim Aufbau, fließt & glitzert dauerhaft.
  if (water) {
    const bed = new Path2D(RIVERBED);
    ctx.fillStyle = "#d6d3d1";
    ctx.fill(bed);
    const level = water.level * buildUp(t, 0.5, 1.2);
    const top = VIEW_H - 150 * level;
    ctx.save();
    ctx.clip(bed);
    ctx.fillStyle = scene.metrics.liquidity
      ? WATER_BY_STAGE[scene.metrics.liquidity.stage - 1]
      : WATER_BY_STAGE[2];
    // Wellige Oberfläche: leichtes Auf und Ab, damit das Wasser lebt.
    ctx.beginPath();
    ctx.moveTo(100, top + Math.sin(t * 1.4) * 2);
    for (let x = 100; x <= 270; x += 10) {
      ctx.lineTo(x, top + Math.sin(t * 1.4 + x * 0.12) * 2);
    }
    ctx.lineTo(270, VIEW_H);
    ctx.lineTo(100, VIEW_H);
    ctx.closePath();
    ctx.fill();
    // Fließende Glanzstreifen: wandern flussabwärts, endlos versetzt.
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const y = top + 14 + (((t * 26 + i * 40) % 140) + 0);
      if (y > VIEW_H - 4) continue;
      const x = 175 + Math.sin(y * 0.05 + i) * 22;
      ctx.globalAlpha = 0.5 * (1 - (y - top) / 160);
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Verträge/Fixkosten → Haus: Fensterlicht flackert warm, Rauch steigt.
  if (house) {
    const p = buildUp(t, 0.4);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 30);
    const shaky = house.condition < 0.4;
    ctx.fillStyle = shaky ? "#d6d3d1" : "#f5f5f4";
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(62, 415, 78, 52, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shaky ? "#78716c" : "#b45309";
    ctx.beginPath();
    ctx.moveTo(54, 417);
    ctx.lineTo(101, 384);
    ctx.lineTo(148, 417);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#78716c";
    ctx.fillRect(92, 438, 18, 29);
    const windows: Array<[number, number, boolean]> = [
      [70, 424, house.litWindows >= 1],
      [118, 424, house.litWindows >= 2],
      [94, 421, house.litWindows >= 3],
    ];
    for (const [wx, wy, lit] of windows) {
      // Warmes Flackern wie Kerzenlicht — nur bei beleuchteten Fenstern.
      ctx.fillStyle = lit ? "#fde68a" : "#475569";
      ctx.globalAlpha = p * (lit ? 0.85 + 0.15 * Math.sin(t * 5 + wx) : 1);
      ctx.fillRect(wx, wy, 14, wy === 421 ? 11 : 13);
    }
    ctx.globalAlpha = p;
    if (shaky) {
      ctx.strokeStyle = "#57534e";
      ctx.beginPath();
      ctx.moveTo(76, 467);
      ctx.lineTo(82, 452);
      ctx.lineTo(78, 444);
      ctx.stroke();
    }
    if (house.hasSmoke) {
      ctx.fillStyle = "#78716c";
      ctx.fillRect(122, 392, 9, 20);
      // Rauchpartikel: steigen dauerhaft auf, wachsen und verblassen.
      ctx.fillStyle = "#e7e5e4";
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = p * 0.55 * (1 - phase);
        ctx.beginPath();
        ctx.arc(126 + Math.sin(phase * 6 + i) * 4, 386 - phase * 34, 3 + phase * 5 + i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Sparquote → Baum: wächst beim Aufbau, wiegt sich dauerhaft im Wind.
  if (tree) {
    const p = buildUp(t, 0.55, 1.1);
    const trunkH = (26 + 64 * tree.growth) * p;
    const crownR = (14 + 28 * tree.growth) * p;
    const baseY = 468;
    const crownY = baseY - trunkH - crownR * 0.6;
    ctx.save();
    ctx.translate(265, baseY);
    ctx.rotate(Math.sin(t * 0.9) * 0.02 * p);
    ctx.translate(-265, -baseY);
    ctx.globalAlpha = p;
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.roundRect(261, baseY - trunkH, 9, trunkH, 3);
    ctx.fill();
    ctx.fillStyle = scene.metrics.savings_rate
      ? CROWN_BY_STAGE[scene.metrics.savings_rate.stage - 1]
      : CROWN_BY_STAGE[2];
    for (const [cx, cy, r] of [
      [265, crownY, crownR],
      [265 - crownR * 0.7, crownY + crownR * 0.45, crownR * 0.7],
      [265 + crownR * 0.7, crownY + crownR * 0.45, crownR * 0.7],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f87171";
    for (let i = 0; i < tree.fruitCount; i++) {
      const a = (i / Math.max(1, tree.fruitCount)) * Math.PI * 2 + 0.6;
      ctx.beginPath();
      ctx.arc(265 + Math.cos(a) * crownR * 0.6, crownY + Math.sin(a) * crownR * 0.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Vögel als stille Belohnung: kreisen dauerhaft, wenn alles im grünen Bereich ist.
  if (scene.overallBucket === "good" || scene.overallBucket === "excellent") {
    ctx.save();
    ctx.globalAlpha = buildUp(t, 1);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const bx = ((t * (16 + i * 6) + i * 160) % (VIEW_W + 80)) - 40;
      const by = 115 + i * 28 + Math.sin(t * 1.2 + i * 2) * 6;
      const flap = Math.sin(t * 7 + i * 3) * 3;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.quadraticCurveTo(bx - 4, by - 5 - flap, bx, by);
      ctx.quadraticCurveTo(bx + 4, by - 5 - flap, bx + 8, by);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

interface DynamicLandscapeProps {
  scene: LandscapeScene;
  /** Zugängliche Beschreibung der Illustration. */
  label: string;
  className?: string;
}

export default function DynamicLandscape({ scene, label, className }: DynamicLandscapeProps) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return; // jsdom/ältere Umgebungen ohne 2D-Kontext

    let raf = 0;
    let last = 0;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (reduce) drawScene(ctx, canvas.width, canvas.height, scene, STATIC_TIME);
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    if (reduce) {
      // Reduzierte Bewegung: ein statischer Frame im fertigen Zielzustand.
      drawScene(ctx, canvas.width, canvas.height, scene, STATIC_TIME);
      return () => ro?.disconnect();
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps genügt für Ambient-Animation (Akku)
      last = now;
      drawScene(ctx, canvas.width, canvas.height, scene, (now - start) / 1000);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scene, reduce]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={className}
      data-testid="dynamic-landscape"
      data-has-sun={scene.sun ? "true" : undefined}
      data-has-mountain={scene.mountain ? "true" : undefined}
      data-has-tree={scene.tree ? "true" : undefined}
      data-has-water={scene.water ? "true" : undefined}
      data-has-house={scene.house ? "true" : undefined}
      data-water-level={scene.water ? scene.water.level.toFixed(2) : undefined}
    />
  );
}

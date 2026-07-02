import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { LandscapeScene } from "./landscape-scene";

/**
 * Vollständig generative Finanzlandschaft: kein Hintergrundbild, keine
 * Stufen-PNGs — die gesamte Szene ist SVG und wird aus `LandscapeScene`
 * (Score-abgeleitete Geometrie) gezeichnet. Aufbau-Animation nach
 * Visualisierungstyp: wachsen (Baum/Berg), füllen (Fluss), erscheinen
 * (Sonne/Wolken/Haus). Bei `prefers-reduced-motion` wird der Zielzustand
 * direkt gerendert.
 */

const VIEW_W = 360;
const VIEW_H = 640;
const HORIZON = 330;

/** Schwellwertbewusste Naturfarben je Status-Stufe (1..5). */
const CROWN_BY_STAGE = ["#a8a29e", "#bef264", "#86efac", "#4ade80", "#16a34a"];
const WATER_BY_STAGE = ["#94a3b8", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7"];

const CLOUD_SPOTS: Array<[number, number, number]> = [
  [90, 70, 1],
  [200, 130, 0.8],
  [140, 45, 0.7],
  [290, 170, 0.9],
];

function Cloud({ x, y, scale, dark }: { x: number; y: number; scale: number; dark: boolean }) {
  const fill = dark ? "#64748b" : "#ffffff";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={dark ? 0.95 : 0.9}>
      <ellipse cx={0} cy={0} rx={26} ry={12} fill={fill} />
      <ellipse cx={-16} cy={4} rx={16} ry={9} fill={fill} />
      <ellipse cx={17} cy={4} rx={17} ry={9} fill={fill} />
      {dark && (
        // Regen unter Gewitterwolken: der Puffer ist zu dünn für schlechtes Wetter.
        <g stroke="#93c5fd" strokeWidth={2} strokeLinecap="round">
          <line x1={-14} y1={14} x2={-18} y2={24} />
          <line x1={0} y1={15} x2={-4} y2={25} />
          <line x1={14} y1={14} x2={10} y2={24} />
        </g>
      )}
    </g>
  );
}

interface DynamicLandscapeProps {
  scene: LandscapeScene;
  /** Zugängliche Beschreibung der Illustration. */
  label: string;
  className?: string;
}

export default function DynamicLandscape({ scene, label, className }: DynamicLandscapeProps) {
  const reduce = useReducedMotion();
  const growFromBottom = { transformBox: "fill-box", transformOrigin: "50% 100%" } as const;
  const appear = (delay: number) =>
    reduce
      ? { initial: false as const, transition: { duration: 0 } }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.6 } };
  const grow = (delay: number) =>
    reduce
      ? { initial: false as const, transition: { duration: 0 } }
      : {
          initial: { scaleY: 0, opacity: 0 },
          animate: { scaleY: 1, opacity: 1 },
          transition: { delay, duration: 0.8, type: "spring" as const, stiffness: 90, damping: 16 },
        };

  const { sun, mountain, tree, water, house } = scene;
  const waterColor = scene.metrics.liquidity ? WATER_BY_STAGE[scene.metrics.liquidity.stage - 1] : WATER_BY_STAGE[2];
  const crownColor = scene.metrics.savings_rate ? CROWN_BY_STAGE[scene.metrics.savings_rate.stage - 1] : CROWN_BY_STAGE[2];

  // Geometrie aus den 0..1-Modellwerten.
  const sunR = sun ? 18 + 20 * sun.size : 0;
  const peakY = mountain ? HORIZON - 210 * mountain.height : HORIZON;
  const trunkH = tree ? 26 + 64 * tree.growth : 0;
  const crownR = tree ? 14 + 28 * tree.growth : 0;
  const treeBaseY = 468;
  const crownY = treeBaseY - trunkH - crownR * 0.6;
  const waterTop = water ? VIEW_H - 150 * water.level : VIEW_H;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      data-testid="dynamic-landscape"
    >
      <defs>
        <linearGradient id="fin-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
        <clipPath id="fin-riverbed">
          <path d="M 175 480 C 150 520 230 540 200 570 C 175 600 240 615 220 640 L 130 640 C 120 610 175 595 150 565 C 128 538 195 515 160 480 Z" />
        </clipPath>
      </defs>

      {/* Himmel: Verlauf folgt dem Gesamt-Bucket (kritisch = Gewittergrau). */}
      <rect width={VIEW_W} height={HORIZON + 20} fill="url(#fin-sky)" />

      {/* Notgroschen → Sonne & Wolken */}
      {sun && (
        <motion.g data-testid="landscape-sun" {...appear(0.1)}>
          {!sun.stormy && (
            <g stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" opacity={0.8}>
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={278 + Math.cos(a) * (sunR + 6)}
                    y1={92 + Math.sin(a) * (sunR + 6)}
                    x2={278 + Math.cos(a) * (sunR + 14)}
                    y2={92 + Math.sin(a) * (sunR + 14)}
                  />
                );
              })}
            </g>
          )}
          <circle cx={278} cy={92} r={sunR} fill={sun.stormy ? "#cbd5e1" : "#facc15"} />
          {CLOUD_SPOTS.slice(0, sun.cloudCount).map(([x, y, s], i) => (
            <Cloud key={i} x={x} y={y} scale={s} dark={sun.stormy} />
          ))}
        </motion.g>
      )}

      {/* Schulden → Berg (invers: hoher Score = flacher Hügel) */}
      {mountain && (
        <motion.g data-testid="landscape-mountain" style={growFromBottom} {...grow(0.25)}>
          <path
            d={`M -20 ${HORIZON} L 95 ${peakY} L 230 ${HORIZON} Z`}
            fill="#475569"
          />
          <path
            d={`M 120 ${HORIZON} L 200 ${peakY + (HORIZON - peakY) * 0.45} L 300 ${HORIZON} Z`}
            fill="#64748b"
          />
        </motion.g>
      )}

      {/* Boden: sanfte Hügel unterhalb des Horizonts. */}
      <path
        d={`M 0 ${HORIZON} Q 120 ${HORIZON - 26} 240 ${HORIZON} T ${VIEW_W} ${HORIZON - 8} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`}
        fill="#a7f3d0"
      />
      <path
        d={`M 0 ${HORIZON + 90} Q 160 ${HORIZON + 40} ${VIEW_W} ${HORIZON + 100} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`}
        fill="#6ee7b7"
      />

      {/* Liquidität → Fluss: Wasserstand füllt das Bett von unten auf. */}
      {water && (
        <g data-testid="landscape-water" data-level={water.level.toFixed(2)}>
          <path
            d="M 175 480 C 150 520 230 540 200 570 C 175 600 240 615 220 640 L 130 640 C 120 610 175 595 150 565 C 128 538 195 515 160 480 Z"
            fill="#d6d3d1"
          />
          <g clipPath="url(#fin-riverbed)">
            <motion.rect
              x={100}
              width={160}
              height={200}
              fill={waterColor}
              initial={reduce ? false : { y: VIEW_H }}
              animate={{ y: waterTop }}
              transition={reduce ? { duration: 0 } : { delay: 0.5, duration: 1.1, ease: "easeOut" }}
            />
          </g>
        </g>
      )}

      {/* Verträge/Fixkosten → Haus: bewohnt & beheizt, wenn tragbar. */}
      {house && (
        <motion.g data-testid="landscape-house" style={growFromBottom} {...grow(0.4)}>
          <rect
            x={62}
            y={415}
            width={78}
            height={52}
            rx={3}
            fill={house.condition < 0.4 ? "#d6d3d1" : "#f5f5f4"}
            stroke="#78716c"
            strokeWidth={1.5}
          />
          <path d="M 54 417 L 101 384 L 148 417 Z" fill={house.condition < 0.4 ? "#78716c" : "#b45309"} />
          <rect x={92} y={438} width={18} height={29} rx={2} fill="#78716c" />
          {[70, 118].map((wx, i) => (
            <rect
              key={wx}
              x={wx}
              y={424}
              width={14}
              height={13}
              rx={1.5}
              fill={i < house.litWindows ? "#fde68a" : "#475569"}
            />
          ))}
          <rect
            x={94}
            y={421}
            width={14}
            height={11}
            rx={1.5}
            fill={house.litWindows >= 3 ? "#fde68a" : "#475569"}
          />
          {house.condition < 0.4 && (
            // Riss in der Fassade: Fixkostendruck nagt an der Substanz.
            <path d="M 76 467 L 82 452 L 78 444" stroke="#57534e" strokeWidth={1.5} fill="none" />
          )}
          {house.hasSmoke && (
            <>
              <rect x={122} y={392} width={9} height={20} fill="#78716c" />
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  cx={126}
                  cy={386}
                  r={3.5 + i}
                  fill="#e7e5e4"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={
                    reduce
                      ? { opacity: 0.5, y: -8 * (i + 1) }
                      : { opacity: [0, 0.6, 0], y: [0, -10 - 8 * i] }
                  }
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { delay: 1 + i * 0.7, duration: 2.4, repeat: Infinity, ease: "easeOut" }
                  }
                />
              ))}
            </>
          )}
        </motion.g>
      )}

      {/* Sparquote → Baum: wächst mit dem Score, trägt ab Stufe 3 Früchte. */}
      {tree && (
        <motion.g data-testid="landscape-tree" style={growFromBottom} {...grow(0.55)}>
          <rect
            x={261}
            y={treeBaseY - trunkH}
            width={9}
            height={trunkH}
            rx={3}
            fill="#92400e"
          />
          <circle cx={265} cy={crownY} r={crownR} fill={crownColor} />
          <circle cx={265 - crownR * 0.7} cy={crownY + crownR * 0.45} r={crownR * 0.7} fill={crownColor} />
          <circle cx={265 + crownR * 0.7} cy={crownY + crownR * 0.45} r={crownR * 0.7} fill={crownColor} />
          {Array.from({ length: tree.fruitCount }, (_, i) => {
            const a = (i / Math.max(1, tree.fruitCount)) * Math.PI * 2 + 0.6;
            return (
              <circle
                key={i}
                cx={265 + Math.cos(a) * crownR * 0.6}
                cy={crownY + Math.sin(a) * crownR * 0.5}
                r={3.5}
                fill="#f87171"
              />
            );
          })}
        </motion.g>
      )}

      {/* Vögel als stille Belohnung, wenn insgesamt alles im grünen Bereich ist. */}
      {(scene.overallBucket === "good" || scene.overallBucket === "excellent") && (
        <motion.g stroke="#334155" strokeWidth={1.5} fill="none" strokeLinecap="round" {...appear(1)}>
          <path d="M 60 120 q 5 -6 10 0 q 5 -6 10 0" />
          <path d="M 95 145 q 4 -5 8 0 q 4 -5 8 0" />
        </motion.g>
      )}
    </svg>
  );
}

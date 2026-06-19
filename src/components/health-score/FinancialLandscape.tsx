import { motion } from "framer-motion";
import type { FinancialHealth } from "@/services/financial-health-service";
import { useGentleMode } from "@/components/providers/GentleModeProvider";

function getStage(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

function scoreColor(score: number) {
  if (score >= 70) return "#2d5a3d";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

const STAGE_X: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "0%",
  2: "25%",
  3: "50%",
  4: "75%",
  5: "100%",
};

const POSITIONS: Record<string, { top: string; left: string; file: string; label: string }> = {
  emergency_fund: { top: "22%", left: "56%", file: "notgroschen", label: "Notgroschen" },
  debt:           { top: "40%", left: "16%", file: "schulden",    label: "Schulden" },
  savings_rate:   { top: "52%", left: "58%", file: "sparquote",   label: "Sparquote" },
  liquidity:      { top: "60%", left: "4%",  file: "liquiditaet", label: "Liquidität" },
  contracts:      { top: "70%", left: "44%", file: "vertraege",   label: "Verträge" },
};

export default function FinancialLandscape({ health }: { health: FinancialHealth }) {
  const { enabled: gentleMode } = useGentleMode();

  return (
    // max-height caps the portrait image; object-position shows the top (mountains + path)
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg" style={{ maxHeight: 480 }}>
      <img
        src="/assets/illustrations/background.png"
        alt="Finanzlandschaft"
        className="block w-full"
        style={{ maxHeight: 480, objectFit: "cover", objectPosition: "top" }}
        draggable={false}
      />

      {/* Overall score badge */}
      <motion.div
        className="absolute right-4 top-4 rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-lg"
        style={{ backgroundColor: "#2d5a3d" }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        Score {gentleMode ? "••" : health.score}
      </motion.div>

      {/* Subscore illustrations */}
      {health.subScores.map((s, i) => {
        const pos = POSITIONS[s.key];
        if (!pos) return null;
        const stage = getStage(s.score);
        const color = scoreColor(s.score);

        return (
          <motion.div
            key={s.key}
            className="absolute flex flex-col items-center"
            style={{ top: pos.top, left: pos.left }}
            initial={{ scale: 0.6, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 0.15 * i + 0.3, type: "spring", stiffness: 180 }}
          >
            {/* Sprite illustration */}
            <div
              style={{
                width: 72,
                height: 72,
                backgroundImage: `url(/assets/illustrations/${pos.file}.png)`,
                backgroundSize: "500% auto",
                backgroundPositionX: STAGE_X[stage],
                backgroundPositionY: "top",
                backgroundRepeat: "no-repeat",
              }}
            />
            {/* Score label bubble */}
            <div className="mt-1 rounded-xl bg-white/90 px-2 py-0.5 text-center shadow backdrop-blur-sm" style={{ minWidth: 64 }}>
              <div className="text-[9px] font-medium leading-tight text-gray-500">{pos.label}</div>
              <div className="text-sm font-bold leading-tight" style={{ color }}>
                {gentleMode ? "••" : s.score}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

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


// Positions tuned for portrait 9:16 image
const POSITIONS: Record<string, { top: string; left: string; file: string; label: string }> = {
  emergency_fund: { top: "22%", left: "52%", file: "notgroschen", label: "Notgroschen" },
  debt:           { top: "38%", left: "8%",  file: "schulden",    label: "Schulden" },
  savings_rate:   { top: "52%", left: "54%", file: "sparquote",   label: "Sparquote" },
  liquidity:      { top: "62%", left: "4%",  file: "liquiditaet", label: "Liquidität" },
  contracts:      { top: "72%", left: "40%", file: "vertraege",   label: "Verträge" },
};

export default function FinancialLandscape({ health }: { health?: FinancialHealth }) {
  const { enabled: gentleMode } = useGentleMode();

  return (
    // Portrait 9:16 container — parent controls the width
    <div className="relative w-full overflow-hidden rounded-2xl shadow-lg" style={{ paddingBottom: "177%" }}>
      <img
        src="/assets/illustrations/background.png"
        alt="Finanzlandschaft"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "cover", objectPosition: "center center" }}
        draggable={false}
      />

      {health && health.subScores.map((s, i) => {
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
            transition={{ delay: 0.15 * i + 0.2, type: "spring", stiffness: 180 }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                backgroundImage: `url(/assets/illustrations/${pos.file}${stage - 1}.png)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div
              className="mt-0.5 rounded-lg bg-white/90 px-1.5 py-0.5 text-center shadow backdrop-blur-sm"
              style={{ minWidth: 52 }}
            >
              <div className="text-[8px] font-medium leading-tight text-gray-500">{pos.label}</div>
              <div className="text-xs font-bold leading-tight" style={{ color }}>
                {gentleMode ? "••" : s.score}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

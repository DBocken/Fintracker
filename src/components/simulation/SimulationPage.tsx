"use client";

import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { SimulationPanel } from './SimulationPanel';

export function SimulationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 className="mb-3 flex items-center justify-center gap-3 text-3xl font-bold md:text-4xl">
            <Brain className="h-9 w-9 text-primary" />
            Finanz-Simulation
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
            Nutze die Simulation als Planungsengine für Budget-, Schulden- und Zielentscheidungen.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <SimulationPanel />
        </motion.div>
      </div>
    </div>
  );
}
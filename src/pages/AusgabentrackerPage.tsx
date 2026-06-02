import { useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  CreditCard,
  BarChart3,
  Settings as Gear,
  Zap,
  PlayCircle,
  Wallet,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvUploader } from "../components/CsvUploader";
import { ReviewTable } from "../components/ReviewTable";
import { ResponsivePremiumDashboard } from "../components/premium-dashboard/ResponsivePremiumDashboard";
import { Dashboard } from "../components/Dashboard";
import { Settings } from "../components/settings/Settings";
import { SimulationPage } from "../components/simulation/SimulationPage";
import { showSuccess } from "@/utils/toast";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import UserProfile from "@/components/UserProfile";
import NotificationsBell from "@/components/NotificationsBell";
import UserQuickProfile from "@/components/UserQuickProfile";
import { ContractsDashboard } from "../components/contracts/ContractsDashboard";
import { AccountManager } from "../components/accounts/AccountManager";
import { DataExport } from "@/components/DataExport";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "premium", label: "Premium Analyse", icon: Zap },
  { id: "contracts", label: "Verträge", icon: Wallet },
  { id: "accounts", label: "Konten", icon: CreditCard },
  { id: "csv", label: "CSV Upload", icon: Upload },
  { id: "export", label: "Daten Export", icon: Download },
  { id: "simulation", label: "Simulation", icon: PlayCircle },
  { id: "settings", label: "Einstellungen", icon: Gear },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]["id"];

export default function AusgabentrackerPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [activeNav, setActiveNav] = useState<NavItemId>("dashboard");

  const handleTransactionsLoaded = (txs: any[]) => {
    setTransactions(txs);
    setShowReview(true);
    setActiveNav("csv");
  };

  const handleConfirm = () => {
    showSuccess(`${transactions.length} Transaktionen importiert`);
    setShowReview(false);
    setActiveNav("premium");
  };

  const activeItem = NAV_ITEMS.find((i) => i.id === activeNav);

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard":
        return <Dashboard />;
      case "premium":
        return <ResponsivePremiumDashboard />;
      case "contracts":
        return <ContractsDashboard />;
      case "accounts":
        return <AccountManager />;
      case "csv":
        return !showReview ? (
          <CsvUploader onTransactionsLoaded={handleTransactionsLoaded} />
        ) : (
          <ReviewTable transactions={transactions} onConfirm={handleConfirm} />
        );
      case "export":
        return <DataExport />;
      case "simulation":
        return <SimulationPage />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar – Desktop */}
        <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 px-4 py-6">
          {/* Brand */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Finanz-Copilot
              </div>
              <div className="text-sm font-semibold text-white">
                Ausgabentracker
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile bottom-left */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <UserProfile />
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="border-b border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-900/40 px-4 py-3 sm:px-6 lg:px-8 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Guten Überblick behalten
                </p>
                <h1 className="text-2xl font-bold text-white sm:text-3xl">
                  {activeItem?.label || "Ausgabentracker"}
                </h1>
              </motion.div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <ThemeToggle />
                <NotificationsBell />
                <UserQuickProfile />
                {activeNav !== "csv" && (
                  <Button
                    onClick={() => setActiveNav("csv")}
                    className="bg-green-600 text-white hover:bg-green-500"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    CSV hochladen
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile Navigation */}
            <div className="mt-4 flex gap-2 overflow-x-auto md:hidden">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-medium",
                      active
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-800 text-slate-200"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
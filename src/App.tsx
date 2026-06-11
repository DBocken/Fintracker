import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import BankCallbackPage from "./pages/BankCallbackPage";
import Login from "./pages/Login";
import UnlockPage from "./pages/Unlock";
import { useAuth } from "./components/providers/AuthProvider";
import { useLocalEncryption } from "./components/providers/LocalEncryptionProvider";
import AppShell from "@/components/layout/AppShell";

import CoachPage from "@/pages/CoachPage";
import DebtsPage from "@/pages/DebtsPage";
import NetWorthPage from "@/pages/NetWorthPage";
import DashboardPage from "@/pages/DashboardPage";
import PremiumPage from "@/pages/PremiumPage";
import SimulationPage from "@/pages/SimulationPage";
import TradingPage from "@/pages/TradingPage";
import ContractsPage from "@/pages/ContractsPage";
import AccountsPage from "@/pages/AccountsPage";
import CsvPage from "@/pages/CsvPage";
import ExportPage from "@/pages/ExportPage";
import SettingsPage from "@/pages/SettingsPage";
import PerformancePage from "@/pages/PerformancePage";
import BackupsPage from "@/pages/BackupsPage";

function LockedRedirect() {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/unlock?next=${encodeURIComponent(next)}`} replace />;
}

function App() {
  const { status } = useAuth();
  const { enabled, unlocked } = useLocalEncryption();

  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }

  const locked = enabled && !unlocked;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ausgabentracker/return" element={<BankCallbackPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unlock" element={<UnlockPage />} />

        {locked ? (
          <Route path="*" element={<LockedRedirect />} />
        ) : (
          <>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/coach" replace />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/debts" element={<DebtsPage />} />
              <Route path="/net-worth" element={<NetWorthPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/premium" element={<PremiumPage />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/trading" element={<TradingPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/csv" element={<CsvPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/backups" element={<BackupsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/coach" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
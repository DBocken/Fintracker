import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import BankCallbackPage from "./pages/BankCallbackPage";
import Login from "./pages/Login";
import UnlockPage from "./pages/Unlock";
import { useAuth } from "./components/providers/AuthProvider";
import { useLocalEncryption } from "./components/providers/LocalEncryptionProvider";
import { hasStartedAnonymousMode } from "./lib/anonymous-mode";
import AppShell from "@/components/layout/AppShell";
import RouteGuard from "@/components/layout/RouteGuard";
import { isFeatureEnabled } from "@/lib/feature-flags";

import CoachPage from "@/pages/CoachPage";
import DebtsPage from "@/pages/DebtsPage";
import NetWorthPage from "@/pages/NetWorthPage";
import DashboardPage from "@/pages/DashboardPage";
import AnalysisPage from "@/pages/AnalysisPage";
import SimulationPage from "@/pages/SimulationPage";
import TradingPage from "@/pages/TradingPage";
import ContractsPage from "@/pages/ContractsPage";
import AccountsPage from "@/pages/AccountsPage";
import CsvPage from "@/pages/CsvPage";
import ExportPage from "@/pages/ExportPage";
import SettingsPage from "@/pages/SettingsPage";
import PrivacyPage from "@/pages/PrivacyPage";

function LockedRedirect() {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/unlock?next=${encodeURIComponent(next)}`} replace />;
}

function App() {
  const { status } = useAuth();
  const { enabled, unlocked } = useLocalEncryption();
  const [anonymousStarted, setAnonymousStarted] = useState(() => hasStartedAnonymousMode());

  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }

  const isAuthenticated = status === "authenticated";

  // Erstbesuch ohne Anmeldung: Landing-Screen mit der Wahl
  // "Ohne Anmeldung starten" oder Google-Login (Issue #28).
  if (!isAuthenticated && !anonymousStarted) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/ausgabentracker/return" element={<BankCallbackPage />} />
          {/* Privacy-Seite auch vor dem Einstieg erreichbar (Issue #41) */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Login onStartAnonymous={() => setAnonymousStarted(true)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const locked = enabled && !unlocked;

  // Ab hier: volle App — angemeldet ODER bewusst anonym (Issue #26).
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/unlock" element={<UnlockPage />} />

        {locked ? (
          <Route path="*" element={<LockedRedirect />} />
        ) : (
          <>
            <Route path="/ausgabentracker/return" element={<BankCallbackPage />} />

            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to="/coach" replace />
                ) : (
                  <Login onStartAnonymous={() => setAnonymousStarted(true)} />
                )
              }
            />

            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/coach" replace />} />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/debts" element={<DebtsPage />} />
              <Route path="/net-worth" element={<NetWorthPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/premium"
                element={<RouteGuard path="/premium"><AnalysisPage /></RouteGuard>}
              />
              <Route
                path="/simulation"
                element={<RouteGuard path="/simulation"><SimulationPage /></RouteGuard>}
              />
              <Route
                path="/trading"
                element={
                  isFeatureEnabled("trading_beta") ? (
                    <RouteGuard path="/trading"><TradingPage /></RouteGuard>
                  ) : (
                    <Navigate to="/coach" replace />
                  )
                }
              />
              <Route
                path="/contracts"
                element={<RouteGuard path="/contracts"><ContractsPage /></RouteGuard>}
              />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/csv" element={<CsvPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              {/* Backups & Performance leben jetzt in den Einstellungen (Issue #42) */}
              <Route path="/backups" element={<Navigate to="/settings" replace />} />
              <Route path="/performance" element={<Navigate to="/settings" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/coach" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

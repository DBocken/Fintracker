import { useState, lazy, Suspense } from "react";
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

// Route-Level Code-Splitting: schwere Seiten (Charts, PDF-Export, Trading) werden
// erst beim Aufruf geladen, damit das initiale Bundle kleiner bleibt.
const CoachPage = lazy(() => import("@/pages/CoachPage"));
const DebtsPage = lazy(() => import("@/pages/DebtsPage"));
const NetWorthPage = lazy(() => import("@/pages/NetWorthPage"));
const LiquidityPage = lazy(() => import("@/pages/LiquidityPage"));
const MilestonesPage = lazy(() => import("@/pages/MilestonesPage"));
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const AnalysisPage = lazy(() => import("@/pages/AnalysisPage"));
const SimulationPage = lazy(() => import("@/pages/SimulationPage"));
const TradingPage = lazy(() => import("@/pages/TradingPage"));
const ContractsPage = lazy(() => import("@/pages/ContractsPage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));
const CsvPage = lazy(() => import("@/pages/CsvPage"));
const ExportPage = lazy(() => import("@/pages/ExportPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));

function LockedRedirect() {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/unlock?next=${encodeURIComponent(next)}`} replace />;
}

const RouteFallback = <div className="min-h-screen bg-background" />;

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
        <Suspense fallback={RouteFallback}>
          <Routes>
            <Route path="/ausgabentracker/return" element={<BankCallbackPage />} />
            {/* Privacy-Seite auch vor dem Einstieg erreichbar (Issue #41) */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Login onStartAnonymous={() => setAnonymousStarted(true)} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  const locked = enabled && !unlocked;

  // Ab hier: volle App — angemeldet ODER bewusst anonym (Issue #26).
  return (
    <BrowserRouter>
      <Suspense fallback={RouteFallback}>
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
              <Route path="/liquidity" element={<LiquidityPage />} />
              <Route path="/milestones" element={<MilestonesPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

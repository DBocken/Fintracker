import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import BankCallbackPage from "./pages/BankCallbackPage";
import Login from "./pages/Login";
import UnlockPage from "./pages/Unlock";
import { useAuth } from "./components/providers/AuthProvider";
import { useLocalEncryption } from "./components/providers/LocalEncryptionProvider";
import { hasStartedAnonymousMode } from "./lib/anonymous-mode";
import { syncCategoryTemplate } from "@/services/category-template-service";
import { runStoreMigrations } from "@/services/local-store-migrations";
import AppShell from "@/components/layout/AppShell";
import RouteGuard from "@/components/layout/RouteGuard";

// Route-Level Code-Splitting: schwere Seiten (Charts, PDF-Export, Trading) werden
// erst beim Aufruf geladen, damit das initiale Bundle kleiner bleibt.
const CoachPage = lazy(() => import("@/pages/CoachPage"));
const DebtsPage = lazy(() => import("@/pages/DebtsPage"));
const NetWorthPage = lazy(() => import("@/pages/NetWorthPage"));
const LiquidityPage = lazy(() => import("@/pages/LiquidityPage"));
const MilestonesPage = lazy(() => import("@/pages/MilestonesPage"));
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const IncomePage = lazy(() => import("@/pages/IncomePage"));
const IncomeWrappedPage = lazy(() => import("@/pages/IncomeWrappedPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const SpecialCategoriesPage = lazy(() => import("@/pages/SpecialCategoriesPage"));
const TaxReportPage = lazy(() => import("@/pages/TaxReportPage"));
const EuerPage = lazy(() => import("@/pages/EuerPage"));
const AnalysisPage = lazy(() => import("@/pages/AnalysisPage"));
const SimulationPage = lazy(() => import("@/pages/SimulationPage"));
const TradingPage = lazy(() => import("@/pages/TradingPage"));
const ContractsPage = lazy(() => import("@/pages/ContractsPage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));
const CsvPage = lazy(() => import("@/pages/CsvPage"));
const ExportPage = lazy(() => import("@/pages/ExportPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
// three.js-Slice (AGENTS.md §7): eigener Chunk, damit das WebGL-Bundle nicht
// ins initiale Laden anderer Seiten einfließt.
const CityPage = lazy(() => import("@/pages/CityPage"));

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
  const [migrationState, setMigrationState] = useState<"idle" | "running" | "done">("idle");
  const [migrationError, setMigrationError] = useState<Error | null>(null);

  const isAuthenticated = status === "authenticated";
  const locked = enabled && !unlocked;
  // Die App wird tatsaechlich benutzt (angemeldet oder bewusst anonym
  // gestartet) UND der lokale Speicher ist lesbar (kein Tresor im Weg —
  // ein kuenftiger echter Schritt koennte verschluesselte Daten anfassen
  // muessen, siehe local-store-migrations.ts).
  const readyForStoreMigration = (isAuthenticated || anonymousStarted) && !locked;

  // WP 1.3: Der einmalige, asynchrone Migrationslaeufer fuer
  // LOCAL_STORE_SCHEMA_VERSION. Muss erfolgreich abgeschlossen sein, BEVOR
  // irgendeine Flaeche den lokalen Speicher liest/schreibt — sonst wuerde
  // assertCompatibleStore() (local-finance-store.ts) mit
  // StoreMigrationPendingError ablehnen, sobald WP 4.1 den ersten echten
  // Schritt eintraegt. Heute (leere Schrittliste) ist der Lauf ein
  // No-op, der nur den Versions-Marker nachtraegt.
  useEffect(() => {
    if (!readyForStoreMigration) return;
    if (migrationState !== "idle") return;
    setMigrationState("running");
    runStoreMigrations()
      .then(() => setMigrationState("done"))
      .catch((error: unknown) => {
        setMigrationError(error instanceof Error ? error : new Error(String(error)));
      });
  }, [readyForStoreMigration, migrationState]);

  // Additives Kategorien-/Filterwort-Update (Weg B): nur für eingeloggte Nutzer
  // (anonym = kein Server-Kontakt) und nur bei entsperrtem Tresor. Fire-and-forget,
  // versionsgesichert und No-op bei Fehler — die App bleibt ohne dieses Update
  // vollständig local-first.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (enabled && !unlocked) return;
    void syncCategoryTemplate().catch(() => {});
  }, [status, enabled, unlocked]);

  // Ein fehlgeschlagener Migrationslauf wird NICHT still verschluckt: der
  // Wurf waehrend des Renderns laesst ihn den umgebenden <ErrorBoundary>
  // (main.tsx) erreichen — sichtbar statt eines Zugriffs, der reihenweise
  // mit StoreMigrationPendingError scheitert, ohne dass die Oberflaeche
  // je sagt, warum.
  if (migrationError) {
    throw migrationError;
  }

  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }

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

  // Store-Migration steht noch aus (oder laeuft) UND der Tresor ist offen
  // (bzw. gar nicht erst aktiv) — noch keine Fläche rendern, die lesen
  // koennte. Gleiches Muster wie der Ladezustand oben: kurzer, textloser
  // Zwischenzustand, kein Flackern bei der heutigen leeren Schrittliste.
  if (readyForStoreMigration && migrationState !== "done") {
    return <div className="min-h-screen bg-background" />;
  }

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
              <Route path="/income" element={<IncomePage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              {/* Anlässe (Sonderkategorien): Premium via RouteGuard —
                  Free/Anonymous sehen den begehrlichen Locked-Preview. */}
              <Route
                path="/occasions"
                element={<RouteGuard path="/occasions"><SpecialCategoriesPage /></RouteGuard>}
              />

              <Route path="/tax" element={<TaxReportPage />} />
              {/* Immer registriert (Deep-Links/Bestandsdaten); Nav zeigt sie nur im Business-Modus. */}
              <Route path="/euer" element={<EuerPage />} />
              <Route
                path="/premium"
                element={<RouteGuard path="/premium"><AnalysisPage /></RouteGuard>}
              />
              <Route
                path="/simulation"
                element={<RouteGuard path="/simulation"><SimulationPage /></RouteGuard>}
              />
              <Route path="/trading" element={<TradingPage />} />
              {/* 3D-Ausgabenstadt (Beta): läuft INNERHALB der App-Navigation
                  (Sidebar/BottomNav bleiben erreichbar), siehe
                  src/features/finance-city/README.md. */}
              <Route path="/city" element={<CityPage />} />
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

            {/* Fullscreen-Story ohne AppShell-Chrome (Premium-gated per FeatureGate). */}
            <Route path="/income/wrapped" element={<IncomeWrappedPage />} />

            <Route path="*" element={<Navigate to="/coach" replace />} />
          </>
        )}
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

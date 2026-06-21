import { Navigate } from 'react-router-dom';

/**
 * Kompatibler Premium-Einstieg: Die frühere parallele Simulation wird nicht
 * mehr als zweite Rechenwelt gerendert. Planung, Szenarien und Monte Carlo
 * leben gemeinsam im Liquiditäts-Forecast.
 */
export default function SimulationPageWrapper() {
  return <Navigate to="/liquidity?mode=simulation" replace />;
}

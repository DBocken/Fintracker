/**
 * Alle Routen, die ein Demo-Nutzer erreichen kann — die Liste, gegen die die
 * Flächenprüfungen laufen (Accessibility, Performance).
 *
 * Zentral, damit ein neuer Screen nicht in der einen Prüfung auftaucht und in
 * der anderen fehlt. Genau diese Lücke war der Anlass für Phase 10: geprüft
 * wurden drei Screens von zweiundzwanzig.
 *
 * Einige stehen hinter einem `RouteGuard` (Bereichs-Freischaltung über die
 * Lebenssituation) und leiten dann um. Das ist kein Fehlschlag, sondern der
 * Normalfall — die Prüfungen vermerken es und gehen weiter, statt eine
 * Freischaltung zu erzwingen, die es im echten Gebrauch auch nicht gibt.
 */
export const ALL_ROUTES = [
  // Der Einstieg. Er bleibt auch nach dem Durchlauf erreichbar und setzt dann
  // bei der Lebenssituation auf — die Fläche gehört damit in dieselbe Prüfung
  // wie jede andere.
  "/willkommen",
  "/coach",
  "/dashboard",
  "/transactions",
  "/fragen",
  "/accounts",
  "/budgets",
  "/debts",
  "/net-worth",
  "/liquidity",
  "/milestones",
  "/income",
  "/tax",
  "/euer",
  "/trading",
  "/city",
  "/contracts",
  "/occasions",
  "/premium",
  "/billing",
  "/simulation",
  "/csv",
  "/export",
  "/tutorials",
  "/settings",
  "/privacy",
] as const;

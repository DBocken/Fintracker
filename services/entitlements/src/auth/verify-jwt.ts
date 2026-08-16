import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

/**
 * Zugangsprüfung des Dienstes (WP 6.2).
 *
 * **Der Issuer ist Konfiguration, kein Code.** Genau daran hängt Phase 7: Der
 * Wechsel vom heutigen Anbieter auf den self-hosted IdP soll zwei
 * Umgebungsvariablen kosten (`AUTH_JWKS_URL`, `AUTH_ISSUER`) — nicht eine
 * Änderung hier. Deshalb nimmt die Funktion Schlüsselquelle und Issuer
 * entgegen, statt sie zu kennen.
 *
 * Zurück kommt die **interne userId**. Dass sie heute mit dem IdP-Subject
 * identisch ist, ist eine Eigenschaft der aktuellen Zuordnung (WP 2.1,
 * `src/lib/identity.ts` der App) — nicht der Schnittstelle.
 */

export interface VerifyOptions {
  /** Schlüsselquelle: entfernte JWKS-URL oder eine bereits aufgelöste Menge. */
  jwks: JWTVerifyGetKey;
  issuer: string;
  audience?: string;
  /** Toleranz gegen Uhrendrift zwischen IdP und Dienst. */
  clockToleranceSeconds?: number;
}

export interface VerifiedCaller {
  userId: string;
}

export async function verifyAccessToken(
  token: string,
  options: VerifyOptions,
): Promise<VerifiedCaller> {
  if (!token) throw new Error("Kein Token");

  const { payload } = await jwtVerify(token, options.jwks, {
    issuer: options.issuer,
    audience: options.audience,
    clockTolerance: options.clockToleranceSeconds ?? 5,
  });

  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!subject) {
    // Ein Token ohne Subject gehört zu niemandem — es wäre ein Zugang, der auf
    // jeden passt. `jwtVerify` prüft das nicht von sich aus.
    throw new Error("Token ohne sub");
  }

  return { userId: subject };
}

/** Baut die Schlüsselquelle aus der Umgebung. Einzige Stelle mit der JWKS-URL. */
export function remoteJwks(jwksUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUrl));
}

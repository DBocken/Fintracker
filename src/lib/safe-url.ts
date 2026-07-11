/**
 * Validierung externer Redirect-Ziele (z. B. GoCardless-Requisition-Links).
 *
 * Auth-Links kommen aus API-Antworten und sind laut docs/security-boundaries.md
 * nicht vertrauenswürdig — vor `window.location.href = …` / `window.open(…)`
 * immer hier validieren, sonst wären javascript:/data:-URLs oder fremde Hosts
 * als Redirect-Ziel möglich.
 */

export const GOCARDLESS_AUTH_HOST_SUFFIXES = ['gocardless.com'];

export interface SafeUrlOptions {
  /** Erlaubte Host-Suffixe (Subdomains eingeschlossen). Default: GoCardless. */
  allowedHostSuffixes?: string[];
  /** Zusätzlich erlaubte exakte Origins (z. B. die eigene App für requisition.redirect). */
  allowedOrigins?: string[];
}

export function isSafeExternalAuthUrl(
  raw: string | null | undefined,
  opts: SafeUrlOptions = {},
): boolean {
  if (!raw) return false;

  let url: URL;
  try {
    url = new URL(raw); // relative/kaputte URLs → TypeError → ablehnen
  } catch {
    return false;
  }

  // https-only blockt javascript:, data:, http: in einem Schritt
  if (url.protocol !== 'https:') return false;

  // "https://evil@ob.gocardless.com" würde sonst als GoCardless-Host durchgehen
  if (url.username || url.password) return false;

  const { allowedHostSuffixes = GOCARDLESS_AUTH_HOST_SUFFIXES, allowedOrigins = [] } = opts;

  if (allowedOrigins.includes(url.origin)) return true;

  // endsWith('.' + suffix) statt includes: verhindert "evilgocardless.com"
  const host = url.hostname.toLowerCase();
  return allowedHostSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function assertSafeRedirectUrl(
  raw: string | null | undefined,
  opts?: SafeUrlOptions,
): string {
  if (!isSafeExternalAuthUrl(raw, opts)) {
    throw new Error('Unsichere Redirect-URL blockiert');
  }
  return raw as string;
}

/**
 * Die eigene Identität der App (WP 2.1, ADR `supabase-abloesung.md`).
 *
 * **Warum es diese Datei gibt.** Das Subject des Identitätsanbieters ist ein
 * Detail *dieses* Anbieters. Wer es direkt als Nutzerkennung durch die App
 * reicht, macht den späteren Anbieterwechsel zu einer Datenmigration — und
 * zwar ausgerechnet der Tabellen, bei denen ein Fehler am teuersten ist:
 * Phase 6 hängt das bezahlte Abo an diese Kennung, Phase 7 verspricht
 * „Subject-Wechsel ohne userId-Wechsel; Entitlements bleiben unberührt".
 *
 * Dieses Versprechen braucht genau eine Stelle, an der aus einem
 * IdP-Subject eine interne userId wird. Das ist `userIdFromSubject`.
 * **Heute ist die Zuordnung 1:1** (die Supabase-UUID *ist* die userId) — der
 * Gewinn liegt nicht in der Umrechnung, sondern darin, dass es sie gibt.
 *
 * Kein React, kein I/O — der Provider ruft das hier, nicht umgekehrt (§3).
 */

/** Interne, stabile Nutzerkennung. Unabhängig vom Identitätsanbieter. */
export type UserId = string;

/**
 * Was die App über den angemeldeten Nutzer weiss.
 *
 * `claims` ist bewusst ungetypt: Es ist der Rohbestand des Anbieters
 * (Supabase: `user_metadata`), und was darin steht, ist **nicht zugesichert**.
 * Wer daraus etwas anzeigen will, geht über `displayNameFromIdentity` —
 * die Funktion prüft, statt zu behaupten.
 */
export interface Identity {
  userId: UserId;
  email?: string;
  claims: Record<string, unknown>;
}

/**
 * Zuordnungsregel IdP-Subject → interne userId.
 *
 * Heute 1:1. Wechselt der Issuer (Phase 7, WP 7.1/7.2), ändert sich **diese
 * Funktion** und sonst nichts — aus einer Migration wird eine Zuordnung.
 *
 * Liefert `null`, wenn kein brauchbares Subject vorliegt: Eine Identität ohne
 * Kennung gibt es nicht, und ein leerer String wäre eine, die auf jeden passt.
 */
export function userIdFromSubject(subject: string | null | undefined): UserId | null {
  const getrimmt = (subject ?? "").trim();
  return getrimmt.length > 0 ? getrimmt : null;
}

/** Baut die Identität aus den Rohdaten des Anbieters. `null` ohne Subject. */
export function identityFromSubject(input: {
  subject: string | null | undefined;
  email?: string | null;
  claims?: Record<string, unknown> | null;
}): Identity | null {
  const userId = userIdFromSubject(input.subject);
  if (!userId) return null;

  return {
    userId,
    email: input.email ?? undefined,
    claims: input.claims ?? {},
  };
}

/** Eine Zeichenkette, die nach dem Trimmen noch Inhalt hat — sonst `null`. */
function alsText(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  const getrimmt = wert.trim();
  return getrimmt.length > 0 ? getrimmt : null;
}

/**
 * Anzeigename in der Reihenfolge `full_name` → `name` → E-Mail.
 *
 * Lag bis WP 2.1 doppelt in `UserQuickProfile` und `ProfileDialogContent`,
 * jeweils mit `as string` auf einem Wert, der von aussen kommt und dessen
 * Form niemand zugesichert hat. Hier wird geprüft statt behauptet.
 *
 * Gibt `null` statt eines Ersatztextes zurück: Der Ersatz („Unbekannter
 * Nutzer") ist Bildschirmtext und gehört über `t()` in die Komponente, nicht
 * in ein lib-Modul ohne React-Kontext (§6).
 */
export function displayNameFromIdentity(identity: Identity | null): string | null {
  if (!identity) return null;
  return (
    alsText(identity.claims.full_name) ??
    alsText(identity.claims.name) ??
    alsText(identity.email)
  );
}

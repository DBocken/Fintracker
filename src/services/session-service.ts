import { signOut } from './auth-service';
import { clearAllLocalData } from './local-data-reset';
import { clearAnonymousMode } from '@/lib/anonymous-mode';

/**
 * Das Beenden einer Sitzung als fachlicher Vorgang (WP 2.2).
 *
 * **Warum es diese Datei gibt.** Der Ablauf lag als `onClick`-Handler in
 * `LogoutButton` — eine Komponente, die damit ihre eigene Datenschicht war
 * (§3/§4) und deren Reihenfolge sich nur über ein gerendertes Dialogfeld
 * prüfen liess. Beim bevorstehenden Anbieterwechsel wäre sie ausserdem eine
 * weitere Fundstelle gewesen.
 *
 * Die Reihenfolge ist die eigentliche Aussage dieser Funktion und **nicht
 * beliebig**: Auf `SIGNED_OUT` hin leert der `AuthProvider` die Caches und
 * sperrt den lokalen Vault. Wer zuerst abmeldet und danach löscht, löscht
 * gegen einen bereits gesperrten Bestand. Deshalb: erst löschen, dann
 * abmelden — und bei einem Fehler beim Löschen **gar nicht** abmelden, damit
 * der Nutzer den Vorgang wiederholen kann, statt vor einer abgemeldeten App
 * mit halb gelöschten Daten zu stehen.
 */
export async function endSession(options: { wipeLocalData: boolean }): Promise<void> {
  if (options.wipeLocalData) {
    await clearAllLocalData();
    clearAnonymousMode();
  }

  await signOut();
}

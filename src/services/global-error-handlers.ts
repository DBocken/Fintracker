import { appendErrorLogEntry } from './error-log-service';

/**
 * Globale Auffangnetze für Fehler außerhalb des React-Render-Baums
 * (Event-Handler, Timer, uncaught async). Der Root-ErrorBoundary sieht diese
 * Fehler nie — ohne diese Handler wären sie in Produktion unsichtbar.
 * Einträge landen ausschließlich im lokalen, redigierten Fehlerprotokoll.
 */

let installed = false;

function onWindowError(event: ErrorEvent) {
  void appendErrorLogEntry({
    level: 'error',
    source: 'window',
    message: event.message || String(event.error ?? 'Unbekannter Fehler'),
    stack: event.error instanceof Error ? event.error.stack : undefined,
  });
}

function onUnhandledRejection(event: Event) {
  const reason = (event as Event & { reason?: unknown }).reason;
  void appendErrorLogEntry({
    level: 'error',
    source: 'promise',
    message: reason instanceof Error ? reason.message : String(reason ?? 'Unbekannte Rejection'),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
}

export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
}

/** Nur für Tests: Handler entfernen, damit Testfälle isoliert bleiben. */
export function uninstallGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  installed = false;
  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onUnhandledRejection);
}

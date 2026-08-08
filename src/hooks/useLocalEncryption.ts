/**
 * Zugriff auf den Sperrzustand der lokalen Verschlüsselung.
 *
 * Der Hook lag zuvor in `components/providers/LocalEncryptionProvider.tsx`, weil
 * er dort neben seinem Provider entstanden ist. Damit musste jeder Leser eine
 * Komponentendatei importieren — auch das ViewModel des Trading-Slices, das
 * lediglich wissen will, ob der Tresor offen ist.
 *
 * Der Context selbst bleibt beim Provider (er IST die Komponente); hier stehen
 * nur der Wertetyp und der Lesezugriff. `hooks → components` ist die übliche
 * Bauform und deshalb bewusst ungeprüft (AGENTS.md §3) — für die
 * Anwendungsschicht ist der Weg über `src/hooks/` aber der einzige, der ohne
 * Oberfläche auskommt.
 */
import { createContext, useContext } from 'react';

export type LocalEncryptionContextValue = {
  enabled: boolean;
  unlocked: boolean;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
  enable: (password: string) => Promise<void>;
  disable: (password: string) => Promise<void>;
  refresh: () => void;
};

export const LocalEncryptionContext = createContext<LocalEncryptionContextValue | null>(null);

export function useLocalEncryption(): LocalEncryptionContextValue {
  const ctx = useContext(LocalEncryptionContext);
  if (!ctx) throw new Error('useLocalEncryption must be used within LocalEncryptionProvider');
  return ctx;
}

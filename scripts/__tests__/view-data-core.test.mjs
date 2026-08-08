import { describe, it, expect } from 'vitest';
import { countDataAccess, istDarstellung } from '../view-data-core.mjs';

/**
 * Wächter-Test für den Ansicht/Daten-Wächter.
 *
 * Er zählt eine Ratsche. Zählt er falsch, zeigt die Ratsche einen Fortschritt,
 * den es nicht gibt — das ist schlimmer als gar keine Zahl, weil niemand mehr
 * nachsieht.
 */
describe('countDataAccess', () => {
  describe('zählt den Zugriff in der Darstellung', () => {
    it('sollte einen useQuery-Aufruf in einer Komponente zählen', () => {
      const src = `const { data } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });`;
      expect(countDataAccess('src/components/AccountManager.tsx', src).queries).toBe(1);
    });

    it('sollte mehrere Aufrufe derselben Datei einzeln zählen', () => {
      const src = [
        `const a = useQuery({ queryKey: ['a'] });`,
        `const b = useMutation({ mutationFn: save });`,
        `const c = useInfiniteQuery({ queryKey: ['c'] });`,
      ].join('\n');
      expect(countDataAccess('src/pages/DebtsPage.tsx', src).queries).toBe(3);
    });

    it('sollte einen generischen Aufruf `useQuery<Account[]>` zählen', () => {
      const src = `const q = useQuery<Account[]>({ queryKey: ['accounts'] });`;
      expect(countDataAccess('src/components/A.tsx', src).queries).toBe(1);
    });

    it('sollte einen direkten Service-Import zählen', () => {
      const src = `import { getAccounts } from '@/services/account-service';`;
      expect(countDataAccess('src/components/A.tsx', src).serviceImports).toBe(1);
    });

    it('sollte auch den relativen Service-Import zählen', () => {
      const src = `import { getAccounts } from '../../services/account-service';`;
      expect(countDataAccess('src/components/accounts/A.tsx', src).serviceImports).toBe(1);
    });
  });

  describe('zählt nicht, was kein Zugriff in der Darstellung ist', () => {
    it('sollte die Anwendungsschicht eines Slices NICHT zählen', () => {
      // Dort GEHOERT der Zugriff hin — das ist das Ziel, nicht der Befund.
      const src = `const { data } = useQuery({ queryKey: ['accounts'] });`;
      expect(countDataAccess('src/features/dashboard/application/use-x.ts', src).total).toBe(0);
    });

    it('sollte einen Test nicht zählen', () => {
      const src = `const { data } = useQuery({ queryKey: ['a'] });`;
      expect(countDataAccess('src/components/__tests__/A.test.tsx', src).total).toBe(0);
      expect(countDataAccess('src/components/A.test.tsx', src).total).toBe(0);
    });

    it('sollte Provider und Gates nicht zählen — sie SIND Infrastruktur', () => {
      const src = `import { localEncryption } from '@/services/local-crypto';`;
      expect(countDataAccess('src/components/providers/SkinProvider.tsx', src).total).toBe(0);
      expect(countDataAccess('src/components/FeatureGate.tsx', src).total).toBe(0);
    });

    it('[REGRESSION] sollte den Import von useQuery nicht als Zugriff zählen', () => {
      // Sonst zaehlte jede Datei einmal zu viel, und die Ratsche stuende
      // dauerhaft zu hoch — bei 63 Dateien um 63.
      const src = `import { useQuery, useMutation } from '@tanstack/react-query';`;
      expect(countDataAccess('src/components/A.tsx', src).queries).toBe(0);
    });

    it('sollte ein erwähntes useQuery im Kommentar nicht zählen', () => {
      const src = [
        '// Frueher stand hier ein useQuery(...) — jetzt im ViewModel.',
        '/* auch als Block: useQuery({}) */',
        ' * und als Fortsetzung: useMutation({})',
        'const x = 1;',
      ].join('\n');
      expect(countDataAccess('src/components/A.tsx', src).queries).toBe(0);
    });

    it('sollte ein useQuery hinter einem Zeilenende-Kommentar nicht zählen', () => {
      const src = `const x = 1; // vorher: useQuery({ queryKey: ['a'] })`;
      expect(countDataAccess('src/components/A.tsx', src).queries).toBe(0);
    });

    it('sollte einen lib-Import nicht für einen Service-Import halten', () => {
      const src = `import { toMinor } from '@/lib/money';`;
      expect(countDataAccess('src/components/A.tsx', src).serviceImports).toBe(0);
    });
  });

  describe('istDarstellung', () => {
    it('sollte components und pages erfassen, features aber nicht', () => {
      expect(istDarstellung('src/components/A.tsx')).toBe(true);
      expect(istDarstellung('src/pages/A.tsx')).toBe(true);
      expect(istDarstellung('src/features/x/presentation/A.tsx')).toBe(false);
      expect(istDarstellung('src/lib/a.ts')).toBe(false);
    });
  });
});

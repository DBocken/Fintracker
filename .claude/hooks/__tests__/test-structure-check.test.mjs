import { describe, it, expect } from "vitest";
import { analyzeTestFile } from "../test-structure-check.mjs";

/**
 * Wächter-Test für den Test-Struktur-Hook.
 *
 * Sichert die zwei blockierenden Regeln (zentraler Render-Helfer, __tests__/-
 * Platzierung) und die weiche should/sollte-Warnung gegen Rückfall ab.
 */
describe("analyzeTestFile", () => {
  const CENTRAL_IMPORT = `import { renderWithI18n } from '@/test-utils/render';`;

  describe("Normal Behavior", () => {
    it("sollte eine konforme Testdatei ohne Verstöße durchlassen", () => {
      const src = `${CENTRAL_IMPORT}\nit('sollte X tun', () => {});`;
      const { errors, warnings } = analyzeTestFile("src/lib/__tests__/money.test.ts", src);
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("sollte Nicht-Test-Dateien komplett ignorieren", () => {
      const src = `function renderWithI18n() {}`;
      const { errors } = analyzeTestFile("src/components/Foo.tsx", src);
      expect(errors).toHaveLength(0);
    });

    it("sollte die zentrale Helfer-Datei selbst nicht wegen ihrer Definition blockieren", () => {
      const src = `export function renderWithI18n() {}`;
      const { errors } = analyzeTestFile("src/test-utils/render.tsx", src);
      // .tsx aber kein .test. → wird ohnehin ignoriert; doppelt abgesichert.
      expect(errors).toHaveLength(0);
    });
  });

  describe("Blockierende Verstöße", () => {
    it("sollte lokale renderWithI18n-Definition blockieren", () => {
      const src = `function renderWithI18n(ui) { return render(ui); }\nit('sollte', () => {});`;
      const { errors } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(errors.some((e) => /renderWithI18n/.test(e))).toBe(true);
    });

    it("sollte lokale renderWithProviders-Definition (const) blockieren", () => {
      const src = `const renderWithProviders = (ui) => render(ui);\nit('sollte', () => {});`;
      const { errors } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(errors.some((e) => /renderWithProviders/.test(e))).toBe(true);
    });

    it("sollte Testdatei außerhalb von __tests__/ blockieren", () => {
      const src = `${CENTRAL_IMPORT}\nit('sollte', () => {});`;
      const { errors } = analyzeTestFile("src/lib/money.test.ts", src);
      expect(errors.some((e) => /__tests__/.test(e))).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("sollte src/security-Wächter-Tests trotz fehlendem __tests__/ erlauben", () => {
      const src = `it('[SECURITY] sollte', () => {});`;
      const { errors } = analyzeTestFile("src/security/mcp-headers.security.test.ts", src);
      expect(errors).toHaveLength(0);
    });

    it("sollte Nicht-src-Tests (Tooling) nicht erzwingen", () => {
      const src = `function renderWithI18n() {}`;
      const { errors } = analyzeTestFile(".claude/hooks/foo.test.ts", src);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Weiche Warnungen", () => {
    it("sollte englisches it('should …') außerhalb bilingualer Blöcke warnen", () => {
      const src = `${CENTRAL_IMPORT}\nit('should do X', () => {});`;
      const { warnings } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(warnings.some((w) => /sollte/.test(w))).toBe(true);
    });

    it("sollte englisches should in bewusst bilingualem English-Block NICHT warnen", () => {
      const src = `${CENTRAL_IMPORT}\ndescribe('English locale', () => { it('should do X', () => {}); });`;
      const { warnings } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(warnings).toHaveLength(0);
    });

    it("sollte englisches should mit 'in English'-Titel NICHT warnen (bilingual)", () => {
      const src = `${CENTRAL_IMPORT}\nit('should render in English', () => {});`;
      const { warnings } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(warnings).toHaveLength(0);
    });

    it("sollte englisches should mit locale:'en'-Nutzung NICHT warnen (bilingual)", () => {
      const src = `${CENTRAL_IMPORT}\nrenderWithProviders(<X/>, { locale: 'en' });\nit('should do X', () => {});`;
      const { warnings } = analyzeTestFile("src/components/__tests__/Foo.test.tsx", src);
      expect(warnings).toHaveLength(0);
    });
  });
});

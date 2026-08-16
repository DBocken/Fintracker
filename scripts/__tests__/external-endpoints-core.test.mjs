import { describe, expect, it } from 'vitest';
import {
  istZuPruefen,
  findeHosts,
  parseRegister,
  vergleiche,
} from '../external-endpoints-core.mjs';

/**
 * Wächter für die EU-Regel (WP 0.8).
 *
 * Die Tests halten beide Richtungen fest: Er muss den fremden Host sehen —
 * und er muss die legitimen Formen in Ruhe lassen. Ein Wächter, der jeden
 * i18n-Schlüssel für eine Domain hält, wird abgeschaltet statt befolgt
 * (dieselbe Lehre wie bei `check:money-format`).
 */

describe('istZuPruefen', () => {
  it('sollte Produktivcode der überwachten Bäume prüfen', () => {
    expect(istZuPruefen('src/lib/app-origin.ts')).toBe(true);
    expect(istZuPruefen('api/mcp/[token].ts')).toBe(true);
    expect(istZuPruefen('supabase/functions/market-quotes/index.ts')).toBe(true);
    expect(istZuPruefen('index.html')).toBe(true);
  });

  it('sollte auch eigenständige Dienste unter services/ prüfen', () => {
    // WP 6.2: Der EntitlementService liegt als eigenes Paket ausserhalb von
    // src/ — ausgerechnet er spricht mit dem Zahlungsdienstleister. Ein
    // eigener Install macht ihn nicht zu weniger Produktivcode.
    expect(istZuPruefen('services/entitlements/src/adapters/mollie-client.ts')).toBe(true);
    expect(istZuPruefen('services/entitlements/__tests__/routes.test.ts')).toBe(false);
  });

  it('sollte Tests nicht prüfen — dort sind fremde Hosts der Zweck', () => {
    // `gocardless.com.evil.tld` ist in safe-url.security.test.ts genau das,
    // was der Test beweisen soll. Ein Wächter, der ihn meldet, verlangt, den
    // Angriff aus dem Test zu entfernen.
    expect(istZuPruefen('src/lib/__tests__/safe-url.test.ts')).toBe(false);
    expect(istZuPruefen('src/pages/__tests__/BankCallbackPage.security.test.ts')).toBe(false);
    expect(istZuPruefen('e2e-tests/fixtures/routes.ts')).toBe(false);
  });

  it('sollte Dokumentation nicht prüfen', () => {
    expect(istZuPruefen('docs/security/anbieter-register.md')).toBe(false);
    expect(istZuPruefen('README.md')).toBe(false);
  });

  it('sollte Binärdateien nicht als Text lesen', () => {
    // Gemessen beim Erstlauf: `public/assets/illustrations/background.png`
    // trägt XMP-Metadaten mit `trufo.ai` und `www.w3.org`. Das ist kein
    // Aufrufort — eine PNG ruft nichts auf.
    expect(istZuPruefen('public/assets/illustrations/background.png')).toBe(false);
    expect(istZuPruefen('public/tesseract/eng.traineddata')).toBe(false);
    expect(istZuPruefen('public/fonts/inter.woff2')).toBe(false);
    expect(istZuPruefen('public/manifest.json')).toBe(true);
  });
});

describe('findeHosts — Bezeichner-URIs sind keine Endpunkte', () => {
  it('sollte $schema und $id eines JSON-Schemas nicht melden', () => {
    // `src/lib/finrisk/scenario_payload.schema.json:2` — der Wert benennt die
    // Schema-Sprache, er wird nie abgerufen.
    const quelle = '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "$id": "https://beispiel.invalid/x"\n}';
    expect(findeHosts(quelle, 'src/lib/finrisk/x.schema.json')).toEqual([]);
  });

  it('sollte XML-Namensräume nicht melden', () => {
    const quelle = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';
    expect(findeHosts(quelle, 'public/icon.svg')).toEqual([]);
  });

  it('sollte einen echten Abruf in derselben Datei weiterhin melden', () => {
    const quelle = '{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "quelle": "https://echte-quelle.io/v1"\n}';
    expect(findeHosts(quelle, 'src/x.json').map((f) => f.host)).toEqual(['echte-quelle.io']);
  });
});

describe('findeHosts — URL-Form', () => {
  it('sollte den Host einer https-URL finden', () => {
    const funde = findeHosts('const u = "https://bankaccountdata.gocardless.com/api/v2";', 'src/x.ts');
    expect(funde.map((f) => f.host)).toEqual(['bankaccountdata.gocardless.com']);
  });

  it('sollte Kommentare ausblenden', () => {
    // safe-url.ts:35 nennt "https://evil@ob.gocardless.com" als Gegenbeispiel.
    // Ein erklärender Host ist kein Datenfluss.
    const quelle = [
      '// "https://evil@ob.gocardless.com" würde sonst durchgehen',
      '/* siehe https://cdn.jsdelivr.net/npm/x */',
      'const echt = "https://stooq.com/q";',
    ].join('\n');
    expect(findeHosts(quelle, 'src/x.ts').map((f) => f.host)).toEqual(['stooq.com']);
  });

  it('sollte die Zeilennummer melden', () => {
    const quelle = 'const a = 1;\nconst b = "https://esm.sh/x";';
    expect(findeHosts(quelle, 'src/x.ts')[0].zeile).toBe(2);
  });
});

describe('findeHosts — blanker Host nur, wenn die Position ihn ausweist', () => {
  it('sollte einen Host-Suffix aus einem HOST-Bezeichner finden', () => {
    // src/lib/safe-url.ts:10 — ohne diese Regel unsichtbar, obwohl die
    // Konstante entscheidet, welche Redirect-Ziele akzeptiert werden.
    const quelle = "export const GOCARDLESS_AUTH_HOST_SUFFIXES = ['gocardless.com'];";
    expect(findeHosts(quelle, 'src/lib/safe-url.ts').map((f) => f.host)).toEqual(['gocardless.com']);
  });

  it('sollte ORIGIN-, DOMAIN- und ENDPOINT-Bezeichner ebenso lesen', () => {
    const quelle = 'const DEFAULT_ALLOWED_ORIGIN_SUFFIXES = ["vercel.app"];';
    expect(findeHosts(quelle, 'supabase/functions/x/index.ts').map((f) => f.host)).toEqual(['vercel.app']);
  });

  it('sollte Werte ohne Punkt in Ruhe lassen', () => {
    // BudgetOptimizerPanel.tsx:40 und capacitor/auth.ts:7 — richtige
    // Bezeichner, aber die Werte sind keine Hosts.
    const quelle = [
      "const BUNDLE_DOMAINS = new Set(['Streaming', 'Fitness']);",
      'const CALLBACK_HOST = "auth-callback";',
    ].join('\n');
    expect(findeHosts(quelle, 'src/x.ts')).toEqual([]);
  });

  it('sollte Dateinamen und Zahlen nicht für Hosts halten', () => {
    const quelle = [
      'const CHART_DOMAIN = "sankey.ts";',
      'const HOST_VERSION = "1.2.0";',
      'const PAD_DOMAIN = "0.75rem";',
    ].join('\n');
    expect(findeHosts(quelle, 'src/x.ts')).toEqual([]);
  });

  it('sollte blanke Domains OHNE ausweisenden Bezeichner ignorieren', () => {
    // Sonst wäre jeder i18n-Schlüssel ein Fund:
    // `accountService.accountTypeLabelCash` sieht aus wie eine Domain.
    const quelle = "t('accountService.accountTypeLabelCash');\nconst x = 'de-DE.json';";
    expect(findeHosts(quelle, 'src/x.ts')).toEqual([]);
  });
});

describe('findeHosts — reservierte Namen (RFC 2606 / 6761)', () => {
  it('sollte Beispiel- und Testnamen nicht melden', () => {
    const quelle = [
      'const a = "https://app.example/callback";',
      'const b = "https://telemetry.example.com/v1";',
      'const c = "https://x.test/y";',
      'const d = "https://y.invalid/z";',
      'const e = "http://localhost:5173";',
      'const f = "http://127.0.0.1:54321";',
    ].join('\n');
    expect(findeHosts(quelle, 'src/x.ts')).toEqual([]);
  });
});

const REGISTER = `
## Aktiv

| Host(s) | Anbieter | Sitz | Rolle | Zweck | AVV | Status | Geprüft |
|---|---|---|---|---|---|---|---|
| \`pbopyawkxxrluhofjtub.supabase.co\` | Supabase Inc. | US | Subprozessor | Auth | prüfen | Übergang | 2026-08-10 |
| \`fintracker-phi.vercel.app\`, \`/api/mcp\` | Vercel Inc. | US | Subprozessor | Hosting | prüfen | Übergang | 2026-08-10 |
| \`github.com\` | GitHub | US | Entwicklung | Quellcode | entfällt | aktiv | 2026-08-10 |
| \`schufa.de\` · \`caritas.de\` | diverse | DE | Link | Beratung | entfällt | aktiv | 2026-08-10 |

## Zu entfernen (Befunde, keine Absicht)

| Host(s) | Anbieter | Befund | Weg |
|---|---|---|---|
| \`chart.googleapis.com\` | Google | QR-Parameter | lokal rendern |

## Geplant (Programm; Zeile wird bei Inbetriebnahme „aktiv")

| Anbieter | Sitz | Rolle (künftig) | Zweck | Ab |
|---|---|---|---|---|
| Mollie B.V. | NL | Subprozessor | Zahlungen | Phase 6 |
`;

describe('parseRegister', () => {
  it('sollte die aktiven Hosts mit ihrer Rolle lesen', () => {
    const reg = parseRegister(REGISTER);
    expect(reg.aktiv.map((z) => z.host)).toContain('pbopyawkxxrluhofjtub.supabase.co');
    expect(reg.aktiv.find((z) => z.host === 'github.com').rolle).toBe('Entwicklung');
  });

  it('sollte mehrere Hosts einer Zeile trennen — Komma UND Mittelpunkt', () => {
    const hosts = parseRegister(REGISTER).aktiv.map((z) => z.host);
    expect(hosts).toContain('schufa.de');
    expect(hosts).toContain('caritas.de');
  });

  it('sollte Nicht-Hosts der Host-Spalte überspringen', () => {
    // Die Vercel-Zeile führt `/api/mcp` — ein Pfad, kein Host.
    expect(parseRegister(REGISTER).aktiv.map((z) => z.host)).not.toContain('/api/mcp');
  });

  it('sollte „Zu entfernen" getrennt führen', () => {
    expect(parseRegister(REGISTER).zuEntfernen).toEqual(['chart.googleapis.com']);
  });

  it('sollte aus „Geplant" keine Hosts lesen — die Tabelle hat keine Host-Spalte', () => {
    const hosts = parseRegister(REGISTER).aktiv.map((z) => z.host);
    expect(hosts).not.toContain('Mollie B.V.');
    expect(hosts.some((h) => h.toLowerCase().includes('mollie'))).toBe(false);
  });
});

describe('vergleiche', () => {
  const register = parseRegister(REGISTER);

  it('sollte einen unbekannten Host melden', () => {
    const ergebnis = vergleiche({
      codeHosts: [{ host: 'tracker.beispiel-fremd.io', zeile: 3, datei: 'src/x.ts' }],
      register,
      cspHosts: [],
    });
    expect(ergebnis.unbekannt).toHaveLength(1);
    expect(ergebnis.unbekannt[0].host).toBe('tracker.beispiel-fremd.io');
  });

  it('sollte www. beim Vergleich abstreifen', () => {
    // Der Code ruft `www.schufa.de`, das Register führt `schufa.de`.
    const ergebnis = vergleiche({
      codeHosts: [{ host: 'www.schufa.de', zeile: 1, datei: 'src/services/schufa-service.ts' }],
      register,
      cspHosts: [],
    });
    expect(ergebnis.unbekannt).toEqual([]);
  });

  it('sollte eine Subdomain durch ihren Register-Elternhost gedeckt sehen', () => {
    const ergebnis = vergleiche({
      codeHosts: [{ host: 'api.github.com', zeile: 1, datei: 'src/x.ts' }],
      register,
      cspHosts: [],
    });
    expect(ergebnis.unbekannt).toEqual([]);
  });

  it('sollte einen Befund aus „Zu entfernen" dulden, aber nicht als aktiv führen', () => {
    const ergebnis = vergleiche({
      codeHosts: [{ host: 'chart.googleapis.com', zeile: 9, datei: 'src/components/GoCardlessConnect.tsx' }],
      register,
      cspHosts: [],
    });
    expect(ergebnis.unbekannt).toEqual([]);
  });

  it('sollte eine tote Registerzeile melden — aktiv, aber nirgends im Code', () => {
    const ergebnis = vergleiche({ codeHosts: [], register, cspHosts: [] });
    const tote = ergebnis.toteZeilen.map((z) => z.host);
    expect(tote).toContain('pbopyawkxxrluhofjtub.supabase.co');
  });

  it('sollte Rolle „Entwicklung" von der Code-Pflicht ausnehmen', () => {
    // GitHub berührt keine Nutzerdaten und taucht in App-Code nicht auf.
    // Eine Code-Pflicht dafür wäre ein Fehlalarm mit Ansage.
    const ergebnis = vergleiche({ codeHosts: [], register, cspHosts: [] });
    expect(ergebnis.toteZeilen.map((z) => z.host)).not.toContain('github.com');
  });

  it('sollte einen Host aus der CSP als Nachweis gelten lassen', () => {
    const ergebnis = vergleiche({
      codeHosts: [],
      register,
      cspHosts: ['pbopyawkxxrluhofjtub.supabase.co'],
    });
    expect(ergebnis.toteZeilen.map((z) => z.host)).not.toContain('pbopyawkxxrluhofjtub.supabase.co');
  });

  it('sollte einen CSP-Eintrag ohne Registerzeile melden', () => {
    const ergebnis = vergleiche({
      codeHosts: [],
      register,
      cspHosts: ['cdn.fremd-analytics.io'],
    });
    expect(ergebnis.unbekannt.map((f) => f.host)).toContain('cdn.fremd-analytics.io');
  });
});

import { describe, it, expect } from 'vitest';
import { findHardcodedStrings } from '../i18n-core.mjs';

/**
 * Wächter-Test für den i18n-Wächter (AGENTS.md §6).
 *
 * Er muss zwei Dinge können, und das zweite ist das schwerere: den echten
 * Verstoß finden UND alles in Ruhe lassen, was nur so aussieht. Ein Wächter mit
 * Fehlalarmen wird abgeschaltet statt befolgt — genau daran ist der
 * Bestandsmodus beim ersten Anlauf fast gescheitert (26 gemeldete Dateien,
 * rund drei Viertel Fehlalarme).
 */
function fund(src, datei = 'src/components/Foo.tsx') {
  return findHardcodedStrings(datei, src);
}

describe('findHardcodedStrings', () => {
  describe('Verstöße in Zeichenketten', () => {
    it('sollte einen deutschen String in einfachen Anführungszeichen finden', () => {
      expect(fund(`<Button title='Speichern' />`)).toHaveLength(1);
    });

    it('sollte einen deutschen String in doppelten Anführungszeichen finden', () => {
      expect(fund(`<Button title="Löschen" />`)).toHaveLength(1);
    });
  });

  describe('Verstöße in Template-Literalen', () => {
    it('[REGRESSION] sollte einen deutschen Text in einem Template-Literal finden', () => {
      // Systematische Lücke bis hierher: Der Wächter suchte nach `"Wort` und
      // `'Wort`. Ein Backtick kam darin nicht vor, also war JEDER interpolierte
      // Text unsichtbar — und interpoliert wird gerade das, was einen Namen
      // oder Betrag einsetzt, also besonders oft echter Bildschirmtext.
      const src = 'const frage = `Schuld „${name}" löschen?`;';
      expect(fund(src)).toHaveLength(1);
    });

    it('[REGRESSION] sollte auch finden, wenn der Text NACH der Interpolation steht', () => {
      const src = 'const text = `${count} Verträge gefunden`;';
      expect(fund(src)).toHaveLength(1);
    });
  });

  describe('Verstöße in JSX-Text', () => {
    it('[REGRESSION] sollte unquotierten Text zwischen zwei Tags finden', () => {
      // Zweite systematische Lücke: `<span>Verträge</span>` steht in gar keinen
      // Anführungszeichen. Der Wächter hat nach Zeichenketten gesucht und
      // deshalb den häufigsten Fall überhaupt nie gesehen.
      expect(fund(`<span>Verträge</span>`)).toHaveLength(1);
    });

    it('sollte Text neben einer Interpolation finden', () => {
      expect(fund(`<span>Verträge ({anzahl})</span>`)).toHaveLength(1);
    });

    it('sollte mehrzeiligen JSX-Text finden', () => {
      const src = `
        <p className="text-sm">
          Mit deinen variablen Ausgaben lässt sich weniger einsparen.
        </p>`;
      expect(fund(src)).toHaveLength(1);
    });
  });

  describe('Kein Fehlalarm', () => {
    it('sollte einen t()-Aufruf in Ruhe lassen', () => {
      expect(fund(`<span>{t('budgetOptimizer.title')}</span>`)).toEqual([]);
    });

    it('sollte eine reine Interpolation in Ruhe lassen', () => {
      expect(fund(`<span>{money.mask(eur.format(betrag))}</span>`)).toEqual([]);
    });

    it('sollte einen Kommentar in Ruhe lassen', () => {
      expect(fund(`// Schuld „${'x'}" löschen? — nur Erklärung`)).toEqual([]);
    });

    it('sollte eine Blockkommentar-Fortsetzung in Ruhe lassen', () => {
      expect(fund(` * Der Nutzer sieht hier „Keine Daten" stehen.`)).toEqual([]);
    });

    it('sollte einen Import in Ruhe lassen', () => {
      expect(fund(`import { Speichern } from './Speichern';`)).toEqual([]);
    });

    it('sollte einen Vergleich auf einen Typwert in Ruhe lassen', () => {
      expect(fund(`if (range === 'Jahr') return 12;`, 'src/lib/x.ts')).toEqual([]);
    });

    it('sollte einen CSS-Klassennamen in Ruhe lassen', () => {
      expect(fund(`<div className="flex items-center gap-2 text-muted-foreground" />`)).toEqual([]);
    });

    it('sollte einen Bezeichner mit Bindestrich in Ruhe lassen', () => {
      expect(fund(`const status = 'not-found';`)).toEqual([]);
    });

    it('sollte das Fallback-Muster mit labelKey in Ruhe lassen', () => {
      const src = `
        { id: 'daten',
          label: 'Daten & Konten',
          labelKey: 'nav.groups.daten' }`;
      expect(fund(src)).toEqual([]);
    });

    it('sollte eine Zahl oder ein Satzzeichen als JSX-Text in Ruhe lassen', () => {
      expect(fund(`<span>·</span>`)).toEqual([]);
      expect(fund(`<span>{'/'}</span>`)).toEqual([]);
      expect(fund(`<td>42</td>`)).toEqual([]);
    });

    it('sollte einen Template-Literal-Pfad ohne Prosa in Ruhe lassen', () => {
      expect(fund('const key = `tank-amount-${year}`;')).toEqual([]);
    });

    it('sollte die Übersetzungsschicht selbst gar nicht erst ansehen', () => {
      expect(fund(`export const de = { a: 'Speichern' };`, 'src/i18n/translations.ts')).toEqual([]);
    });

    it('sollte eine Testdatei nicht ansehen', () => {
      expect(fund(`<span>Verträge</span>`, 'src/components/__tests__/Foo.test.tsx')).toEqual([]);
    });
  });

  describe('Kein Fehlalarm — die fünf Sorten aus dem ersten Bestandslauf', () => {
    // Der erste Lauf über den Bestand meldete 126 Fundstellen. Ein guter Teil
    // davon war Unsinn, und ein Wächter mit Fehlalarmen wird abgeschaltet statt
    // befolgt. Jede dieser Sorten hat deshalb einen eigenen Test.

    it('[REGRESSION] sollte den Pfeil einer Arrow-Funktion nicht für ein JSX-Tag halten', () => {
      // `=>` endet auf `>`. Damit galt alles dahinter als JSX-Text — und das
      // ist bei Callbacks der halbe Quelltext.
      const src = `onError: () => showError(t('settings.saveFailed', 'Fehler beim Speichern')),`;
      expect(fund(src)).toEqual([]);
    });

    it('[REGRESSION] sollte einen Kommentar am Zeilenende nicht als Text lesen', () => {
      expect(fund(`setPathIndex(0); // neue Zelle -> wieder beim Repräsentanten starten`)).toEqual([]);
      expect(fund(`if (t.amount >= 0) return; // nur Ausgaben`)).toEqual([]);
    });

    it('[REGRESSION] sollte eine Tailwind-Klassenliste nicht melden', () => {
      // `disabled:cursor-not-allowed` enthält `not` mit Wortgrenze davor und
      // dahinter — damit meldete der Waechter jede zweite shadcn-Komponente.
      const src = `"peer h-4 w-4 shrink-0 rounded-sm border disabled:cursor-not-allowed disabled:opacity-50"`;
      expect(fund(src, 'src/components/ui/checkbox.tsx')).toEqual([]);
    });

    it('[REGRESSION] sollte einen dynamischen Import-Pfad nicht melden', () => {
      const src = `const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));`;
      expect(fund(src, 'src/App.tsx')).toEqual([]);
    });

    it('[REGRESSION] sollte einen deutschen Typwert als Objektschlüssel nicht melden', () => {
      // `'6 Monate'` und `'1 Jahr'` sind Werte von `DashboardRange` — interne
      // Bezeichner, an den Rändern gemappt.
      expect(fund(`'6 Monate': 183,`, 'src/components/dashboard/filter-utils.ts')).toEqual([]);
      expect(fund(`'1 Jahr': 365,`, 'src/components/dashboard/filter-utils.ts')).toEqual([]);
    });

    it('[REGRESSION] sollte den umbenannten serviceT nicht für Prosa halten', () => {
      // `import { t as translate } from '@/i18n/serviceT'` — in `translate(`
      // steht kein `t` mit Wortgrenze davor, also griff die Erkennung nicht.
      // Der Waechter meldete damit ausgerechnet die uebersetzten Stellen.
      const src = `return translate("analysisData.unassignedAccount", "Sonstiges Konto");`;
      expect(fund(src, 'src/lib/analysis-data.ts')).toEqual([]);
    });

    it('[REGRESSION] sollte eine Tailwind-Klasse mit Arbitrary-Variant nicht melden', () => {
      // `[&>span]:line-clamp-1` und `data-[state=open]:bg-accent` — dieselbe
      // Klassenliste, nur mit den Zeichen, die der erste Filter nicht kannte.
      const src = `"flex h-10 w-full disabled:cursor-not-allowed [&>span]:line-clamp-1 data-[state=open]:bg-accent"`;
      expect(fund(src, 'src/components/ui/select.tsx')).toEqual([]);
    });

    it('[REGRESSION] sollte Entwickler-Meldungen im Logger nicht melden', () => {
      const src = `logger.error('[bank-callback] Initialer Sync nach Kontoverknüpfung fehlgeschlagen.', { err });`;
      expect(fund(src, 'src/services/bank.ts')).toEqual([]);
    });

    it('sollte Test-Hilfsmittel nicht ansehen', () => {
      // `src/test-utils/` beschreibt Zustaende fuer Entwickler, nicht fuer
      // Nutzer — dort steht bewusst deutscher Klartext in `throw`.
      const src = 'throw new Error(`Kein Schalter für die Nav-Funktion "${feature}" im DOM`);';
      expect(fund(src, 'src/test-utils/feature-switch.ts')).toEqual([]);
    });

    it('[REGRESSION] sollte einen MEHRZEILIGEN t()-Aufruf als übersetzt erkennen', () => {
      // Das verbreitetste Muster im Bestand — und die groesste Fehlalarmquelle:
      // Schluessel und Notfassung stehen auf verschiedenen Zeilen. Eine
      // zeilenweise Erkennung sieht nur die Notfassung und meldet sie.
      const src = `
          {t(
            'onboarding.subtitle',
            'Wir blenden dann nur die Bereiche ein, die dazu passen.',
          )}`;
      expect(fund(src)).toEqual([]);
    });

    it('[REGRESSION] sollte den Schlüssel auch erkennen, wenn er ÜBER dem Text steht', () => {
      // `{ labelKey: 'premium.addWidget', label: 'Widget hinzufügen' }` — der
      // Waechter sah nur nach vorn und hat deshalb genau die Haelfte der
      // Fallback-Paare gemeldet.
      const src = `
        labelKey: "premium.addWidget",
        label: "Widget hinzufügen",`;
      expect(fund(src)).toEqual([]);
    });

    it('sollte beliebige *Key/*Fallback-Paare als Notfassung erkennen', () => {
      expect(fund(`
        subtitle: "Tanks für deine Ausgaben",
        subtitleKey: "nav.subtitles.budgets",`)).toEqual([]);
      expect(fund(`
            titleKey="euer.page.linesExpenses"
            titleFallback="Betriebsausgaben (Anlage EÜR)"`)).toEqual([]);
    });

    it('[REGRESSION] sollte eine mehrzeilige console.warn-Meldung nicht melden', () => {
      const src = `
        console.warn('[CategoryTwoStepSelect] Keine Unterkategorien', {
          hint: 'Überprüfe ob Kategorien parent_id haben',
        });`;
      expect(fund(src)).toEqual([]);
    });

    it('sollte einen zweiten t()-Parameter als Notfassung durchgehen lassen', () => {
      // `t('key', 'Fallback')` IST übersetzt — der Text ist nur die Notfassung,
      // falls der Schlüssel fehlt.
      const src = `showError(t('settings.saveFailed', 'Fehler beim Speichern'));`;
      expect(fund(src)).toEqual([]);
    });
  });

  describe('Ausnahmen mit Grund', () => {
    it('[REGRESSION] sollte eine Datei mit „constants" im Pfad NICHT pauschal überspringen', () => {
      // Der alte Wächter hatte `file.includes('constants')` als
      // Pauschal-Filter. Ein Namensfilter mit einem ganzen blinden Fleck
      // dahinter: `src/components/dashboard/filter-constants.ts` enthielt
      // sichtbare Labels, und niemand hat je hingesehen.
      const src = `export const LABEL = 'Keine Daten';`;
      expect(fund(src, 'src/components/dashboard/filter-constants.ts')).toHaveLength(1);
    });

    it('sollte den deutschen Steuerkatalog in Ruhe lassen', () => {
      // §9a EStG ist die Sache selbst, nicht ihre Übersetzung.
      const src = `paragraph: '§9a S. 1 Nr. 1 Buchst. a EStG',`;
      expect(fund(src, 'src/data/tax-catalog.ts')).toEqual([]);
    });
  });

  describe('Meldung', () => {
    it('sollte Zeilennummer und Fundstelle melden', () => {
      const src = `zeile1\nzeile2\n<span>Verträge</span>`;
      const [treffer] = fund(src);
      expect(treffer.line).toBe(3);
      expect(treffer.kind).toBe('jsx-text');
    });
  });
});

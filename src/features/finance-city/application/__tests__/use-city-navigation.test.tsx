import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { cityDemoModel } from '../../data/city-demo-data';
import type { CityModel } from '../city-view-model';
import { useCityNavigation } from '../use-city-navigation';

// Kanonische Demo-Fixture (Streaming hängt dort bereits als Unterkategorie
// unter "Freizeit" mit den vier Verträgen). Modul-Konstante für die
// actions-Referenzstabilität (Test 12).
const CITY_DEMO_MODEL: CityModel = cityDemoModel;

const LABELS = { city: 'Stadt' };

function renderCityNavigation() {
  return renderHook(() => useCityNavigation(CITY_DEMO_MODEL, LABELS));
}

describe('useCityNavigation', () => {
  it('sollte initial Stadt-Ebene ohne Fokus mit fit-city-Intent zeigen', () => {
    const { result } = renderCityNavigation();

    expect(result.current.level).toBe('city');
    expect(result.current.focusDistrictId).toBeNull();
    expect(result.current.activeDistrictId).toBeNull();
    expect(result.current.activeSubcategoryId).toBeNull();
    expect(result.current.selectedContractId).toBeNull();
    expect(result.current.cameraIntent.kind).toBe('fit-city');
    expect(result.current.cameraIntent.targetId).toBeNull();
    expect(result.current.breadcrumb).toEqual([{ level: 'city', id: null, label: 'Stadt' }]);
  });

  it('sollte beim ersten Viertel-Tap fokussieren ohne einzutauchen (level bleibt city, KEIN Popup-State, intent focus-district, Breadcrumb Stadt→Freizeit)', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });

    expect(result.current.level).toBe('city');
    expect(result.current.focusDistrictId).toBe('leisure');
    expect(result.current.activeDistrictId).toBeNull();
    expect(result.current.selectedContractId).toBeNull();
    expect(result.current.cameraIntent.kind).toBe('focus-district');
    expect(result.current.cameraIntent.targetId).toBe('leisure');
    expect(result.current.breadcrumb.map((entry) => entry.label)).toEqual(['Stadt', 'Freizeit']);
  });

  it('sollte beim zweiten Tap auf das fokussierte Viertel eintauchen (level district, intent enter-district)', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });

    expect(result.current.level).toBe('district');
    expect(result.current.activeDistrictId).toBe('leisure');
    expect(result.current.focusDistrictId).toBe('leisure');
    expect(result.current.cameraIntent.kind).toBe('enter-district');
    expect(result.current.cameraIntent.targetId).toBe('leisure');
  });

  it('sollte bei Tap auf anderes Viertel im Fokus nur den Fokus wechseln', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('housing');
    });

    expect(result.current.level).toBe('city');
    expect(result.current.focusDistrictId).toBe('housing');
    expect(result.current.activeDistrictId).toBeNull();
    expect(result.current.cameraIntent.kind).toBe('focus-district');
    expect(result.current.cameraIntent.targetId).toBe('housing');
  });

  it('sollte Unterkategorie-Tap nur in Viertel-Ebene akzeptieren (in city-Ebene no-op)', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });

    expect(result.current.level).toBe('city');
    expect(result.current.activeSubcategoryId).toBeNull();
    expect(result.current.cameraIntent.seq).toBe(1);
  });

  it('sollte Streaming-Tap in Ebene 3 wechseln (Breadcrumb Stadt→Freizeit→Streaming)', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });

    expect(result.current.level).toBe('subcategory');
    expect(result.current.activeSubcategoryId).toBe('streaming');
    expect(result.current.cameraIntent.kind).toBe('enter-subcategory');
    expect(result.current.breadcrumb.map((entry) => entry.label)).toEqual(['Stadt', 'Freizeit', 'Streaming']);
  });

  it('sollte Vertrags-Tap nur in Ebene 3 selectedContractId setzen und Ebenenwechsel ihn nullen', () => {
    const { result } = renderCityNavigation();

    // Stadt-Ebene: kein aktiver Distrikt/keine Unterkategorie -> no-op.
    act(() => {
      result.current.actions.tapContract('netflix');
    });
    expect(result.current.selectedContractId).toBeNull();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });

    // Distrikt-Ebene: noch keine Unterkategorie betreten -> no-op.
    act(() => {
      result.current.actions.tapContract('netflix');
    });
    expect(result.current.selectedContractId).toBeNull();

    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });
    act(() => {
      result.current.actions.tapContract('netflix');
    });
    expect(result.current.selectedContractId).toBe('netflix');

    act(() => {
      result.current.actions.closeContract();
    });
    expect(result.current.selectedContractId).toBeNull();

    act(() => {
      result.current.actions.tapContract('netflix');
    });
    expect(result.current.selectedContractId).toBe('netflix');

    // Ebenenwechsel (Zoom raus) muss die BottomSheet-Auswahl nullen.
    act(() => {
      result.current.actions.zoomOutStep();
    });
    expect(result.current.selectedContractId).toBeNull();
  });

  it('sollte zoomOutStep die Ebenen rückwärts durchlaufen (subcategory→district→city+Fokus gelöst)', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });

    act(() => {
      result.current.actions.zoomOutStep();
    });
    expect(result.current.level).toBe('district');
    expect(result.current.activeDistrictId).toBe('leisure');
    expect(result.current.activeSubcategoryId).toBeNull();
    expect(result.current.cameraIntent.kind).toBe('enter-district');

    act(() => {
      result.current.actions.zoomOutStep();
    });
    expect(result.current.level).toBe('city');
    expect(result.current.activeDistrictId).toBeNull();
    expect(result.current.focusDistrictId).toBeNull();
    expect(result.current.cameraIntent.kind).toBe('fit-city');
  });

  it('sollte Breadcrumb-goTo auf Freizeit aus Ebene 3 zurück in die Viertel-Ebene führen', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });

    act(() => {
      result.current.actions.goTo('district', 'leisure');
    });

    expect(result.current.level).toBe('district');
    expect(result.current.activeDistrictId).toBe('leisure');
    expect(result.current.activeSubcategoryId).toBeNull();
    expect(result.current.selectedContractId).toBeNull();
    expect(result.current.breadcrumb.map((entry) => entry.label)).toEqual(['Stadt', 'Freizeit']);
  });

  it('[REGRESSION] sollte cameraIntent.seq bei jedem Intent strikt monoton erhöhen und bei no-ops NICHT erhöhen', () => {
    const { result } = renderCityNavigation();
    const seqs: number[] = [result.current.cameraIntent.seq];

    act(() => {
      result.current.actions.tapDistrict('leisure'); // Fokuswechsel -> Flug
    });
    seqs.push(result.current.cameraIntent.seq);

    act(() => {
      result.current.actions.tapDistrict('leisure'); // Eintauchen -> Flug
    });
    seqs.push(result.current.cameraIntent.seq);

    const seqBeforeNoops = result.current.cameraIntent.seq;
    act(() => {
      result.current.actions.tapDistrict('leisure'); // schon drin -> no-op
    });
    expect(result.current.cameraIntent.seq).toBe(seqBeforeNoops);

    act(() => {
      result.current.actions.tapSubcategory('does-not-exist'); // ungültige ID -> no-op
    });
    expect(result.current.cameraIntent.seq).toBe(seqBeforeNoops);

    act(() => {
      result.current.actions.tapSubcategory('streaming'); // Eintauchen -> Flug
    });
    seqs.push(result.current.cameraIntent.seq);

    act(() => {
      result.current.actions.tapContract('netflix'); // reine Sheet-Auswahl -> KEIN Flug
    });
    expect(result.current.cameraIntent.seq).toBe(seqs[seqs.length - 1]);

    act(() => {
      result.current.actions.closeContract(); // reine Sheet-Auswahl -> KEIN Flug
    });
    expect(result.current.cameraIntent.seq).toBe(seqs[seqs.length - 1]);

    act(() => {
      result.current.actions.zoomOutStep(); // subcategory -> district -> Flug
    });
    seqs.push(result.current.cameraIntent.seq);

    act(() => {
      result.current.actions.reset(); // Reset -> Flug
    });
    seqs.push(result.current.cameraIntent.seq);

    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]).toBe(seqs[i - 1] + 1);
    }
  });

  it('sollte ungültige IDs ignorieren', () => {
    const { result } = renderCityNavigation();

    act(() => {
      result.current.actions.tapDistrict('does-not-exist');
    });
    expect(result.current.level).toBe('city');
    expect(result.current.focusDistrictId).toBeNull();
    expect(result.current.cameraIntent.seq).toBe(1);

    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    act(() => {
      result.current.actions.tapDistrict('leisure');
    });
    const seqBefore = result.current.cameraIntent.seq;

    act(() => {
      result.current.actions.tapSubcategory('does-not-exist');
    });
    expect(result.current.activeSubcategoryId).toBeNull();
    expect(result.current.cameraIntent.seq).toBe(seqBefore);

    act(() => {
      result.current.actions.goTo('district', 'does-not-exist');
    });
    expect(result.current.activeDistrictId).toBe('leisure');
    expect(result.current.cameraIntent.seq).toBe(seqBefore);

    act(() => {
      result.current.actions.tapSubcategory('streaming');
    });
    act(() => {
      result.current.actions.tapContract('does-not-exist');
    });
    expect(result.current.selectedContractId).toBeNull();
  });

  it('sollte actions referenzstabil halten (Object.is über Rerender)', () => {
    const { result, rerender } = renderCityNavigation();
    const before = result.current.actions;

    rerender();

    expect(Object.is(result.current.actions, before)).toBe(true);
    expect(Object.is(result.current.actions.tapDistrict, before.tapDistrict)).toBe(true);
    expect(Object.is(result.current.actions.tapSubcategory, before.tapSubcategory)).toBe(true);
    expect(Object.is(result.current.actions.tapContract, before.tapContract)).toBe(true);
    expect(Object.is(result.current.actions.closeContract, before.closeContract)).toBe(true);
    expect(Object.is(result.current.actions.goTo, before.goTo)).toBe(true);
    expect(Object.is(result.current.actions.zoomOutStep, before.zoomOutStep)).toBe(true);
    expect(Object.is(result.current.actions.reset, before.reset)).toBe(true);
  });

  describe('Model-Resync (WP-D3, geschrumpftes Live-Model)', () => {
    // `model` kommt seit WP-C8 aus Live-Queries und kann Distrikte/Unter-
    // kategorien verlieren (letzte Buchung einer Kategorie gelöscht/um-
    // kategorisiert), während der Nutzer bereits eingetaucht ist. Ohne Abgleich
    // bliebe der Navigations-State auf einer toten ID stehen: buildCityLayout
    // filtert leer, computeFocusBounds liefert null -> leere, nicht mehr
    // existierende Ansicht.
    function districtModel(id: string, subs: { id: string; amount: number }[]): CityModel['districts'][number] {
      return {
        id,
        label: id.toUpperCase(),
        total: subs.reduce((sum, s) => sum + s.amount, 0),
        color: '#123456',
        subcategories: subs.map((s) => ({ id: s.id, label: s.id, amount: s.amount })),
      };
    }
    function renderWithModel(model: CityModel) {
      return renderHook(({ m }) => useCityNavigation(m, LABELS), { initialProps: { m: model } });
    }

    it('[REGRESSION] sollte auf Stadt zurückfallen, wenn der eingetauchte Distrikt aus dem Model verschwindet', () => {
      const full: CityModel = { districts: [districtModel('a', [{ id: 'a1', amount: 100 }]), districtModel('b', [{ id: 'b1', amount: 50 }])] };
      const { result, rerender } = renderWithModel(full);

      act(() => result.current.actions.tapDistrict('a')); // fokussieren
      act(() => result.current.actions.tapDistrict('a')); // eintauchen
      expect(result.current.level).toBe('district');
      const seqBefore = result.current.cameraIntent.seq;

      rerender({ m: { districts: full.districts.filter((d) => d.id !== 'a') } });

      expect(result.current.level).toBe('city');
      expect(result.current.focusDistrictId).toBeNull();
      expect(result.current.activeDistrictId).toBeNull();
      expect(result.current.cameraIntent.kind).toBe('fit-city');
      expect(result.current.cameraIntent.seq).toBeGreaterThan(seqBefore);
      // Breadcrumb zeigt nicht mehr die tote ID.
      expect(result.current.breadcrumb).toEqual([{ level: 'city', id: null, label: 'Stadt' }]);
    });

    it('[REGRESSION] sollte auf Distrikt zurückfallen, wenn die eingetauchte Unterkategorie verschwindet (Distrikt bleibt)', () => {
      const full: CityModel = { districts: [districtModel('a', [{ id: 's1', amount: 60 }, { id: 's2', amount: 40 }])] };
      const { result, rerender } = renderWithModel(full);

      act(() => result.current.actions.tapDistrict('a'));
      act(() => result.current.actions.tapDistrict('a'));
      act(() => result.current.actions.tapSubcategory('s1'));
      expect(result.current.level).toBe('subcategory');

      rerender({ m: { districts: [districtModel('a', [{ id: 's2', amount: 40 }])] } }); // s1 weg

      expect(result.current.level).toBe('district');
      expect(result.current.activeDistrictId).toBe('a');
      expect(result.current.activeSubcategoryId).toBeNull();
      expect(result.current.cameraIntent.kind).toBe('enter-district');
    });

    it('sollte den Navigations-State unverändert lassen, wenn eine Model-Änderung den aktuellen Fokus nicht betrifft (kein Flug-Neustart)', () => {
      const full: CityModel = { districts: [districtModel('a', [{ id: 'a1', amount: 100 }]), districtModel('b', [{ id: 'b1', amount: 50 }])] };
      const { result, rerender } = renderWithModel(full);

      act(() => result.current.actions.tapDistrict('a'));
      act(() => result.current.actions.tapDistrict('a'));
      const seqBefore = result.current.cameraIntent.seq;

      // 'b' ändert nur seinen Betrag, 'a' (der Fokus) bleibt unberührt.
      rerender({ m: { districts: [full.districts[0], districtModel('b', [{ id: 'b1', amount: 5 }])] } });

      expect(result.current.level).toBe('district');
      expect(result.current.activeDistrictId).toBe('a');
      expect(result.current.cameraIntent.seq).toBe(seqBefore); // kein neuer Intent
    });
  });
});

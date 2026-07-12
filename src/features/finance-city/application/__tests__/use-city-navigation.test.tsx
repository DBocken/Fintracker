import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CITY_DISTRICTS_DEMO_DATA, CITY_STREAMING_CONTRACTS_DEMO_DATA } from '../../data/city-demo-data';
import type { CityModel } from '../city-view-model';
import { useCityNavigation } from '../use-city-navigation';

/**
 * Fixture: projiziert die vorhandene Demo-Fixture (`data/city-demo-data.ts`)
 * auf das generische `CityModel`-Shape des Navigations-Hooks. "Streaming" ist
 * dort bewusst KEINE reguläre Unterkategorie-Fixture-Zeile, sondern ein
 * separates Array (`CITY_STREAMING_CONTRACTS_DEMO_DATA`) — für die Tests wird
 * es hier als zusätzliche Unterkategorie unter "Freizeit" eingehängt, wie es
 * das README beschreibt (Ebene 3 = "einzelne Unterkategorie ODER
 * Streaming-Vertrag als Gebäude"). Modul-Konstante (kein Fabrik-Aufruf pro
 * Test) für Referenzstabilität — sonst würde jeder Test-Render ein neues
 * `model`-Objekt sehen und die `actions`-Referenzstabilität (Test 12) künstlich
 * brechen.
 */
const CITY_DEMO_MODEL: CityModel = {
  districts: CITY_DISTRICTS_DEMO_DATA.map((district) => ({
    id: district.id,
    label: district.name,
    subcategories: [
      ...district.subcategories.map((subcategory) => ({ id: subcategory.id, label: subcategory.name })),
      ...(district.id === 'leisure'
        ? [
            {
              id: 'streaming',
              label: 'Streaming',
              contracts: CITY_STREAMING_CONTRACTS_DEMO_DATA.map((contract) => ({
                id: contract.id,
                label: contract.name,
              })),
            },
          ]
        : []),
    ],
  })),
};

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
});

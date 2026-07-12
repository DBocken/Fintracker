import { useCallback, useMemo, useState } from 'react';
import type {
  CityBreadcrumbEntry,
  CityCameraIntent,
  CityCameraIntentKind,
  CityContractModel,
  CityDistrictModel,
  CityLevel,
  CityModel,
  CityNavigationViewModel,
  CitySubcategoryModel,
} from './city-view-model';

/**
 * Navigations-Zustandsmaschine der Finanzstadt (WP-C2). Reiner React-State
 * (`useState`/`useCallback`/`useMemo`) — KEIN three.js, KEIN TanStack Query,
 * KEIN Router (README-Architekturtabelle, `application/`-Zeile). i18n-frei:
 * das Stadt-Label kommt als aufgelöster String über `labels.city`, alle
 * anderen Labels (Distrikt/Unterkategorie/Vertrag) stammen bereits aufgelöst
 * aus `model` — die Page löst i18n-Keys auf, dieser Hook konsumiert nur
 * Strings.
 */

interface CityNavigationState {
  level: CityLevel;
  focusDistrictId: string | null;
  activeDistrictId: string | null;
  activeSubcategoryId: string | null;
  selectedContractId: string | null;
  cameraIntent: CityCameraIntent;
}

function createInitialState(): CityNavigationState {
  return {
    level: 'city',
    focusDistrictId: null,
    activeDistrictId: null,
    activeSubcategoryId: null,
    selectedContractId: null,
    cameraIntent: { seq: 1, kind: 'fit-city', targetId: null },
  };
}

/** `seq` erhöht sich strikt monoton bei JEDEM neuen Intent (Kamera-Regel: Kamera-Controller/WP-C4 reagiert auf `seq`-Änderung, fliegt aber nie doppelt denselben Intent). */
function nextIntent(prev: CityCameraIntent, kind: CityCameraIntentKind, targetId: string | null): CityCameraIntent {
  return { seq: prev.seq + 1, kind, targetId };
}

function findDistrict(model: CityModel, id: string | null): CityDistrictModel | undefined {
  if (id === null) return undefined;
  return model.districts.find((district) => district.id === id);
}

function findSubcategory(district: CityDistrictModel | undefined, id: string | null): CitySubcategoryModel | undefined {
  if (id === null || !district) return undefined;
  return district.subcategories.find((subcategory) => subcategory.id === id);
}

function findContract(subcategory: CitySubcategoryModel | undefined, id: string): CityContractModel | undefined {
  return subcategory?.contracts?.find((contract) => contract.id === id);
}

/**
 * UI-neutrale Ebenen-Navigation Stadt → Distrikt → Unterkategorie
 * (`src/features/finance-city/README.md` §"Die 3 Ebenen"). `model` und
 * `labels` sollten über Renderzyklen referenzstabil bleiben (z. B. via
 * `useMemo`/Modul-Konstante beim Aufrufer) — sonst verlieren die `actions`
 * ihre Referenzstabilität, weil Validierungen gegen `model` laufen.
 */
export function useCityNavigation(model: CityModel, labels: { city: string }): CityNavigationViewModel {
  const [state, setState] = useState<CityNavigationState>(createInitialState);

  const tapDistrict = useCallback(
    (id: string) => {
      setState((prev) => {
        if (!findDistrict(model, id)) return prev;

        if (prev.level !== 'city') {
          // Distrikt-Taps sind laut Interaktionsmodell eine Stadt-Ebenen-Geste
          // (Ebene 1: Fokus). In Distrikt-/Unterkategorie-Ebene ist der
          // Distrikt bereits betreten -> No-op.
          return prev;
        }

        if (prev.focusDistrictId !== id) {
          // Noch nicht fokussiert (oder anderer Distrikt fokussiert) -> Fokuswechsel, Ebene bleibt city.
          return {
            ...prev,
            focusDistrictId: id,
            activeDistrictId: null,
            activeSubcategoryId: null,
            selectedContractId: null,
            cameraIntent: nextIntent(prev.cameraIntent, 'focus-district', id),
          };
        }

        // Bereits fokussiert -> zweiter Tap taucht ein.
        return {
          ...prev,
          level: 'district',
          activeDistrictId: id,
          activeSubcategoryId: null,
          selectedContractId: null,
          cameraIntent: nextIntent(prev.cameraIntent, 'enter-district', id),
        };
      });
    },
    [model],
  );

  const tapSubcategory = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.level !== 'district' || !prev.activeDistrictId) return prev;
        const district = findDistrict(model, prev.activeDistrictId);
        if (!findSubcategory(district, id)) return prev;

        return {
          ...prev,
          level: 'subcategory',
          activeSubcategoryId: id,
          selectedContractId: null,
          cameraIntent: nextIntent(prev.cameraIntent, 'enter-subcategory', id),
        };
      });
    },
    [model],
  );

  const tapContract = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.level !== 'subcategory' || !prev.activeDistrictId || !prev.activeSubcategoryId) return prev;
        const district = findDistrict(model, prev.activeDistrictId);
        const subcategory = findSubcategory(district, prev.activeSubcategoryId);
        if (!findContract(subcategory, id)) return prev;
        if (prev.selectedContractId === id) return prev;

        // Reine Sheet-Auswahl -> kein neuer Kamera-Intent (kein Flug für ein Popup).
        return { ...prev, selectedContractId: id };
      });
    },
    [model],
  );

  const closeContract = useCallback(() => {
    setState((prev) => (prev.selectedContractId === null ? prev : { ...prev, selectedContractId: null }));
  }, []);

  const goTo = useCallback(
    (level: CityLevel, id?: string) => {
      setState((prev) => {
        if (level === 'city') {
          // Bewusst KEIN Fokus-Erhalt (anders als eine reine Ebenen-Rückstufung):
          // Breadcrumb "Stadt" = Gesamtansicht. Eigener Intent-Kind ggü. reset()
          // ('fit-city' statt 'reset'), auch wenn der State-Übergang identisch ist.
          return {
            level: 'city',
            focusDistrictId: null,
            activeDistrictId: null,
            activeSubcategoryId: null,
            selectedContractId: null,
            cameraIntent: nextIntent(prev.cameraIntent, 'fit-city', null),
          };
        }

        if (level === 'district') {
          if (!id || !findDistrict(model, id)) return prev;
          return {
            level: 'district',
            focusDistrictId: id,
            activeDistrictId: id,
            activeSubcategoryId: null,
            selectedContractId: null,
            cameraIntent: nextIntent(prev.cameraIntent, 'enter-district', id),
          };
        }

        // level === 'subcategory': Ziel-Distrikt ist der aktuell aktive/fokussierte
        // (Breadcrumb-Einträge existieren nur im Kontext ihres Eltern-Distrikts).
        const districtId = prev.activeDistrictId ?? prev.focusDistrictId;
        const district = findDistrict(model, districtId);
        if (!id || !districtId || !findSubcategory(district, id)) return prev;

        return {
          level: 'subcategory',
          focusDistrictId: districtId,
          activeDistrictId: districtId,
          activeSubcategoryId: id,
          selectedContractId: null,
          cameraIntent: nextIntent(prev.cameraIntent, 'enter-subcategory', id),
        };
      });
    },
    [model],
  );

  const zoomOutStep = useCallback(() => {
    setState((prev) => {
      if (prev.level === 'subcategory') {
        return {
          ...prev,
          level: 'district',
          activeSubcategoryId: null,
          selectedContractId: null,
          cameraIntent: nextIntent(prev.cameraIntent, 'enter-district', prev.activeDistrictId),
        };
      }

      if (prev.level === 'district') {
        return {
          level: 'city',
          focusDistrictId: null,
          activeDistrictId: null,
          activeSubcategoryId: null,
          selectedContractId: null,
          cameraIntent: nextIntent(prev.cameraIntent, 'fit-city', null),
        };
      }

      // Bereits auf Stadt-Ebene -> nichts weiter zu tun.
      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      level: 'city',
      focusDistrictId: null,
      activeDistrictId: null,
      activeSubcategoryId: null,
      selectedContractId: null,
      cameraIntent: nextIntent(prev.cameraIntent, 'reset', null),
    }));
  }, []);

  const actions = useMemo(
    () => ({ tapDistrict, tapSubcategory, tapContract, closeContract, goTo, zoomOutStep, reset }),
    [tapDistrict, tapSubcategory, tapContract, closeContract, goTo, zoomOutStep, reset],
  );

  const breadcrumb = useMemo<CityBreadcrumbEntry[]>(() => {
    const entries: CityBreadcrumbEntry[] = [{ level: 'city', id: null, label: labels.city }];

    if (state.focusDistrictId) {
      const district = findDistrict(model, state.focusDistrictId);
      entries.push({
        level: 'district',
        id: state.focusDistrictId,
        label: district?.label ?? state.focusDistrictId,
      });

      if (state.activeSubcategoryId) {
        const subcategory = findSubcategory(district, state.activeSubcategoryId);
        entries.push({
          level: 'subcategory',
          id: state.activeSubcategoryId,
          label: subcategory?.label ?? state.activeSubcategoryId,
        });
      }
    }

    return entries;
  }, [model, labels.city, state.focusDistrictId, state.activeSubcategoryId]);

  return {
    level: state.level,
    focusDistrictId: state.focusDistrictId,
    activeDistrictId: state.activeDistrictId,
    activeSubcategoryId: state.activeSubcategoryId,
    selectedContractId: state.selectedContractId,
    breadcrumb,
    cameraIntent: state.cameraIntent,
    actions,
  };
}

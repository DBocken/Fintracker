import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { createRef } from 'react';
import * as THREE from 'three';
import { renderWithI18n } from '@/test-utils/render';
import { CityLabels, type CityLabelsHandle } from '../CityLabels';
import type { CityLabel } from '../../domain/city-labels';

/**
 * Deterministischer Fake-Kamera-Stub: `THREE.Vector3.project(camera)` liest
 * NUR `camera.matrixWorldInverse`/`camera.projectionMatrix` — mit zwei
 * Identitätsmatrizen ist die projizierte NDC-Position exakt der `anchor`
 * (kein echter WebGL-Kontext/keine Renderer-Instanz nötig).
 */
function identityCamera(): THREE.PerspectiveCamera {
  return {
    matrixWorldInverse: new THREE.Matrix4(),
    projectionMatrix: new THREE.Matrix4(),
  } as unknown as THREE.PerspectiveCamera;
}

function makeLabel(id: string, x: number, y: number, z: number, priority = 1): CityLabel {
  return { id, text: `Label ${id}`, amount: priority, anchor: { x, y, z }, priority };
}

describe.each(['de', 'en'] as const)('CityLabels (%s)', (locale) => {
  it('sollte die projizierten Labels rendern', () => {
    const labels = [makeLabel('a', 0, 0, 0, 3), makeLabel('b', 0.6, 0, 0, 2)];
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(2);
  });

  it('sollte Labels hinter der Kamera (NDC z > 1) NICHT rendern', () => {
    const labels = [makeLabel('front', 0, 0, 0, 5), makeLabel('behind', 0, 0, 2, 5)];
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    const rendered = [...container.querySelectorAll('[data-testid="city-label"]')].map((el) =>
      el.getAttribute('data-label-id'),
    );
    expect(rendered).toEqual(['front']);
  });

  it('sollte maxVisible als harte Obergrenze respektieren', () => {
    const labels = Array.from({ length: 5 }, (_, i) => makeLabel(`l${i}`, -0.9 + i * 0.5, 0, 0, 5 - i));
    const ref = createRef<CityLabelsHandle>();
    const { container } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={2} />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(container.querySelectorAll('[data-testid="city-label"]')).toHaveLength(2);
  });

  it('sollte den Namen und den formatierten Betrag anzeigen', () => {
    const labels = [{ id: 'rent', text: 'Miete', amount: 980, anchor: { x: 0, y: 0, z: 0 }, priority: 980 }];
    const ref = createRef<CityLabelsHandle>();
    const { getByTestId } = renderWithI18n(
      <CityLabels ref={ref} labels={labels} canvasSize={{ width: 800, height: 600 }} maxVisible={10} />,
      locale,
    );

    act(() => ref.current?.reproject(identityCamera()));

    expect(getByTestId('city-label').textContent).toContain('Miete');
    expect(getByTestId('city-label').textContent).toContain('980,00');
  });

  it('sollte den Label-Container mit pointer-events-none rendern (Taps fallen durch auf den Canvas)', () => {
    const ref = createRef<CityLabelsHandle>();
    const { getByTestId } = renderWithI18n(
      <CityLabels ref={ref} labels={[]} canvasSize={{ width: 800, height: 600 }} maxVisible={10} />,
      locale,
    );

    expect(getByTestId('city-labels-layer')).toHaveClass('pointer-events-none');
  });
});

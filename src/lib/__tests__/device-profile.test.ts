import { describe, it, expect } from 'vitest';
import { classifyDevice, type DeviceProfile } from '../device-profile';

/**
 * Gemeinsame Geräteeinstufung (WP-7.7).
 *
 * Die Heuristik stand bisher nur in `finance-city/domain/city-quality.ts` und
 * galt damit ausschließlich für die WebGL-Stadt. WP-7.7 braucht dieselbe
 * Einstufung für die Bewegungssprache der ganzen App — geteilt statt
 * nachgebaut, sonst driften zwei Wahrheiten darüber auseinander, was ein
 * schwaches Gerät ist.
 */
const DESKTOP: DeviceProfile = {
  devicePixelRatio: 1,
  hardwareConcurrency: 12,
  deviceMemoryGb: 16,
  coarsePointer: false,
  viewportWidth: 1440,
};

const PHONE: DeviceProfile = {
  devicePixelRatio: 3,
  hardwareConcurrency: 8,
  deviceMemoryGb: 6,
  coarsePointer: true,
  viewportWidth: 390,
};

const WEAK_PHONE: DeviceProfile = {
  devicePixelRatio: 2,
  hardwareConcurrency: 4,
  deviceMemoryGb: 2,
  coarsePointer: true,
  viewportWidth: 360,
};

describe('classifyDevice', () => {
  it('sollte einen kräftigen Desktop als stark einstufen', () => {
    expect(classifyDevice(DESKTOP)).toBe('strong');
  });

  it('sollte ein starkes Telefon als Telefon und nicht als schwach einstufen', () => {
    expect(classifyDevice(PHONE)).toBe('phone');
  });

  it('sollte wenige Kerne als schwach einstufen', () => {
    expect(classifyDevice(WEAK_PHONE)).toBe('weak');
  });

  it('sollte wenig Arbeitsspeicher als schwach einstufen', () => {
    expect(classifyDevice({ ...DESKTOP, deviceMemoryGb: 2 })).toBe('weak');
  });

  it('sollte einen ausdrücklichen Sparsamkeitswunsch als schwach einstufen', () => {
    // saveData ist eine Nutzeraussage, keine Messung — sie schlägt jede Hardware.
    expect(classifyDevice({ ...DESKTOP, saveData: true })).toBe('weak');
  });

  it('sollte fehlende Angaben NICHT als schwach werten', () => {
    // deviceMemory/connection fehlen in Safari und Firefox komplett. Wer sie
    // als 0 läse, würde dort jedem Nutzer die sparsamste Stufe geben.
    expect(classifyDevice({ devicePixelRatio: 1, viewportWidth: 1440 })).toBe('strong');
  });

  it('sollte ein breites Touch-Gerät (Tablet) nicht als Telefon einstufen', () => {
    expect(classifyDevice({ ...PHONE, viewportWidth: 1024 })).toBe('strong');
  });
});

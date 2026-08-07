/**
 * WP-8.4 — Restmigration: Ladezustand des Backup-Bereichs.
 *
 * Bis hierher stand an dieser Stelle ein kreisendes Symbol. Die Regel aus
 * WP-7.3 gilt aber auch hier: Ein Spinner sagt „es passiert etwas", ein
 * Skelett sagt „hier kommt eine Übersicht aus vier Kennzahlen". Nur das
 * Zweite lässt den Nutzer schon lesen, wofür er wartet — und nur das Zweite
 * hält die Blockhöhe stabil, statt sie beim Umschalten springen zu lassen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const getBackupInfo = vi.fn();

vi.mock('@/services/backup-service', () => ({
  backupService: {
    // Nie aufgelöst: Der Ladezustand ist der Prüfgegenstand, nicht sein Ende.
    getBackupInfo: () => getBackupInfo(),
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  },
}));

import { BackupManager } from '../BackupManager';

describe('BackupManager — Ladezustand (WP-8.4)', () => {
  beforeEach(() => {
    getBackupInfo.mockReturnValue(new Promise(() => {}));
  });

  it('sollte statt eines Spinners ein Skelett in Form der Kennzahlen zeigen', async () => {
    const { container } = renderWithProviders(<BackupManager />, { query: true });

    // Die Choreografie zeigt bewusst erst nach 150 ms etwas — vorher wäre es
    // ein Blinzeln. Deshalb hier auf das Erscheinen warten.
    const skeleton = await screen.findByTestId('backup-info-skeleton');
    expect(skeleton).toBeInTheDocument();

    // Gegenprobe: Genau das kreisende Symbol darf hier nicht mehr stehen.
    // Ohne diese Zusicherung bestünde der Test auch, wenn beides da wäre.
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { SnapshotVersionConflictDialog } from '../SnapshotVersionConflictDialog';
import type { SnapshotVersionComparison } from '@/services/snapshot-sync-service';

const comparison: SnapshotVersionComparison = {
  requiresConfirmation: true,
  isForeignDevice: false,
  local: { version: 5, createdAt: '2026-08-01T10:00:00.000Z', deviceId: 'device-a' },
  remote: { version: 3, createdAt: '2026-07-20T10:00:00.000Z', deviceId: 'device-a' },
};

describe('SnapshotVersionConflictDialog', () => {
  it('sollte Gerätestand und Dateistand mit je eigenem Datum zeigen (de)', () => {
    renderWithI18n(
      <SnapshotVersionConflictDialog comparison={comparison} open onConfirm={vi.fn()} onCancel={vi.fn()} />,
      'de',
    );

    const localDate = new Date(comparison.local.createdAt!).toLocaleDateString('de-DE');
    const remoteDate = new Date(comparison.remote.createdAt!).toLocaleDateString('de-DE');
    expect(localDate).not.toBe(remoteDate);

    expect(screen.getByText(new RegExp(localDate.replace('.', '\\.')))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(remoteDate.replace('.', '\\.')))).toBeInTheDocument();
    expect(screen.getByText('Stand auf diesem Gerät')).toBeInTheDocument();
    expect(screen.getByText('Stand in der Datei')).toBeInTheDocument();
  });

  it('sollte Gerätestand und Dateistand mit je eigenem Datum zeigen (en)', () => {
    renderWithI18n(
      <SnapshotVersionConflictDialog comparison={comparison} open onConfirm={vi.fn()} onCancel={vi.fn()} />,
      'en',
    );

    const localDate = new Date(comparison.local.createdAt!).toLocaleDateString('en-US');
    const remoteDate = new Date(comparison.remote.createdAt!).toLocaleDateString('en-US');
    expect(localDate).not.toBe(remoteDate);

    expect(screen.getByText(new RegExp(localDate.replace(/\//g, '\\/')))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(remoteDate.replace(/\//g, '\\/')))).toBeInTheDocument();
    expect(screen.getByText('State on this device')).toBeInTheDocument();
    expect(screen.getByText('State in the file')).toBeInTheDocument();
  });

  it('sollte bei einem fremden Gerät den entsprechenden Hinweistext zeigen', () => {
    const foreignComparison: SnapshotVersionComparison = { ...comparison, isForeignDevice: true };
    renderWithI18n(
      <SnapshotVersionConflictDialog comparison={foreignComparison} open onConfirm={vi.fn()} onCancel={vi.fn()} />,
      'de',
    );

    expect(screen.getByText(/stammt von einem anderen Gerät/)).toBeInTheDocument();
  });

  it('sollte "unbekannt" zeigen, wenn kein lokaler Stand bekannt ist', () => {
    const unknownLocal: SnapshotVersionComparison = {
      ...comparison,
      local: { version: 0, createdAt: null, deviceId: null },
    };
    renderWithI18n(
      <SnapshotVersionConflictDialog comparison={unknownLocal} open onConfirm={vi.fn()} onCancel={vi.fn()} />,
      'de',
    );

    expect(screen.getByText('unbekannt')).toBeInTheDocument();
  });
});

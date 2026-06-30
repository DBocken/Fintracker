import type { AppId, AppRegistration } from './types';

/** Trailing-Slash entfernen; Origins kommen sonst kanonisch vom Browser. */
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/**
 * Bindet App-Identitäten an genau einen Origin. Herzstück der
 * Confused-Deputy-Abwehr: Eine Nachricht, die behauptet von "fintrack" zu
 * kommen, wird nur akzeptiert, wenn sie wirklich vom gebundenen FinTrack-Origin
 * stammt.
 */
export class AppRegistry {
  private readonly originByApp = new Map<AppId, string>();
  private readonly appByOrigin = new Map<string, AppId>();

  constructor(registrations: AppRegistration[] = []) {
    for (const reg of registrations) this.register(reg);
  }

  register(reg: AppRegistration): void {
    const origin = normalizeOrigin(reg.origin);
    this.originByApp.set(reg.appId, origin);
    this.appByOrigin.set(origin, reg.appId);
  }

  originFor(appId: AppId): string | undefined {
    return this.originByApp.get(appId);
  }

  appForOrigin(origin: string): AppId | undefined {
    return this.appByOrigin.get(normalizeOrigin(origin));
  }

  /** True nur, wenn appId existiert UND exakt an diesen Origin gebunden ist. */
  verify(appId: AppId, origin: string): boolean {
    const expected = this.originByApp.get(appId);
    return expected !== undefined && expected === normalizeOrigin(origin);
  }
}

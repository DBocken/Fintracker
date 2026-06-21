import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/AuthProvider";
import { getUserSettings, updateUserSettings } from "@/services/transaction-service";
import { DEFAULT_KPI_PREFS, KPI_DEFINITIONS, type KpiId } from "@/components/kpi/kpis";

export type KpiPrefs = {
  order: KpiId[];
  active: KpiId[];
};

function normalizePrefs(prefs: KpiPrefs | null | undefined): KpiPrefs {
  const allIds = KPI_DEFINITIONS.map((k) => k.id);

  const base = prefs ?? DEFAULT_KPI_PREFS;
  const order = Array.from(new Set([...(base.order || []), ...allIds])).filter((id) => allIds.includes(id));
  const active = Array.from(new Set(base.active || [])).filter((id) => allIds.includes(id));

  return { order, active };
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export function useKpiPreferences() {
  const qc = useQueryClient();
  const { status, user } = useAuth();
  const isAuthed = status === "authenticated" && !!user?.id;
  const userId = user?.id ?? "guest";

  const LS_CACHE = useMemo(() => `ausgabentracker_kpi_prefs_cache_v1__${userId}`, [userId]);
  const LS_PENDING = useMemo(() => `ausgabentracker_kpi_prefs_pending_v1__${userId}`, [userId]);

  const initialFromLocal = useMemo(() => {
    const pending = readJson<KpiPrefs>(LS_PENDING);
    if (pending) return normalizePrefs(pending);

    const cached = readJson<KpiPrefs>(LS_CACHE);
    if (cached) return normalizePrefs(cached);

    return normalizePrefs(DEFAULT_KPI_PREFS);
  }, [LS_CACHE, LS_PENDING]);

  const [localPrefs, setLocalPrefs] = useState<KpiPrefs>(initialFromLocal);

  useEffect(() => {
    setLocalPrefs(initialFromLocal);
  }, [initialFromLocal]);

  const query = useQuery({
    queryKey: ["user-settings"],
    queryFn: getUserSettings,
    enabled: isAuthed,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: async (next: KpiPrefs) => {
      return updateUserSettings({ kpi_prefs: next });
    },
    onMutate: async (next) => {
      const normalized = normalizePrefs(next);
      setLocalPrefs(normalized);
      writeJson(LS_CACHE, normalized);

      await qc.cancelQueries({ queryKey: ["user-settings"] });
      const prev = qc.getQueryData<import("@/types").UserSettings>(["user-settings"]);
      qc.setQueryData(["user-settings"], (old: import("@/types").UserSettings | undefined) => ({ ...(old || {}), kpi_prefs: normalized }));

      return { prev };
    },
    onError: (_err, next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["user-settings"], ctx.prev);
      writeJson(LS_PENDING, normalizePrefs(next));
    },
    onSuccess: (_data, next) => {
      writeJson(LS_CACHE, normalizePrefs(next));
      remove(LS_PENDING);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const prefs = useMemo(() => {
    if (!isAuthed) return normalizePrefs(localPrefs);
    const fromServer = query.data?.kpi_prefs;
    return normalizePrefs(fromServer || localPrefs);
  }, [isAuthed, query.data, localPrefs]);

  // Sync any local pending prefs once Supabase is reachable.
  useEffect(() => {
    if (!isAuthed) return;
    if (!query.isSuccess) return;
    if (mutation.isPending) return;

    const pending = readJson<KpiPrefs>(LS_PENDING);
    if (!pending) return;

    mutation.mutate(normalizePrefs(pending));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, query.isSuccess, LS_PENDING]);

  // If server row exists but lacks prefs (older users), seed defaults.
  useEffect(() => {
    if (!isAuthed) return;
    if (!query.isSuccess) return;
    const has = !!query.data?.kpi_prefs;
    if (has) return;
    mutation.mutate(normalizePrefs(localPrefs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, query.isSuccess]);

  return {
    prefs,
    isLoading: isAuthed ? query.isLoading : false,
    save: (next: KpiPrefs) => {
      const normalized = normalizePrefs(next);
      setLocalPrefs(normalized);
      writeJson(LS_CACHE, normalized);
      if (!isAuthed) return;
      mutation.mutate(normalized);
    },
    reset: () => {
      const normalized = normalizePrefs(DEFAULT_KPI_PREFS);
      setLocalPrefs(normalized);
      writeJson(LS_CACHE, normalized);
      if (!isAuthed) return;
      mutation.mutate(normalized);
    },
  };
}
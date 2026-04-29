import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFirebaseFirestore } from '@/lib/database';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export type FirestoreFaultType = 'LOW_VOLTAGE' | 'BULB_FAILURE' | 'LOW_LIGHT_OUTPUT';
export type StreetlightKey = 'streetlight_1' | 'streetlight_2';

export interface FirestoreHistoryEntry {
  id: string;
  timestamp: number;
  timestampLabel: string;
  rawTime: string | null;
  voltage?: number | string | null;
  current?: number | string | null;
  power?: number | string | null;
  lux?: number | string | null;
  ldr?: number | string | null;
  microwave?: number | string | boolean | null;
  motion?: number | string | boolean | null;
  ledStatus?: string | null;
  batteryStatus?: string | null;
  soh?: number | string | null;
}

export interface VoltageTrendPoint {
  label: string;
  sl1: number;
  sl2: number;
}

export interface WeeklyPowerPoint {
  day: string;
  sl1: number;
  sl2: number;
}

export interface WeeklyFaultPoint {
  week: string;
  sl1: number;
  sl2: number;
}

const STREETLIGHT_CONFIG: Record<StreetlightKey, { label: string; firestorePath: string }> = {
  streetlight_1: { label: 'Streetlight 1', firestorePath: 'sensorLogs/Streetlight_1/readings' },
  streetlight_2: { label: 'Streetlight 2', firestorePath: 'sensorLogs/Streetlight_2/readings' },
};

const FIRESTORE_CACHE_TTL_MS = 60 * 1000;
const FIRESTORE_AUTO_REFRESH_MS = 30 * 1000;
const FIRESTORE_USAGE_STORAGE_KEY = 'firestoreReadUsageEstimate';

type CacheEntry = {
  entries: FirestoreHistoryEntry[];
  fetchedAt: number | null;
  loading: boolean;
  error: boolean;
  promise: Promise<FirestoreHistoryEntry[]> | null;
};

type UsageState = {
  dayKey: string;
  reads: number;
  queries: number;
  updatedAt: number;
};

type FirestoreMonitoringSnapshot = {
  entriesByStreetlight: Record<StreetlightKey, FirestoreHistoryEntry[]>;
  loadingByStreetlight: Record<StreetlightKey, boolean>;
  latestFetchedAt: number | null;
  dailyReadEstimate: number;
  dailyQueryEstimate: number;
};

const createEmptyEntriesByStreetlight = (): Record<StreetlightKey, FirestoreHistoryEntry[]> => ({
  streetlight_1: [],
  streetlight_2: [],
});

const createEmptyLoadingByStreetlight = (): Record<StreetlightKey, boolean> => ({
  streetlight_1: true,
  streetlight_2: true,
});

const createCacheState = (): Record<StreetlightKey, CacheEntry> => ({
  streetlight_1: { entries: [], fetchedAt: null, loading: true, error: false, promise: null },
  streetlight_2: { entries: [], fetchedAt: null, loading: true, error: false, promise: null },
});

const firestoreCache: Record<StreetlightKey, CacheEntry> = createCacheState();
const firestoreSubscribers = new Set<() => void>();

const getTodayKey = (): string => new Date().toISOString().slice(0, 10);

const readUsageState = (): UsageState => {
  const fallback: UsageState = {
    dayKey: getTodayKey(),
    reads: 0,
    queries: 0,
    updatedAt: Date.now(),
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(FIRESTORE_USAGE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UsageState>;
    const dayKey = getTodayKey();
    if (parsed.dayKey !== dayKey) return fallback;
    return {
      dayKey,
      reads: Number(parsed.reads) || 0,
      queries: Number(parsed.queries) || 0,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return fallback;
  }
};

let firestoreUsage: UsageState = readUsageState();

const persistUsageState = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FIRESTORE_USAGE_STORAGE_KEY, JSON.stringify(firestoreUsage));
};

const ensureUsageDay = () => {
  const dayKey = getTodayKey();
  if (firestoreUsage.dayKey === dayKey) return;
  firestoreUsage = { dayKey, reads: 0, queries: 0, updatedAt: Date.now() };
  persistUsageState();
};

const notifyFirestoreSubscribers = () => {
  firestoreSubscribers.forEach((subscriber) => subscriber());
};

const getMonitoringSnapshot = (): FirestoreMonitoringSnapshot => {
  ensureUsageDay();
  const entriesByStreetlight = createEmptyEntriesByStreetlight();
  const loadingByStreetlight = createEmptyLoadingByStreetlight();
  let latestFetchedAt: number | null = null;

  (Object.keys(STREETLIGHT_CONFIG) as StreetlightKey[]).forEach((key) => {
    entriesByStreetlight[key] = firestoreCache[key].entries;
    loadingByStreetlight[key] = firestoreCache[key].loading;
    const fetchedAt = firestoreCache[key].fetchedAt;
    if (fetchedAt && (!latestFetchedAt || fetchedAt > latestFetchedAt)) {
      latestFetchedAt = fetchedAt;
    }
  });

  return {
    entriesByStreetlight,
    loadingByStreetlight,
    latestFetchedAt,
    dailyReadEstimate: firestoreUsage.reads,
    dailyQueryEstimate: firestoreUsage.queries,
  };
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseEspTimeToMs = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, mm, dd, yy, hh, min, sec] = match;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec)).getTime();
};

const toDisplayTime = (timestampMs: number): string =>
  new Date(timestampMs).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

const toAverage = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);

const isLedOnFromEntry = (entry: FirestoreHistoryEntry): boolean => {
  const ledStatus = String(entry.ledStatus ?? '').toUpperCase();
  if (ledStatus.includes('OFF')) return false;
  if (ledStatus.length > 0) return true;
  const current = toNumber(entry.current);
  return Number.isFinite(current) && current >= 50;
};

const weekKeyFromTimestamp = (timestampMs: number): string => {
  const date = new Date(timestampMs);
  const weekOfMonth = Math.min(4, Math.ceil(date.getDate() / 7));
  return `Week ${weekOfMonth}`;
};

const parseSnapshot = (docs: Array<{ id: string; data: () => Record<string, unknown> }>, key: StreetlightKey): FirestoreHistoryEntry[] =>
  docs.map((docSnap) => {
    const data = docSnap.data();
    const rawTime = typeof data.Time === 'string' ? data.Time : null;
    const timestamp = rawTime ? parseEspTimeToMs(rawTime) ?? 0 : 0;
    return {
      id: `${key}_${docSnap.id}`,
      timestamp,
      timestampLabel: timestamp ? toDisplayTime(timestamp) : '--',
      rawTime,
      voltage: data.voltage as number | string | null | undefined,
      current: data.current as number | string | null | undefined,
      power: data.power as number | string | null | undefined,
      lux: data.lux as number | string | null | undefined,
      ldr: data.ldr as number | string | null | undefined,
      microwave: (data.motion ?? data.microwave) as number | string | boolean | null | undefined,
      motion: (data.motion ?? data.microwave) as number | string | boolean | null | undefined,
      ledStatus: data.ledStatus as string | null | undefined,
      batteryStatus: data.batteryStatus as string | null | undefined,
      soh: data.soh as number | string | null | undefined,
    };
  });

const fetchStreetlightHistory = async (streetlight: StreetlightKey, options?: { force?: boolean }): Promise<FirestoreHistoryEntry[]> => {
  const force = options?.force ?? false;
  const cache = firestoreCache[streetlight];
  const now = Date.now();
  const hasFreshCache = cache.fetchedAt !== null && now - cache.fetchedAt < FIRESTORE_CACHE_TTL_MS;

  if (!force && hasFreshCache) return cache.entries;
  if (cache.promise) return cache.promise;

  const fs = getFirebaseFirestore();
  if (!fs) {
    cache.loading = false;
    cache.error = true;
    notifyFirestoreSubscribers();
    return cache.entries;
  }

  cache.loading = true;
  cache.error = false;
  notifyFirestoreSubscribers();

  cache.promise = getDocs(query(collection(fs, STREETLIGHT_CONFIG[streetlight].firestorePath), orderBy('Time', 'desc')))
    .then((snapshot) => {
      const entries = parseSnapshot(
        snapshot.docs as unknown as Array<{ id: string; data: () => Record<string, unknown> }>,
        streetlight
      );
      cache.entries = entries;
      cache.fetchedAt = Date.now();
      cache.loading = false;
      cache.error = false;
      ensureUsageDay();
      firestoreUsage = {
        dayKey: firestoreUsage.dayKey,
        reads: firestoreUsage.reads + snapshot.size,
        queries: firestoreUsage.queries + 1,
        updatedAt: Date.now(),
      };
      persistUsageState();
      return entries;
    })
    .catch(() => {
      cache.loading = false;
      cache.error = true;
      return cache.entries;
    })
    .finally(() => {
      cache.promise = null;
      notifyFirestoreSubscribers();
    });

  return cache.promise;
};

const fetchAllStreetlightHistory = async (options?: { force?: boolean }) => {
  await Promise.all((Object.keys(STREETLIGHT_CONFIG) as StreetlightKey[]).map((streetlight) =>
    fetchStreetlightHistory(streetlight, options)
  ));
};

const subscribeToFirestoreMonitoring = (listener: () => void) => {
  firestoreSubscribers.add(listener);
  return () => {
    firestoreSubscribers.delete(listener);
  };
};

const useFirestoreMonitoringState = () => {
  const [snapshot, setSnapshot] = useState<FirestoreMonitoringSnapshot>(() => getMonitoringSnapshot());

  useEffect(() => {
    const syncSnapshot = () => setSnapshot(getMonitoringSnapshot());
    syncSnapshot();
    const unsubscribe = subscribeToFirestoreMonitoring(syncSnapshot);
    return unsubscribe;
  }, []);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    await fetchAllStreetlightHistory(options);
  }, []);

  useEffect(() => {
    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, FIRESTORE_AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return {
    ...snapshot,
    refresh,
  };
};

export const useFirestoreHistory = (streetlight: StreetlightKey = 'streetlight_1') => {
  const { entriesByStreetlight, loadingByStreetlight, refresh } = useFirestoreMonitoringState();

  useEffect(() => {
    void fetchStreetlightHistory(streetlight);
  }, [streetlight]);

  return {
    entries: entriesByStreetlight[streetlight],
    loading: loadingByStreetlight[streetlight],
    refresh: () => refresh({ force: true }),
  };
};

export const useFirestoreHistoryByStreetlight = () => {
  const { entriesByStreetlight, loadingByStreetlight, latestFetchedAt, dailyReadEstimate, dailyQueryEstimate, refresh } = useFirestoreMonitoringState();
  const loading = loadingByStreetlight.streetlight_1 || loadingByStreetlight.streetlight_2;

  return {
    entriesByStreetlight,
    loading,
    latestFetchedAt,
    dailyReadEstimate,
    dailyQueryEstimate,
    refresh,
  };
};

export const useFirestoreReportAnalytics = () => {
  const {
    entriesByStreetlight,
    loading,
    latestFetchedAt,
    dailyReadEstimate,
    dailyQueryEstimate,
    refresh,
  } = useFirestoreHistoryByStreetlight();

  const analytics = useMemo(() => {
    const sl1Entries = entriesByStreetlight.streetlight_1.filter((e) => e.timestamp > 0);
    const sl2Entries = entriesByStreetlight.streetlight_2.filter((e) => e.timestamp > 0);
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const oneDayMs = 24 * oneHourMs;
    const dailyCutoff = now - oneDayMs;
    const weeklyCutoff = now - (7 * oneDayMs);
    const monthlyCutoff = now - (30 * oneDayMs);

    const buildVoltageSeries = (source: FirestoreHistoryEntry[], range: 'daily' | 'weekly' | 'monthly'): Map<string, number> => {
      const map = new Map<string, number[]>();
      source
        .filter((entry) => range === 'daily' ? entry.timestamp >= dailyCutoff : range === 'weekly' ? entry.timestamp >= weeklyCutoff : entry.timestamp >= monthlyCutoff)
        .forEach((entry) => {
          const d = new Date(entry.timestamp);
          const label = range === 'daily' ? `${String(d.getHours()).padStart(2, '0')}:00` : d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
          const voltage = toNumber(entry.voltage);
          if (!Number.isFinite(voltage)) return;
          if (!map.has(label)) map.set(label, []);
          map.get(label)?.push(voltage);
        });
      return new Map(Array.from(map.entries()).map(([k, v]) => [k, Number(toAverage(v).toFixed(2))]));
    };

    const mergeVoltage = (a: Map<string, number>, b: Map<string, number>): VoltageTrendPoint[] =>
      Array.from(new Set([...a.keys(), ...b.keys()])).map((label) => ({ label, sl1: a.get(label) ?? 0, sl2: b.get(label) ?? 0 }));

    const dailyVoltage = mergeVoltage(buildVoltageSeries(sl1Entries, 'daily'), buildVoltageSeries(sl2Entries, 'daily'));
    const weeklyVoltage = mergeVoltage(buildVoltageSeries(sl1Entries, 'weekly'), buildVoltageSeries(sl2Entries, 'weekly'));
    const monthlyVoltage = mergeVoltage(buildVoltageSeries(sl1Entries, 'monthly'), buildVoltageSeries(sl2Entries, 'monthly'));

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const avgPowerByDay = (source: FirestoreHistoryEntry[]): Map<string, number> => {
      const map = new Map<string, number[]>();
      source
        .filter((entry) => entry.timestamp >= weeklyCutoff)
        .forEach((entry) => {
          const day = weekDays[new Date(entry.timestamp).getDay()];
          const power = toNumber(entry.power);
          if (!Number.isFinite(power)) return;
          if (!map.has(day)) map.set(day, []);
          map.get(day)?.push(power);
        });
      return new Map(Array.from(map.entries()).map(([k, v]) => [k, Number(toAverage(v).toFixed(2))]));
    };
    const p1 = avgPowerByDay(sl1Entries);
    const p2 = avgPowerByDay(sl2Entries);
    const weeklyPowerComparison: WeeklyPowerPoint[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
      day,
      sl1: p1.get(day) ?? 0,
      sl2: p2.get(day) ?? 0,
    }));

    const nowDate = new Date();
    const buildFaultMap = (source: FirestoreHistoryEntry[]): Map<string, number> => {
      const map = new Map<string, number>([['Week 1', 0], ['Week 2', 0], ['Week 3', 0], ['Week 4', 0]]);
      source.forEach((entry) => {
        const d = new Date(entry.timestamp);
        if (d.getFullYear() !== nowDate.getFullYear() || d.getMonth() !== nowDate.getMonth()) return;
        const voltage = toNumber(entry.voltage);
        const current = toNumber(entry.current);
        const lux = toNumber(entry.lux);
        const ledOn = isLedOnFromEntry(entry);
        const lowVoltage = Number.isFinite(voltage) && voltage < 11.5;
        const bulbFailure = ledOn && Number.isFinite(current) && current < 50;
        const lowLight = ledOn && Number.isFinite(lux) && lux < 10;
        if (!lowVoltage && !bulbFailure && !lowLight) return;
        const week = weekKeyFromTimestamp(entry.timestamp);
        map.set(week, (map.get(week) ?? 0) + Number(lowVoltage) + Number(bulbFailure) + Number(lowLight));
      });
      return map;
    };
    const f1 = buildFaultMap(sl1Entries);
    const f2 = buildFaultMap(sl2Entries);
    const weeklyFaultFrequency: WeeklyFaultPoint[] = ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((week) => ({
      week,
      sl1: f1.get(week) ?? 0,
      sl2: f2.get(week) ?? 0,
    }));

    const toFaultRows = (streetlight: StreetlightKey, source: FirestoreHistoryEntry[]) =>
      source.flatMap((entry) => {
        const voltage = toNumber(entry.voltage);
        const current = toNumber(entry.current);
        const lux = toNumber(entry.lux);
        const ledOn = isLedOnFromEntry(entry);
        const rows: {
          id: string;
          streetlight: string;
          type: FirestoreFaultType;
          severity: 'medium' | 'high';
          value: number;
          timestamp: number;
        }[] = [];
        if (Number.isFinite(voltage) && voltage < 11.5) rows.push({ id: `${entry.id}_LOW_VOLTAGE`, streetlight: STREETLIGHT_CONFIG[streetlight].label, type: 'LOW_VOLTAGE', severity: 'high', value: voltage, timestamp: entry.timestamp });
        if (ledOn && Number.isFinite(current) && current < 50) rows.push({ id: `${entry.id}_BULB_FAILURE`, streetlight: STREETLIGHT_CONFIG[streetlight].label, type: 'BULB_FAILURE', severity: 'high', value: current, timestamp: entry.timestamp });
        if (ledOn && Number.isFinite(lux) && lux < 10) rows.push({ id: `${entry.id}_LOW_LIGHT_OUTPUT`, streetlight: STREETLIGHT_CONFIG[streetlight].label, type: 'LOW_LIGHT_OUTPUT', severity: 'medium', value: lux, timestamp: entry.timestamp });
        return rows;
      });
    const faultsComparison = [...toFaultRows('streetlight_1', sl1Entries), ...toFaultRows('streetlight_2', sl2Entries)].sort((a, b) => b.timestamp - a.timestamp);

    return { dailyVoltage, weeklyVoltage, monthlyVoltage, weeklyPowerComparison, weeklyFaultFrequency, faultsComparison };
  }, [entriesByStreetlight]);

  return {
    ...analytics,
    loading,
    latestFetchedAt,
    dailyReadEstimate,
    dailyQueryEstimate,
    refresh: () => refresh({ force: true }),
    cacheTtlMs: FIRESTORE_CACHE_TTL_MS,
    autoRefreshMs: FIRESTORE_AUTO_REFRESH_MS,
  };
};

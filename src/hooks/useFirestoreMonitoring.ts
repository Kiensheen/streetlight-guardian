import { useEffect, useMemo, useState } from 'react';
import { getFirebaseFirestore } from '@/lib/database';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

export type FirestoreFaultType = 'LOW_VOLTAGE' | 'BULB_FAILURE' | 'LOW_LIGHT_OUTPUT';

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
};

export interface VoltageTrendPoint {
  label: string;
  voltage: number;
}

export interface WeeklyFaultPoint {
  week: string;
  count: number;
}

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
  const month = Number(mm);
  const day = Number(dd);
  const year = 2000 + Number(yy);
  const hour = Number(hh);
  const minute = Number(min);
  const second = Number(sec);
  return new Date(year, month - 1, day, hour, minute, second).getTime();
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

const toAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

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

const HISTORY_COLLECTION_PATH = 'sensorLogs/Streetlight_1/readings';

export const useFirestoreHistory = () => {
  const [entries, setEntries] = useState<FirestoreHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fs = getFirebaseFirestore();
    if (!fs) {
      setLoading(false);
      return;
    }

    const q = query(collection(fs, HISTORY_COLLECTION_PATH), orderBy('Time', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next: FirestoreHistoryEntry[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const rawTime = typeof data.Time === 'string' ? data.Time : null;
          const timestamp = rawTime ? parseEspTimeToMs(rawTime) ?? 0 : 0;
          return {
            id: docSnap.id,
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
        setEntries(next);
        setLoading(false);
      },
      (error) => {
        console.error('[FirestoreHistory] Snapshot error', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { entries, loading };
};

export const useFirestoreReportAnalytics = () => {
  const { entries, loading } = useFirestoreHistory();

  const analytics = useMemo(() => {
    const withTime = entries
      .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    const oneDayMs = 24 * oneHourMs;

    const dailyCutoff = now - oneDayMs;
    const weeklyCutoff = now - (7 * oneDayMs);
    const monthlyCutoff = now - (30 * oneDayMs);

    const dailyMap = new Map<string, number[]>();
    withTime
      .filter((entry) => entry.timestamp >= dailyCutoff)
      .forEach((entry) => {
        const d = new Date(entry.timestamp);
        const label = `${String(d.getHours()).padStart(2, '0')}:00`;
        const voltage = toNumber(entry.voltage);
        if (!Number.isFinite(voltage)) return;
        if (!dailyMap.has(label)) dailyMap.set(label, []);
        dailyMap.get(label)?.push(voltage);
      });
    const dailyVoltage: VoltageTrendPoint[] = Array.from(dailyMap.entries()).map(([label, values]) => ({
      label,
      voltage: Number(toAverage(values).toFixed(2)),
    }));

    const weeklyMap = new Map<string, number[]>();
    withTime
      .filter((entry) => entry.timestamp >= weeklyCutoff)
      .forEach((entry) => {
        const d = new Date(entry.timestamp);
        const label = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        const voltage = toNumber(entry.voltage);
        if (!Number.isFinite(voltage)) return;
        if (!weeklyMap.has(label)) weeklyMap.set(label, []);
        weeklyMap.get(label)?.push(voltage);
      });
    const weeklyVoltage: VoltageTrendPoint[] = Array.from(weeklyMap.entries()).map(([label, values]) => ({
      label,
      voltage: Number(toAverage(values).toFixed(2)),
    }));

    const monthlyMap = new Map<string, number[]>();
    withTime
      .filter((entry) => entry.timestamp >= monthlyCutoff)
      .forEach((entry) => {
        const d = new Date(entry.timestamp);
        const label = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        const voltage = toNumber(entry.voltage);
        if (!Number.isFinite(voltage)) return;
        if (!monthlyMap.has(label)) monthlyMap.set(label, []);
        monthlyMap.get(label)?.push(voltage);
      });
    const monthlyVoltage: VoltageTrendPoint[] = Array.from(monthlyMap.entries()).map(([label, values]) => ({
      label,
      voltage: Number(toAverage(values).toFixed(2)),
    }));

    const weeklyFaultMap = new Map<string, number>([
      ['Week 1', 0],
      ['Week 2', 0],
      ['Week 3', 0],
      ['Week 4', 0],
    ]);
    const nowDate = new Date();
    const currentMonth = nowDate.getMonth();
    const currentYear = nowDate.getFullYear();

    withTime.forEach((entry) => {
      const d = new Date(entry.timestamp);
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;

      const voltage = toNumber(entry.voltage);
      const current = toNumber(entry.current);
      const lux = toNumber(entry.lux);
      const ledOn = isLedOnFromEntry(entry);

      const lowVoltage = Number.isFinite(voltage) && voltage < 11.5;
      const bulbFailure = ledOn && Number.isFinite(current) && current < 50;
      const lowLight = ledOn && Number.isFinite(lux) && lux < 10;
      if (!lowVoltage && !bulbFailure && !lowLight) return;

      const week = weekKeyFromTimestamp(entry.timestamp);
      const currentCount = weeklyFaultMap.get(week) ?? 0;
      let add = 0;
      if (lowVoltage) add += 1;
      if (bulbFailure) add += 1;
      if (lowLight) add += 1;
      weeklyFaultMap.set(week, currentCount + add);
    });

    const weeklyFaultFrequency: WeeklyFaultPoint[] = Array.from(weeklyFaultMap.entries()).map(([week, count]) => ({
      week,
      count,
    }));

    return { dailyVoltage, weeklyVoltage, monthlyVoltage, weeklyFaultFrequency };
  }, [entries]);

  return { ...analytics, loading };
};

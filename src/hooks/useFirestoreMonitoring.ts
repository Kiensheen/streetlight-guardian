import { useEffect, useMemo, useState } from 'react';
import { getFirebaseFirestore } from '@/lib/database';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

export type FirestoreFaultFilter = 'all' | 'unresolved' | 'resolved';
export type FirestoreFaultType = 'LOW_VOLTAGE' | 'BULB_FAILURE' | 'LOW_LIGHT_OUTPUT';

export interface FirestoreFault {
  id: string;
  type: FirestoreFaultType;
  severity: 'low' | 'medium' | 'high';
  value: number;
  timestamp: number;
  timeLabel?: string;
  resolved: boolean;
  sensorKey: string;
  resolvedAt?: number;
}

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

const deriveFaultsFromHistory = (entries: FirestoreHistoryEntry[]): FirestoreFault[] => {
  const faults: FirestoreFault[] = [];
  entries.forEach((entry) => {
    const voltage = toNumber(entry.voltage);
    const current = toNumber(entry.current);
    const lux = toNumber(entry.lux);

    if (Number.isFinite(voltage) && voltage < 11.5) {
      faults.push({
        id: `${entry.id}_LOW_VOLTAGE`,
        type: 'LOW_VOLTAGE',
        severity: 'high',
        value: voltage,
        timestamp: entry.timestamp,
        timeLabel: entry.timestampLabel,
        resolved: false,
        sensorKey: entry.id,
      });
    }
    if (Number.isFinite(current) && current < 50) {
      faults.push({
        id: `${entry.id}_BULB_FAILURE`,
        type: 'BULB_FAILURE',
        severity: 'high',
        value: current,
        timestamp: entry.timestamp,
        timeLabel: entry.timestampLabel,
        resolved: false,
        sensorKey: entry.id,
      });
    }
    if (Number.isFinite(lux) && lux < 10) {
      faults.push({
        id: `${entry.id}_LOW_LIGHT_OUTPUT`,
        type: 'LOW_LIGHT_OUTPUT',
        severity: 'medium',
        value: lux,
        timestamp: entry.timestamp,
        timeLabel: entry.timestampLabel,
        resolved: false,
        sensorKey: entry.id,
      });
    }
  });

  return faults.sort((a, b) => b.timestamp - a.timestamp);
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

    const q = query(collection(fs, HISTORY_COLLECTION_PATH), orderBy('__name__', 'desc'));
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

export const useFirestoreFaults = (filter: FirestoreFaultFilter) => {
  const { entries, loading: historyLoading } = useFirestoreHistory();
  const [existingFaults, setExistingFaults] = useState<FirestoreFault[]>([]);
  const [faults, setFaults] = useState<FirestoreFault[]>([]);
  const [faultsLoading, setFaultsLoading] = useState(true);

  useEffect(() => {
    const fs = getFirebaseFirestore();
    if (!fs) {
      setFaultsLoading(false);
      return;
    }

    const q = query(collection(fs, 'faults'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const rawTime = typeof data.Time === 'string' ? data.Time : null;
          const parsedTs = rawTime ? parseEspTimeToMs(rawTime) ?? 0 : toNumber(data.timestamp);
          const timestamp = Number.isFinite(parsedTs) ? parsedTs : 0;
          const resolvedAt = toNumber(data.resolvedAt);
          return {
            id: docSnap.id,
            type: (data.type as FirestoreFaultType) ?? 'LOW_VOLTAGE',
            severity: (data.severity as 'low' | 'medium' | 'high') ?? 'medium',
            value: toNumber(data.value),
            timestamp,
            timeLabel: timestamp ? toDisplayTime(timestamp) : '--',
            resolved: Boolean(data.resolved),
            sensorKey: String(data.sensorKey ?? docSnap.id),
            resolvedAt: Number.isFinite(resolvedAt) ? resolvedAt : undefined,
          };
        });
        setExistingFaults(next);
        setFaultsLoading(false);
      },
      (error) => {
        console.error('[FirestoreFaults] Snapshot error', error);
        setFaultsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const derived = deriveFaultsFromHistory(entries);
    if (existingFaults.length === 0) {
      setFaults(derived);
      return;
    }

    const resolvedByKey = new Map(existingFaults.map((f) => [`${f.sensorKey}_${f.type}`, f.resolved]));
    const merged = derived.map((f) => ({
      ...f,
      resolved: resolvedByKey.get(`${f.sensorKey}_${f.type}`) ?? false,
    }));
    setFaults(merged);
  }, [entries, existingFaults]);

  const filteredFaults = useMemo(() => {
    if (filter === 'resolved') return faults.filter((fault) => fault.resolved);
    if (filter === 'unresolved') return faults.filter((fault) => !fault.resolved);
    return faults;
  }, [faults, filter]);

  return { faults: filteredFaults, loading: historyLoading || faultsLoading };
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFirebaseDatabase, getFirebaseFirestore, ref, onValue, ensureFirebaseAuth } from '@/lib/database';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

export type FirestoreFaultFilter = 'all' | 'unresolved' | 'resolved';
export type FirestoreFaultType = 'LOW_VOLTAGE' | 'BULB_FAILURE' | 'LOW_LIGHT_OUTPUT';

export interface FirestoreFault {
  id: string;
  type: FirestoreFaultType;
  severity: 'low' | 'medium' | 'high';
  value: number;
  timestamp: number;
  resolved: boolean;
  sensorKey: string;
  resolvedAt?: number;
}

type SensorLogPayload = {
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
  timeMillis?: number | string | null;
  timeStamp?: string | number | null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const isLedOn = (payload: SensorLogPayload): boolean => {
  const status = String(payload.ledStatus ?? '').toUpperCase();
  if (status.includes('OFF')) return false;
  if (status) return true;
  const current = toNumber(payload.current);
  return Number.isFinite(current) && current >= 50;
};

const estimateTimestamp = (sensorKey: string, payload: SensorLogPayload): number => {
  const timeMillis = toNumber(payload.timeMillis);
  if (Number.isFinite(timeMillis) && timeMillis >= 0) {
    return Math.max(0, Date.now() - timeMillis);
  }
  const keyNum = Number(sensorKey);
  if (Number.isFinite(keyNum) && keyNum > 0) {
    return keyNum >= 1_000_000_000_000 ? keyNum : keyNum * 1000;
  }
  return Date.now();
};

const detectFaults = (sensorKey: string, payload: SensorLogPayload): Omit<FirestoreFault, 'id' | 'resolved' | 'resolvedAt'>[] => {
  const voltage = toNumber(payload.voltage);
  const current = toNumber(payload.current);
  const lux = toNumber(payload.lux);
  const timestamp = estimateTimestamp(sensorKey, payload);
  const faults: Omit<FirestoreFault, 'id' | 'resolved' | 'resolvedAt'>[] = [];

  if (Number.isFinite(voltage) && voltage < 11.5) {
    faults.push({
      type: 'LOW_VOLTAGE',
      severity: 'high',
      value: voltage,
      timestamp,
      sensorKey,
    });
  }

  if (isLedOn(payload) && Number.isFinite(current) && current < 50) {
    faults.push({
      type: 'BULB_FAILURE',
      severity: 'high',
      value: current,
      timestamp,
      sensorKey,
    });
  }

  if (Number.isFinite(lux) && lux < 10) {
    faults.push({
      type: 'LOW_LIGHT_OUTPUT',
      severity: 'medium',
      value: lux,
      timestamp,
      sensorKey,
    });
  }

  return faults;
};

export const useFirestoreSensorSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncedSensorKeys = useRef<Set<string>>(new Set());
  const syncedFaultKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const db = getFirebaseDatabase();
    const fs = getFirebaseFirestore();
    if (!db || !fs) return;

    let unsub: (() => void) | undefined;
    let cancelled = false;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        const logsRef = ref(db, 'sensorLogs');
        unsub = onValue(
          logsRef,
          async (snap) => {
            if (!snap.exists()) return;

            const raw = snap.val();
            if (!raw || typeof raw !== 'object') return;

            setIsSyncing(true);
            const entries = Object.entries(raw as Record<string, SensorLogPayload>)
              .filter(([, value]) => value && typeof value === 'object')
              .sort((a, b) => estimateTimestamp(a[0], a[1]) - estimateTimestamp(b[0], b[1]));

            for (const [sensorKey, payload] of entries) {
              if (syncedSensorKeys.current.has(sensorKey)) continue;
              const timestamp = estimateTimestamp(sensorKey, payload);
              const sensorDocRef = doc(fs, 'sensor_history', sensorKey);
              await setDoc(sensorDocRef, {
                sensorKey,
                timestamp,
                voltage: toNumber(payload.voltage),
                current: toNumber(payload.current),
                power: toNumber(payload.power),
                lux: toNumber(payload.lux),
                ldr: toNumber(payload.ldr),
                motion: toNumber(payload.motion ?? payload.microwave),
                ledStatus: payload.ledStatus ?? null,
                batteryStatus: payload.batteryStatus ?? null,
                soh: toNumber(payload.soh),
                timeMillis: toNumber(payload.timeMillis),
                createdAt: Date.now(),
              }, { merge: true });

              syncedSensorKeys.current.add(sensorKey);

              const faults = detectFaults(sensorKey, payload);
              for (const fault of faults) {
                const faultId = `${sensorKey}_${fault.type}`;
                if (syncedFaultKeys.current.has(faultId)) continue;
                const faultDocRef = doc(fs, 'faults', faultId);
                await setDoc(faultDocRef, {
                  ...fault,
                  resolved: false,
                  createdAt: Date.now(),
                }, { merge: true });
                syncedFaultKeys.current.add(faultId);
              }
            }

            console.log('[FirestoreSync] Synced sensor logs and faults', {
              syncedSensorCount: syncedSensorKeys.current.size,
              syncedFaultCount: syncedFaultKeys.current.size,
            });
            setLastSyncedAt(Date.now());
            setIsSyncing(false);
          },
          (error) => {
            console.error('[FirestoreSync] RTDB listener error', error);
            setIsSyncing(false);
          }
        );
      })
      .catch((error) => {
        console.error('[FirestoreSync] Auth failed', error);
        setIsSyncing(false);
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return { isSyncing, lastSyncedAt };
};

export const useFirestoreFaults = (filter: FirestoreFaultFilter) => {
  const [faults, setFaults] = useState<FirestoreFault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fs = getFirebaseFirestore();
    if (!fs) {
      setLoading(false);
      return;
    }

    const q = query(collection(fs, 'faults'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<FirestoreFault, 'id'>;
          return {
            id: docSnap.id,
            ...data,
          };
        });
        setFaults(next);
        setLoading(false);
      },
      (error) => {
        console.error('[FirestoreFaults] Snapshot error', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const resolveFault = useCallback(async (faultId: string) => {
    const fs = getFirebaseFirestore();
    if (!fs) return;
    await updateDoc(doc(fs, 'faults', faultId), {
      resolved: true,
      resolvedAt: Date.now(),
    });
  }, []);

  const filteredFaults = useMemo(() => {
    if (filter === 'resolved') return faults.filter((fault) => fault.resolved);
    if (filter === 'unresolved') return faults.filter((fault) => !fault.resolved);
    return faults;
  }, [faults, filter]);

  return { faults: filteredFaults, loading, resolveFault };
};

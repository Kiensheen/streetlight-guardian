import { useEffect } from 'react';
import { ensureFirebaseAuth, getFirebaseDatabase, limitToLast, onValue, orderByKey, push, query, ref } from '@/lib/database';

const STREETLIGHT_1_PATH = 'sensorLogs/Streetlights-1';
const STREETLIGHT_2_PATH = 'sensorLogs/Streetlights-2';
const REAL_DATA_TIMEOUT_MS = 60 * 1000;
const INTERNAL_SIMULATION_MARKER = '__simulatedByApp';
const SIMULATION_MIN_WRITE_INTERVAL_MS = 1000;
const SIMULATION_KEEPALIVE_MS = 30 * 1000;

type SensorLog = {
  Time?: string | null;
  time?: number | string | null;
  timeMillis?: number | string | null;
  ldr?: number | string | null;
  motion?: number | string | boolean | null;
  microwave?: number | string | boolean | null;
  voltage?: number | string | null;
  current?: number | string | null;
  power?: number | string | null;
  lux?: number | string | null;
  ledStatus?: string | null;
  batteryStatus?: string | null;
  [INTERNAL_SIMULATION_MARKER]?: boolean;
};

const toNumberOrNaN = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
};

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const formatEspTime = (timestampMs: number): string => {
  const d = new Date(timestampMs);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}-${dd}-${yy} ${hh}:${min}:${ss}`;
};

const parseEspTimeToMs = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = /^(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, mm, dd, yy, hh, min, sec] = match;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec)).getTime();
};

const estimateTimestamp = (log: SensorLog): number => {
  const fromTime = parseEspTimeToMs(log.Time);
  if (fromTime) return fromTime;
  const fromMillis = Number(log.timeMillis ?? log.time);
  if (Number.isFinite(fromMillis) && fromMillis > 0) return fromMillis;
  return 0;
};

const getLatestLog = (snapshotValue: unknown): SensorLog | null => {
  if (!snapshotValue || typeof snapshotValue !== 'object') return null;
  const record = snapshotValue as Record<string, unknown>;
  const directKeys = ['Time', 'voltage', 'current', 'power', 'lux', 'ldr', 'motion', 'microwave', 'ledStatus', 'batteryStatus', 'time', 'timeMillis'];
  if (directKeys.some((key) => key in record)) {
    return record as SensorLog;
  }
  const entries = Object.entries(record).filter(([, value]) => value && typeof value === 'object');
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[0].localeCompare(a[0]));
  return entries[0][1] as SensorLog;
};

const getLatestRealTimestamp = (snapshotValue: unknown): number => {
  if (!snapshotValue || typeof snapshotValue !== 'object') return 0;
  const record = snapshotValue as Record<string, unknown>;
  const entries = Object.values(record).filter((value) => value && typeof value === 'object') as SensorLog[];
  if (entries.length === 0) {
    const maybeDirect = record as SensorLog;
    if (maybeDirect[INTERNAL_SIMULATION_MARKER]) return 0;
    return estimateTimestamp(maybeDirect);
  }

  let latest = 0;
  entries.forEach((entry) => {
    if (entry[INTERNAL_SIMULATION_MARKER]) return;
    const ts = estimateTimestamp(entry);
    if (ts > latest) latest = ts;
  });
  return latest;
};

const deriveBatteryStatus = (voltage: number): string => {
  if (voltage < 11.4) return 'Faulty';
  if (voltage < 12.0) return 'Degraded';
  return 'Normal';
};

const buildSourceSignature = (sl1: SensorLog): string => {
  const voltage = toNumberOrNaN(sl1.voltage);
  const current = toNumberOrNaN(sl1.current);
  const lux = toNumberOrNaN(sl1.lux);
  const ldr = toNumberOrNaN(sl1.ldr);
  const motionRaw = sl1.motion ?? sl1.microwave;
  const motionNum = Number(motionRaw);
  const motion = Number.isFinite(motionNum) && motionNum >= 1 ? 1 : 0;
  const ledStatus = typeof sl1.ledStatus === 'string' ? sl1.ledStatus : '';

  return JSON.stringify({
    motion,
    ledStatus,
    voltage: Number.isFinite(voltage) ? Number(voltage.toFixed(2)) : null,
    current: Number.isFinite(current) ? Number(current.toFixed(0)) : null,
    lux: Number.isFinite(lux) ? Number(lux.toFixed(0)) : null,
    ldr: Number.isFinite(ldr) ? Number(ldr.toFixed(0)) : null,
  });
};

const generateSimulatedFromStreetlight1 = (sl1: SensorLog, now: number) => {
  const sl1Voltage = toNumberOrNaN(sl1.voltage);
  const sl1Current = toNumberOrNaN(sl1.current);
  const sl1Lux = toNumberOrNaN(sl1.lux);
  const sl1Ldr = toNumberOrNaN(sl1.ldr);
  const sl1MotionRaw = sl1.motion ?? sl1.microwave;
  const sl1MotionNumber = Number(sl1MotionRaw);
  const motion = Number.isFinite(sl1MotionNumber) ? (sl1MotionNumber >= 1 ? 1 : 0) : 0;

  const voltageBase = Number.isFinite(sl1Voltage) ? sl1Voltage : 12.6;
  const currentBase = Number.isFinite(sl1Current) ? sl1Current : motion === 1 ? 1400 : 350;
  const luxBase = Number.isFinite(sl1Lux) ? sl1Lux : motion === 1 ? 120 : 15;
  const ldrBase = Number.isFinite(sl1Ldr) ? sl1Ldr : motion === 1 ? 600 : 950;

  const voltage = clamp(voltageBase + (Math.random() < 0.5 ? -1 : 1) * randomBetween(0.1, 0.5), 11, 14);
  const current = clamp(currentBase + (Math.random() < 0.5 ? -1 : 1) * randomBetween(50, 200), 50, 2000);
  const lux = clamp(luxBase + (Math.random() < 0.5 ? -1 : 1) * randomBetween(200, 800), 0, 120000);
  const ldr = clamp(ldrBase + (Math.random() < 0.5 ? -1 : 1) * randomBetween(50, 150), 0, 4095);
  const power = (voltage * current) / 1000;
  const ledStatus = typeof sl1.ledStatus === 'string' ? sl1.ledStatus : (motion === 1 ? 'ON' : 'DIM');
  const batteryStatus = deriveBatteryStatus(voltage);

  return {
    streetlightLabel: 'Streetlight_2',
    Time: formatEspTime(now),
    time: now,
    timeMillis: now,
    ldr: Number(ldr.toFixed(0)),
    motion,
    microwave: motion,
    voltage: Number(voltage.toFixed(2)),
    current: Number(current.toFixed(0)),
    power: Number(power.toFixed(2)),
    lux: Number(lux.toFixed(0)),
    ledStatus,
    batteryStatus,
    [INTERNAL_SIMULATION_MARKER]: true,
  };
};

export const useStreetlight2Simulation = () => {
  useEffect(() => {
    const database = getFirebaseDatabase();
    if (!database) return;

    let latestSl1Log: SensorLog | null = null;
    let latestRealSl2Timestamp = 0;
    let isMounted = true;
    let isWriting = false;
    let lastWriteMs = 0;
    let lastSourceSignature = '';

    const writeSimulationIfNeeded = async () => {
      if (!isMounted || isWriting || !latestSl1Log) return;
      const now = Date.now();
      const hasRecentRealSl2 = latestRealSl2Timestamp > 0 && now - latestRealSl2Timestamp <= REAL_DATA_TIMEOUT_MS;
      if (hasRecentRealSl2) return;
      if (now - lastWriteMs < SIMULATION_MIN_WRITE_INTERVAL_MS) return;

      const currentSourceSignature = buildSourceSignature(latestSl1Log);
      const sourceChanged = currentSourceSignature !== lastSourceSignature;
      const keepaliveDue = now - lastWriteMs >= SIMULATION_KEEPALIVE_MS;
      if (!sourceChanged && !keepaliveDue) return;

      isWriting = true;
      try {
        const payload = generateSimulatedFromStreetlight1(latestSl1Log, now);
        await push(ref(database, STREETLIGHT_2_PATH), payload);
        lastWriteMs = now;
        lastSourceSignature = currentSourceSignature;
      } catch {
        // Keep silent by design.
      } finally {
        isWriting = false;
      }
    };

    void ensureFirebaseAuth().catch(() => undefined);

    const sl1Unsub = onValue(ref(database, STREETLIGHT_1_PATH), (snapshot) => {
      latestSl1Log = getLatestLog(snapshot.val());
      void writeSimulationIfNeeded();
    });

    const sl2Unsub = onValue(
      query(ref(database, STREETLIGHT_2_PATH), orderByKey(), limitToLast(20)),
      (snapshot) => {
        latestRealSl2Timestamp = getLatestRealTimestamp(snapshot.val());
        void writeSimulationIfNeeded();
      }
    );

    const intervalId = window.setInterval(() => {
      void writeSimulationIfNeeded();
    }, 5000);

    return () => {
      isMounted = false;
      sl1Unsub();
      sl2Unsub();
      window.clearInterval(intervalId);
    };
  }, []);
};

export default useStreetlight2Simulation;

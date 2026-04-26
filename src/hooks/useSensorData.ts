import { useState, useEffect, useCallback } from 'react';
import { Streetlight, Fault, Notification, LightStatus, HealthStatus, FaultType } from '@/types/streetlight';
import { getFirebaseDatabase, ref, onValue, ensureFirebaseAuth } from '@/lib/database';

const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
  low_battery: 'Battery Faulty',
};

const SENSORS_PATH = 'sensorLogs/Streetlights-1';
const NODE_CONFIG: { nodeId: string; path: string | null; name: string; location: string }[] = [
  { nodeId: 'node1', path: SENSORS_PATH, name: 'Streetlight 1', location: 'Main Street North' },
  { nodeId: 'node2', path: null, name: 'Streetlight 2', location: 'Main Street Center' },
  { nodeId: 'node3', path: null, name: 'Streetlight 3', location: 'Main Street South' },
];

type SensorLogValue = {
  Time?: string | null;
  voltage?: number | string | null;
  current?: number | string | null;
  power?: number | string | null;
  lux?: number | string | null;
  ldr?: number | string | null;
  microwave?: number | string | null;
  motion?: number | string | boolean | null;
  ledStatus?: string | null;
  batteryStatus?: string | null;
  soh?: number | string | null;
  timeMillis?: number | string | null;
  timeStamp?: string | number | null;
};

const toNumberOrNaN = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const hasNumber = (value: number): boolean => Number.isFinite(value);

const deriveStatus = (currentMa: number, voltage: number): LightStatus => {
  if (!hasNumber(currentMa) && !hasNumber(voltage)) return 'off';
  if (hasNumber(currentMa) && Math.abs(currentMa) < 50) return 'off';
  if (hasNumber(voltage) && voltage < 11.0) return 'dim';
  if (hasNumber(currentMa) && Math.abs(currentMa) < 200) return 'dim';
  return 'on';
};

const estimateBatterySOH = (voltage: number): number => {
  if (!hasNumber(voltage)) return Number.NaN;
  const pct = ((voltage - 10.5) / (14.4 - 10.5)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const getHealthStatus = (status: LightStatus, voltage: number): HealthStatus => {
  if (hasNumber(voltage) && voltage > 0 && voltage < 11.0) return 'fault';
  switch (status) {
    case 'on': return 'healthy';
    case 'flickering':
    case 'dim': return 'warning';
    case 'off': return 'fault';
    default: return 'healthy';
  }
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
  if (
    !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year) ||
    !Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second).getTime();
};

const getLatestSensorLog = (snapshotValue: unknown): { key: string | null; value: SensorLogValue | null } => {
  if (!snapshotValue || typeof snapshotValue !== 'object') return { key: null, value: null };

  const record = snapshotValue as Record<string, unknown>;
  const directFieldNames = ['Time', 'voltage', 'current', 'power', 'lux', 'ldr', 'microwave', 'motion', 'ledStatus', 'batteryStatus', 'soh', 'timeMillis', 'timeStamp'];
  if (directFieldNames.some(field => field in record)) {
    return { key: null, value: record as SensorLogValue };
  }

  const entries = Object.entries(record).filter(([, value]) => value && typeof value === 'object');
  if (entries.length === 0) return { key: null, value: null };

  entries.sort((a, b) => b[0].localeCompare(a[0]));
  const [key, value] = entries[0];
  return { key, value: value as SensorLogValue };
};

const estimateLogTimestamp = (key: string | null, value: SensorLogValue): number => {
  const parsedTime = parseEspTimeToMs(value.Time);
  if (parsedTime !== null) return parsedTime;
  return 0;
};

const generateFaults = (streetlights: Streetlight[]): Fault[] => {
  const faults: Fault[] = [];
  streetlights.forEach(sl => {
    if (!sl.hasData) return;
    const batteryStatusText = String(sl.batteryStatus ?? '').toUpperCase();
    const isBatteryFaulty = batteryStatusText.includes('FAULTY') || batteryStatusText === 'DEGRADED';
    const ledStatusText = String(sl.ledStatus ?? '').toUpperCase();
    const isLedFaulty = ledStatusText === 'FAULTY' || ledStatusText === 'DEGRADED';

    if (isLedFaulty) {
      faults.push({
        id: `fault-${sl.id}-led`,
        streetlightId: sl.id,
        streetlightName: sl.name,
        type: 'dim_output',
        severity: 'high',
        detectedAt: sl.lastUpdated > 0 ? sl.lastUpdated : 0,
        resolved: false,
        description: `LED Faulty`,
      });
    }
    if (isBatteryFaulty) {
      faults.push({
        id: `fault-${sl.id}-batt`,
        streetlightId: sl.id,
        streetlightName: sl.name,
        type: 'low_battery',
        severity: 'high',
        detectedAt: sl.lastUpdated > 0 ? sl.lastUpdated : 0,
        resolved: false,
        description: `Battery Faulty`,
      });
    }
    if (sl.soh !== undefined && hasNumber(sl.soh) && sl.soh < 50 && !isBatteryFaulty) {
      faults.push({
        id: `fault-${sl.id}-soh`,
        streetlightId: sl.id,
        streetlightName: sl.name,
        type: 'low_battery',
        severity: 'medium',
        detectedAt: sl.lastUpdated > 0 ? sl.lastUpdated : 0,
        resolved: false,
        description: `Battery State of Health critical (${sl.soh.toFixed(0)}%)`,
      });
    }

    if (sl.healthStatus === 'healthy') return;
    if (faults.some(f => f.streetlightId === sl.id)) return;

    let faultType: FaultType = 'off_when_scheduled_on';
    let description = '';
    if (hasNumber(sl.voltage) && sl.voltage > 0 && sl.voltage < 11.0) {
      faultType = 'low_battery';
      description = `${sl.name} battery low (${sl.voltage.toFixed(2)}V)`;
    } else if (sl.status === 'off') {
      faultType = 'off_when_scheduled_on';
      description = `${sl.name} is off`;
    } else if (sl.status === 'dim') {
      faultType = 'dim_output';
      description = `${sl.name} has reduced output`;
    }
    faults.push({
      id: `fault-${sl.id}`,
      streetlightId: sl.id,
      streetlightName: sl.name,
      type: faultType,
      severity: sl.healthStatus === 'fault' ? 'high' : 'medium',
      detectedAt: sl.lastUpdated > 0 ? sl.lastUpdated : 0,
      resolved: false,
      description,
    });
  });
  return faults;
};

const mapSnapshotToLight = (
  v: SensorLogValue,
  cfg: { nodeId: string; name: string; location: string },
  logKey: string | null,
): Streetlight => {
  const voltage = toNumberOrNaN(v.voltage);
  const currentMa = toNumberOrNaN(v.current);
  const powerMw = toNumberOrNaN(v.power);
  const lux = toNumberOrNaN(v.lux);
  const ldr = toNumberOrNaN(v.ldr);
  const microwave = toNumberOrNaN(v.motion ?? v.microwave);
  const motion = hasNumber(microwave) ? microwave === 1 : undefined;

  const ledStatus = typeof v.ledStatus === 'string' ? v.ledStatus : undefined;
  const batteryStatus = typeof v.batteryStatus === 'string' ? v.batteryStatus : undefined;
  const soh = v.soh != null && !Number.isNaN(Number(v.soh)) ? Number(v.soh) : undefined;

  const status = deriveStatus(currentMa, voltage);
  let healthStatus = getHealthStatus(status, voltage);
  const ledStatusText = String(ledStatus ?? '').toUpperCase();
  if (
    ledStatusText === 'FAULTY' ||
    ledStatusText === 'DEGRADED' ||
    String(batteryStatus ?? '').toUpperCase().includes('FAULTY') ||
    batteryStatus === 'DEGRADED'
  ) {
    healthStatus = 'fault';
  }
  else if (soh !== undefined && soh < 50) healthStatus = healthStatus === 'fault' ? 'fault' : 'warning';

  return {
    id: cfg.nodeId,
    name: cfg.name,
    location: cfg.location,
    status,
    healthStatus,
    voltage,
    current: currentMa,
    power: powerMw,
    lastUpdated: estimateLogTimestamp(logKey, v),
    batterySOH: soh !== undefined ? Math.max(0, Math.min(100, Math.round(soh))) : estimateBatterySOH(voltage),
    luminance: lux,
    motionDetected: motion,
    solarChargingCurrent: Number.NaN,
    ldr,
    hasData: true,
    online: undefined,
    ledStatus,
    batteryStatus,
    soh,
  };
};

const emptyLight = (cfg: { nodeId: string; name: string; location: string }): Streetlight => ({
  id: cfg.nodeId,
  name: cfg.name,
  location: cfg.location,
  status: 'off',
  healthStatus: 'healthy',
  voltage: Number.NaN,
  current: Number.NaN,
  power: Number.NaN,
  lastUpdated: 0,
  batterySOH: Number.NaN,
  luminance: Number.NaN,
  motionDetected: undefined,
  solarChargingCurrent: Number.NaN,
  ldr: Number.NaN,
  hasData: false,
});

export const useSensorData = () => {
  const [readings, setReadings] = useState<Record<string, Streetlight>>({});
  const [faults, setFaults] = useState<Fault[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const subscribeLatestReadings = useCallback(async () => {
    const database = getFirebaseDatabase();
    if (!database) {
      console.error('[SensorData] Firebase database is not initialized');
      setIsFirebaseConnected(false);
      return [] as Array<() => void>;
    }

    await ensureFirebaseAuth();
    console.log('[SensorData] Subscribing to Realtime Database entries', {
      nodePaths: NODE_CONFIG.map(({ nodeId, path }) => ({ nodeId, path })),
    });

    const unsubscribers: Array<() => void> = [];
    NODE_CONFIG.forEach((cfg) => {
      if (!cfg.path) return;

      const unsubscribe = onValue(
        ref(database, cfg.path),
        (snap) => {
          console.log(`[SensorData] Live update for ${cfg.nodeId}`, {
            path: `/${cfg.path}`,
            exists: snap.exists(),
          });
          if (!snap.exists()) {
            setReadings(prev => ({ ...prev, [cfg.nodeId]: emptyLight(cfg) }));
            setIsFirebaseConnected(false);
            setLastSync(null);
            return;
          }

          const { key, value } = getLatestSensorLog(snap.val());
          if (!value) return;
          const light = mapSnapshotToLight(value, cfg, key);
          setReadings(prev => ({ ...prev, [cfg.nodeId]: light }));
          setIsFirebaseConnected(true);
          setLastSync(light.lastUpdated > 0 ? light.lastUpdated : null);
          setIsLoading(false);
        },
        (err) => {
          console.error(`[SensorData] Listener failed for /${cfg.path}`, err);
          setIsFirebaseConnected(false);
          setIsLoading(false);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return unsubscribers;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribers: Array<() => void> = [];

    subscribeLatestReadings()
      .then((unsubs) => {
        if (cancelled) {
          unsubs.forEach((fn) => fn());
          return;
        }
        unsubscribers = unsubs;
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[SensorData] Realtime subscription failed:', err);
          setIsFirebaseConnected(false);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach((fn) => fn());
    };
  }, [subscribeLatestReadings]);

  const refresh = useCallback(async () => {
    // Realtime listeners auto-refresh data. Keep this for UI compatibility.
    console.log('[SensorData] Manual refresh requested - realtime listener is active');
  }, []);

  const streetlights: Streetlight[] = NODE_CONFIG.map(cfg => readings[cfg.nodeId] ?? emptyLight(cfg));

  useEffect(() => {
    const newFaults = generateFaults(streetlights);
    setFaults(newFaults);
    setNotifications(newFaults.map(fault => ({
      id: `notif-${fault.id}`,
      faultId: fault.id,
      streetlightId: fault.streetlightId,
      streetlightName: fault.streetlightName,
      faultType: fault.type,
      message: `${faultTypeLabels[fault.type]} detected on ${fault.streetlightName}`,
      timestamp: fault.detectedAt,
      read: false,
    })));
  }, [readings]);

  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    streetlights,
    faults,
    notifications,
    unreadCount,
    isLoading,
    isFirebaseConnected,
    lastSync,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refresh,
  };
};

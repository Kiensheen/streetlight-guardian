import { useState, useEffect, useCallback } from 'react';
import { Streetlight, Fault, Notification, LightStatus, HealthStatus, FaultType } from '@/types/streetlight';
import { getFirebaseDatabase, ref, onValue, get, ensureFirebaseAuth } from '@/lib/database';

const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
  low_battery: 'Low Battery',
};

// Three streetlights. Node1 reads from /sensors (current ESP32 path).
// Node2 and Node3 read from their own paths and will simply stay empty until data arrives.
const NODE_CONFIG: { nodeId: string; path: string; name: string; location: string }[] = [
  { nodeId: 'node1', path: 'sensors', name: 'Streetlight 1', location: 'Main Street North' },
  { nodeId: 'node2', path: 'lights/node2/sensors', name: 'Streetlight 2', location: 'Main Street Center' },
  { nodeId: 'node3', path: 'lights/node3/sensors', name: 'Streetlight 3', location: 'Main Street South' },
];

// Consider a node "Online" only if its last update is within this window.
const ONLINE_WINDOW_MS = 60 * 1000; // 60 seconds

const deriveStatus = (currentMa: number, voltage: number): LightStatus => {
  if (Math.abs(currentMa) < 50) return 'off';
  if (voltage < 11.0) return 'dim';
  if (Math.abs(currentMa) < 200) return 'dim';
  return 'on';
};

const estimateBatterySOH = (voltage: number): number => {
  const pct = ((voltage - 10.5) / (14.4 - 10.5)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const getHealthStatus = (status: LightStatus, voltage: number): HealthStatus => {
  if (voltage > 0 && voltage < 11.0) return 'fault';
  switch (status) {
    case 'on': return 'healthy';
    case 'flickering':
    case 'dim': return 'warning';
    case 'off': return 'fault';
    default: return 'healthy';
  }
};

const generateFaults = (streetlights: Streetlight[]): Fault[] => {
  const faults: Fault[] = [];
  streetlights.forEach(sl => {
    if (!sl.hasData) return;
    if (sl.healthStatus === 'healthy') return;
    let faultType: FaultType = 'off_when_scheduled_on';
    let description = '';
    if (sl.voltage > 0 && sl.voltage < 11.0) {
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
      detectedAt: Date.now(),
      resolved: false,
      description,
    });
  });
  return faults;
};

const mapSnapshotToLight = (
  v: { voltage?: number; current?: number; power?: number; lux?: number; ldr?: number; microwave?: number; ts?: number },
  cfg: { nodeId: string; name: string; location: string }
): Streetlight => {
  const voltage = Number(v.voltage ?? 0);
  const currentMa = Number(v.current ?? 0);
  const powerMw = Number(v.power ?? 0);
  const lux = Number(v.lux ?? 0);
  const ldr = Number(v.ldr ?? 0);
  const motion = Number(v.microwave ?? 0) === 1;
  const tsMs = v.ts ? Number(v.ts) * 1000 : Date.now();

  const status = deriveStatus(currentMa, voltage);
  const healthStatus = getHealthStatus(status, voltage);

  return {
    id: cfg.nodeId,
    name: cfg.name,
    location: cfg.location,
    status,
    healthStatus,
    voltage,
    current: currentMa,
    power: powerMw,
    lastUpdated: tsMs,
    batterySOH: estimateBatterySOH(voltage),
    luminance: lux,
    motionDetected: motion,
    solarChargingCurrent: 0,
    ldr,
    hasData: true,
  };
};

const emptyLight = (cfg: { nodeId: string; name: string; location: string }): Streetlight => ({
  id: cfg.nodeId,
  name: cfg.name,
  location: cfg.location,
  status: 'off',
  healthStatus: 'healthy',
  voltage: 0,
  current: 0,
  power: 0,
  lastUpdated: 0,
  batterySOH: 0,
  luminance: 0,
  motionDetected: false,
  solarChargingCurrent: 0,
  ldr: 0,
  hasData: false,
});

export const useSensorData = () => {
  const [readings, setReadings] = useState<Record<string, Streetlight>>({});
  const [faults, setFaults] = useState<Fault[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Tick every 10s so Online/Offline freshness re-evaluates
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const database = getFirebaseDatabase();
    if (!database) {
      setIsLoading(false);
      return;
    }

    const unsubscribers: Array<() => void> = [];
    let cancelled = false;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        setIsFirebaseConnected(true);

        NODE_CONFIG.forEach((cfg) => {
          const dataRef = ref(database, cfg.path);
          const unsub = onValue(
            dataRef,
            (snapshot) => {
              if (!snapshot.exists()) {
                setIsLoading(false);
                return;
              }
              const light = mapSnapshotToLight(snapshot.val(), cfg);
              setReadings(prev => ({ ...prev, [cfg.nodeId]: light }));
              setIsLoading(false);
            },
            (error) => {
              console.error(`Firebase error for ${cfg.nodeId}:`, error);
              setIsLoading(false);
            }
          );
          unsubscribers.push(unsub);
        });

        // In case no node ever fires (all empty), stop the loading state quickly
        setTimeout(() => setIsLoading(false), 1500);
      })
      .catch((err) => {
        console.error('Auth failed, cannot subscribe:', err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach(u => u());
    };
  }, []);

  const refresh = useCallback(async () => {
    const database = getFirebaseDatabase();
    if (!database) return;
    try {
      await ensureFirebaseAuth();
      await Promise.all(NODE_CONFIG.map(async (cfg) => {
        const snap = await get(ref(database, cfg.path));
        if (snap.exists()) {
          const light = mapSnapshotToLight(snap.val(), cfg);
          setReadings(prev => ({ ...prev, [cfg.nodeId]: light }));
        }
      }));
      setNow(Date.now());
    } catch (e) {
      console.error('Manual refresh failed:', e);
    }
  }, []);

  // Build the always-3 list, marking online based on freshness
  const streetlights: Streetlight[] = NODE_CONFIG.map(cfg => {
    const r = readings[cfg.nodeId];
    if (!r) return emptyLight(cfg);
    const online = r.lastUpdated > 0 && (now - r.lastUpdated) < ONLINE_WINDOW_MS;
    return { ...r, online };
  });

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
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refresh,
  };
};

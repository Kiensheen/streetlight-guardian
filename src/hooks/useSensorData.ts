import { useState, useEffect, useCallback } from 'react';
import { Streetlight, Fault, Notification, LightStatus, HealthStatus, FaultType } from '@/types/streetlight';
import { getFirebaseDatabase, ref, onValue, ensureFirebaseAuth } from '@/lib/database';

const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
  low_battery: 'Low Battery',
};

// ESP32 nodes — path: /lights/{nodeId}/sensors
// Only node1 is currently online. Add more here when hardware is deployed.
const NODE_CONFIG: { nodeId: string; name: string; location: string }[] = [
  { nodeId: 'node1', name: 'Streetlight 1', location: 'Main Street North' },
];

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

export const useSensorData = () => {
  const [readings, setReadings] = useState<Record<string, Streetlight>>({});
  const [faults, setFaults] = useState<Fault[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

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

        NODE_CONFIG.forEach(({ nodeId, name, location }) => {
          const dataRef = ref(database, `lights/${nodeId}/sensors`);
          const unsub = onValue(
            dataRef,
            (snapshot) => {
              if (!snapshot.exists()) {
                setIsLoading(false);
                return;
              }
              const v = snapshot.val() as {
                voltage?: number; current?: number; power?: number;
                lux?: number; ldr?: number; microwave?: number; ts?: number;
              };

              // RAW values exactly as stored in Firebase — no conversion.
              const voltage = Number(v.voltage ?? 0);
              const currentMa = Number(v.current ?? 0); // mA (raw)
              const powerMw = Number(v.power ?? 0);     // mW (raw)
              const lux = Number(v.lux ?? 0);
              const ldr = Number(v.ldr ?? 0);
              const motion = Number(v.microwave ?? 0) === 1;
              const tsMs = v.ts ? Number(v.ts) * 1000 : Date.now();

              const status = deriveStatus(currentMa, voltage);
              const healthStatus = getHealthStatus(status, voltage);

              const light: Streetlight = {
                id: nodeId,
                name,
                location,
                status,
                healthStatus,
                voltage,         // V (raw)
                current: currentMa, // mA (raw, may be negative)
                power: powerMw,    // mW (raw)
                lastUpdated: tsMs,
                batterySOH: estimateBatterySOH(voltage),
                luminance: lux,
                motionDetected: motion,
                solarChargingCurrent: 0,
                ldr,
              };

              setReadings(prev => ({ ...prev, [nodeId]: light }));
              setIsFirebaseConnected(true);
              setIsLoading(false);
            },
            (error) => {
              console.error(`Firebase error for ${nodeId}:`, error);
              setIsLoading(false);
            }
          );
          unsubscribers.push(unsub);
        });
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

  useEffect(() => {
    const lights = NODE_CONFIG
      .map(c => readings[c.nodeId])
      .filter((l): l is Streetlight => Boolean(l));
    const newFaults = generateFaults(lights);
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

  const streetlights = NODE_CONFIG
    .map(c => readings[c.nodeId])
    .filter((l): l is Streetlight => Boolean(l));

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
  };
};

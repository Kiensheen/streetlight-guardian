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

// ESP32 nodes — path: /lights/{nodeId}/data
const NODE_CONFIG: { nodeId: string; name: string; location: string }[] = [
  { nodeId: 'node1', name: 'Streetlight 1', location: 'Main Street North' },
  { nodeId: 'node2', name: 'Streetlight 2', location: 'Main Street Center' },
  { nodeId: 'node3', name: 'Streetlight 3', location: 'Main Street South' },
];

// Derive status from brightness + voltage + LED current
const deriveStatus = (br: number, current: number, voltage: number): LightStatus => {
  if (br <= 5 || current < 0.05) return 'off';
  if (br < 80) return 'dim';
  if (voltage < 11.0) return 'dim';
  return 'on';
};

// Estimate battery State of Health from voltage (12V LiFePO4: 10.5V empty → 14.4V full)
const estimateBatterySOH = (voltage: number): number => {
  const pct = ((voltage - 10.5) / (14.4 - 10.5)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const getHealthStatus = (status: LightStatus, voltage: number): HealthStatus => {
  if (voltage < 11.0) return 'fault';
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
    if (sl.voltage < 11.0) {
      faultType = 'low_battery';
      description = `${sl.name} battery critically low (${sl.voltage.toFixed(1)}V)`;
    } else if (sl.status === 'flickering') {
      faultType = 'flickering';
      description = `${sl.name} is experiencing intermittent flickering`;
    } else if (sl.status === 'off') {
      faultType = 'off_when_scheduled_on';
      description = `${sl.name} is off during scheduled operation hours`;
    } else if (sl.status === 'dim') {
      faultType = 'dim_output';
      description = `${sl.name} has reduced brightness output`;
    }
    faults.push({
      id: `fault-${sl.id}`,
      streetlightId: sl.id,
      streetlightName: sl.name,
      type: faultType,
      severity: sl.healthStatus === 'fault' ? 'high' : 'medium',
      detectedAt: Date.now() - Math.random() * 3600000,
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
          const dataRef = ref(database, `lights/${nodeId}/data`);
          const unsub = onValue(
            dataRef,
            (snapshot) => {
              if (!snapshot.exists()) {
                setIsLoading(false);
                return;
              }
              const v = snapshot.val() as {
                ldr?: number; v?: number; c?: number; p?: number;
                lux?: number; br?: number; ts?: number;
              };

              const voltage = Number(v.v ?? 0);
              const currentA = Number(v.c ?? 0) / 1000; // mA → A
              const powerW = Number(v.p ?? 0) / 1000;   // mW → W
              const lux = Number(v.lux ?? 0);
              const br = Number(v.br ?? 0);
              const tsMs = v.ts ? Number(v.ts) * 1000 : Date.now();

              const status = deriveStatus(br, currentA, voltage);
              const healthStatus = getHealthStatus(status, voltage);

              const light: Streetlight = {
                id: nodeId,
                name,
                location,
                status,
                healthStatus,
                voltage,
                current: currentA,
                power: powerW,
                lastUpdated: tsMs,
                batterySOH: estimateBatterySOH(voltage),
                luminance: lux,
                motionDetected: false, // not provided by ESP32
                solarChargingCurrent: 0, // not provided by ESP32
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

  // Recompute faults/notifications whenever readings change
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

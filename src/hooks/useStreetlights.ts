import { useState, useEffect, useCallback } from 'react';
import { Streetlight, Fault, Notification, LightStatus, HealthStatus, FaultType } from '@/types/streetlight';
import { getFirebaseDatabase, ref, onValue } from '@/lib/firebase';
import { seedFirebaseIfEmpty } from '@/lib/seedFirebase';

const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
};

const getHealthStatus = (status: LightStatus): HealthStatus => {
  switch (status) {
    case 'on': return 'healthy';
    case 'flickering': return 'warning';
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
    if (sl.status === 'flickering') {
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

export const useStreetlights = () => {
  const [streetlights, setStreetlights] = useState<Streetlight[]>([]);
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

    // Seed demo data if database is empty
    seedFirebaseIfEmpty();

    const streetlightsRef = ref(database, 'streetlights');
    const unsubscribe = onValue(streetlightsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lights: Streetlight[] = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          name: value.name || `Streetlight ${id}`,
          location: value.location || '',
          status: value.status || 'off',
          healthStatus: getHealthStatus(value.status || 'off'),
          voltage: value.voltage || 0,
          current: value.current || 0,
          power: value.power || (value.voltage * value.current) || 0,
          lastUpdated: value.timestamp || Date.now(),
        }));

        setStreetlights(lights);
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
        setIsFirebaseConnected(true);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Firebase connection error:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
  };
};

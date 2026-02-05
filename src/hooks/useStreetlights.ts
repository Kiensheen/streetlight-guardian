 import { useState, useEffect, useCallback } from 'react';
 import { Streetlight, Fault, Notification, LightStatus, HealthStatus, FaultType } from '@/types/streetlight';
 import { getFirebaseDatabase, ref, onValue } from '@/lib/firebase';
 
 // Mock data generator for demo purposes
 const generateMockStreetlights = (): Streetlight[] => {
   const statuses: LightStatus[] = ['on', 'off', 'flickering', 'dim'];
   
   return [
     {
       id: 'sl-001',
       name: 'Streetlight 1',
       location: 'Main Street North',
       status: 'on',
       healthStatus: 'healthy',
       voltage: 220 + Math.random() * 10,
       current: 0.8 + Math.random() * 0.2,
       power: 180 + Math.random() * 20,
       lastUpdated: Date.now(),
     },
     {
       id: 'sl-002',
       name: 'Streetlight 2',
       location: 'Main Street Center',
       status: 'flickering',
       healthStatus: 'warning',
       voltage: 200 + Math.random() * 5,
       current: 0.6 + Math.random() * 0.3,
       power: 150 + Math.random() * 30,
       lastUpdated: Date.now(),
     },
     {
       id: 'sl-003',
       name: 'Streetlight 3',
       location: 'Main Street South',
       status: 'off',
       healthStatus: 'fault',
       voltage: 0,
       current: 0,
       power: 0,
       lastUpdated: Date.now(),
     },
   ];
 };
 
 const generateMockFaults = (streetlights: Streetlight[]): Fault[] => {
   const faults: Fault[] = [];
   
   streetlights.forEach(sl => {
     if (sl.healthStatus !== 'healthy') {
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
         id: `fault-${sl.id}-${Date.now()}`,
         streetlightId: sl.id,
         streetlightName: sl.name,
         type: faultType,
         severity: sl.healthStatus === 'fault' ? 'high' : 'medium',
         detectedAt: Date.now() - Math.random() * 3600000,
         resolved: false,
         description,
       });
     }
   });
   
   return faults;
 };
 
 const faultTypeLabels: Record<FaultType, string> = {
   off_when_scheduled_on: 'Light Off',
   flickering: 'Flickering',
   dim_output: 'Dim Output',
   voltage_anomaly: 'Voltage Anomaly',
 };
 
 export const useStreetlights = () => {
   const [streetlights, setStreetlights] = useState<Streetlight[]>([]);
   const [faults, setFaults] = useState<Fault[]>([]);
   const [notifications, setNotifications] = useState<Notification[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
 
   // Initialize data
   useEffect(() => {
     const database = getFirebaseDatabase();
     
     if (database) {
       // Firebase is configured - try to connect
       const streetlightsRef = ref(database, 'streetlights');
       
       const unsubscribe = onValue(streetlightsRef, (snapshot) => {
         if (snapshot.exists()) {
           const data = snapshot.val();
           const lights = Object.entries(data).map(([id, value]: [string, any]) => ({
             id,
             name: value.name || `Streetlight ${id}`,
             location: value.location,
             status: value.status || 'off',
             healthStatus: getHealthStatus(value.status),
             voltage: value.voltage || 0,
             current: value.current || 0,
             power: value.power || (value.voltage * value.current) || 0,
             lastUpdated: value.timestamp || Date.now(),
           }));
           
           setStreetlights(lights);
           setFaults(generateMockFaults(lights));
           setIsFirebaseConnected(true);
         }
         setIsLoading(false);
       }, (error) => {
         console.log('Firebase not configured, using demo data');
         initializeMockData();
       });
       
       return () => unsubscribe();
     } else {
       // No Firebase - use mock data
       initializeMockData();
     }
   }, []);
 
   const initializeMockData = () => {
     const mockLights = generateMockStreetlights();
     setStreetlights(mockLights);
     setFaults(generateMockFaults(mockLights));
     
     // Generate notifications from faults
     const mockNotifications: Notification[] = generateMockFaults(mockLights).map(fault => ({
       id: `notif-${fault.id}`,
       faultId: fault.id,
       streetlightId: fault.streetlightId,
       streetlightName: fault.streetlightName,
       faultType: fault.type,
       message: `${faultTypeLabels[fault.type]} detected on ${fault.streetlightName}`,
       timestamp: fault.detectedAt,
       read: false,
     }));
     
     setNotifications(mockNotifications);
     setIsLoading(false);
     
     // Simulate real-time updates
     const interval = setInterval(() => {
       setStreetlights(prev => prev.map(sl => ({
         ...sl,
         voltage: sl.status === 'on' || sl.status === 'flickering' || sl.status === 'dim' 
           ? 215 + Math.random() * 15 
           : 0,
         current: sl.status === 'on' ? 0.8 + Math.random() * 0.2 
           : sl.status === 'flickering' ? 0.4 + Math.random() * 0.4
           : sl.status === 'dim' ? 0.3 + Math.random() * 0.2
           : 0,
         power: sl.status === 'on' ? 180 + Math.random() * 20
           : sl.status === 'flickering' ? 100 + Math.random() * 50
           : sl.status === 'dim' ? 60 + Math.random() * 30
           : 0,
         lastUpdated: Date.now(),
       })));
     }, 3000);
     
     return () => clearInterval(interval);
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
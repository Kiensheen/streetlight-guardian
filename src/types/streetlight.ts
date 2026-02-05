 export type LightStatus = 'on' | 'off' | 'flickering' | 'dim';
 export type HealthStatus = 'healthy' | 'warning' | 'fault';
 export type FaultType = 'off_when_scheduled_on' | 'flickering' | 'dim_output' | 'voltage_anomaly';
 export type FaultSeverity = 'low' | 'medium' | 'high';
 
 export interface StreetlightReading {
   timestamp: number;
   voltage: number;
   current: number;
   power: number;
   status: LightStatus;
 }
 
 export interface Streetlight {
   id: string;
   name: string;
   location?: string;
   status: LightStatus;
   healthStatus: HealthStatus;
   voltage: number;
   current: number;
   power: number;
   lastUpdated: number;
 }
 
 export interface Fault {
   id: string;
   streetlightId: string;
   streetlightName: string;
   type: FaultType;
   severity: FaultSeverity;
   detectedAt: number;
   resolved: boolean;
   resolvedAt?: number;
   description: string;
 }
 
 export interface Notification {
   id: string;
   faultId: string;
   streetlightId: string;
   streetlightName: string;
   faultType: FaultType;
   message: string;
   timestamp: number;
   read: boolean;
 }
 
 export interface WeeklySummary {
   streetlightId: string;
   weekStart: number;
   weekEnd: number;
   voltageStats: {
     min: number;
     max: number;
     avg: number;
     readings: { timestamp: number; value: number }[];
   };
   currentStats: {
     min: number;
     max: number;
     avg: number;
     readings: { timestamp: number; value: number }[];
   };
   powerStats: {
     total: number;
     avg: number;
     readings: { timestamp: number; value: number }[];
   };
   faults: Fault[];
   uptimePercentage: number;
   totalOperationalHours: number;
   timeline: { timestamp: number; status: LightStatus }[];
 }
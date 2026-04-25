export type LightStatus = 'on' | 'off' | 'flickering' | 'dim';
export type HealthStatus = 'healthy' | 'warning' | 'fault';
export type FaultType = 'off_when_scheduled_on' | 'flickering' | 'dim_output' | 'voltage_anomaly' | 'low_battery';
export type FaultSeverity = 'low' | 'medium' | 'high';

export interface StreetlightReading {
  timestamp: number;
  voltage: number;
  current: number;
  power: number;
  status: LightStatus;
  batterySOH?: number;
  luminance?: number;
  motionDetected?: boolean;
  solarChargingCurrent?: number;
}

export interface Streetlight {
  id: string;
  name: string;
  location?: string;
  status: LightStatus;
  healthStatus: HealthStatus;
  voltage: number;       // Battery voltage (12V LiFePO4)
  current: number;       // LED current
  power: number;         // LED power
  lastUpdated: number;
  batterySOH: number;           // Battery State of Health %
  luminance: number;            // BH1750 lux reading
  motionDetected?: boolean;     // Microwave motion sensor
  solarChargingCurrent: number; // Solar panel charging current (A)
  ldr: number;                  // Raw LDR value (0-4095)
  hasData?: boolean;            // True if real data was received from Firebase
  online?: boolean;
  // ESP32-provided derived fields
  ledStatus?: 'DEGRADED' | 'NOT DEGRADED' | 'NIGHT - NO MOTION' | 'DAYTIME - LED OFF' | string;
  batteryStatus?: 'NORMAL' | 'DEGRADED' | string;
  soh?: number; // 0-100 %
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
